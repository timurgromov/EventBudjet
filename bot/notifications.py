import asyncio
import logging
from datetime import date
from decimal import Decimal
from typing import Any

from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter

from bot.config import settings
from bot.db import BotRepository, LeadSnapshot, PendingLeadEvent, PendingLeadEventBatch

logger = logging.getLogger(__name__)


class AdminNotificationService:
    def __init__(self, bot: Bot, repository: BotRepository):
        self.bot = bot
        self.repository = repository

    async def notify_lead_event_batch(self, batch: PendingLeadEventBatch) -> None:
        rendered = self._render_lead_event_batch(batch)
        if rendered is None:
            return
        text, priority = rendered

        await self._send_and_log(
            batch.lead_id,
            'lead_event_batch',
            priority,
            text,
            notification_keys=[f'lead_event:{event.id}' for event in batch.events],
            actor_telegram_id=batch.telegram_id,
        )

    async def _send_and_log(
        self,
        lead_id: int,
        notification_type: str,
        priority: str,
        text: str,
        notification_key: str | None = None,
        notification_keys: list[str] | None = None,
        actor_telegram_id: int | None = None,
    ) -> None:
        status = 'failed'
        log_keys = notification_keys or ([notification_key] if notification_key else [notification_type])

        if settings.bot_dry_run:
            logger.info('bot_dry_run_notification type=%s lead_id=%s text=%s', notification_type, lead_id, text)
            status = 'sent'
            for log_key in log_keys:
                self.repository.log_admin_notification(lead_id, log_key, priority, status)
            return

        if settings.bot_admin_chat_id is None:
            logger.warning('admin_chat_id_missing type=%s lead_id=%s', notification_type, lead_id)
            for log_key in log_keys:
                self.repository.log_admin_notification(lead_id, log_key, priority, status)
            return

        try:
            await self.bot.send_message(chat_id=settings.bot_admin_chat_id, text=text)
            status = 'sent'
        except TelegramRetryAfter as exc:
            logger.warning(
                'notification_rate_limited type=%s lead_id=%s retry_after=%s',
                notification_type,
                lead_id,
                exc.retry_after,
            )
            await asyncio.sleep(exc.retry_after)
            try:
                await self.bot.send_message(chat_id=settings.bot_admin_chat_id, text=text)
                status = 'sent'
            except Exception:
                logger.exception('notification_retry_failed type=%s lead_id=%s', notification_type, lead_id)
        except Exception:
            logger.exception('notification_send_failed type=%s lead_id=%s', notification_type, lead_id)
        finally:
            for log_key in log_keys:
                self.repository.log_admin_notification(lead_id, log_key, priority, status)

    def _render_lead_event_batch(self, batch: PendingLeadEventBatch) -> tuple[str, str] | None:
        if not batch.events:
            return None
        actor = self._format_actor(batch.events[0])
        snapshot = self.repository.get_lead_snapshot(batch.lead_id)
        lines = [f'{actor} завершил сессию в приложении.', '']
        changes: list[str] = []
        priority = 'medium'
        for event in batch.events:
            rendered = self._render_event_summary_line(event)
            if rendered is None:
                continue
            line, line_priority = rendered
            changes.append(line)
            if line_priority == 'high':
                priority = 'high'
        if not changes:
            return None
        lines.append('Что изменил:')
        lines.extend(changes)
        snapshot_text = self._format_budget_snapshot(snapshot)
        if snapshot_text:
            lines.extend(['', snapshot_text])
        return ('\n'.join(lines), priority)

    def _render_event_summary_line(self, event: PendingLeadEvent) -> tuple[str, str] | None:
        payload = event.event_payload or {}
        if event.event_type == 'miniapp_opened':
            return ('• Открыл мини-приложение', 'low')
        if event.event_type == 'app_resumed':
            return ('• Вернулся в мини-приложение', 'low')
        if event.event_type == 'profile_started':
            return ('• Начал заполнять профиль', 'medium')
        if event.event_type == 'profile_completed':
            return ('• Заполнил профиль', 'high')
        if event.event_type == 'profile_updated':
            details = self._format_changes(payload.get('changes'), PROFILE_FIELD_LABELS)
            if details:
                details = details.replace('\n', '\n  ')
                return (f'• Обновил профиль\n  {details}', 'medium')
            return ('• Обновил профиль', 'medium')
        if event.event_type == 'expense_added':
            name = payload.get('category_name') or 'Новая статья'
            amount = self._format_amount(payload.get('amount'))
            return (f'• Добавил расход: {name} — {amount}', 'medium')
        if event.event_type == 'expense_updated':
            name = payload.get('category_name') or 'Статья расходов'
            details = self._format_changes(payload.get('changes'), EXPENSE_FIELD_LABELS)
            if details:
                details = details.replace('\n', '\n  ')
                return (f'• Изменил расход: {name}\n  {details}', 'medium')
            return (f'• Изменил расход: {name}', 'medium')
        if event.event_type == 'expense_removed':
            name = payload.get('category_name') or 'Статья расходов'
            amount = self._format_amount(payload.get('amount'))
            return (f'• Удалил расход: {name} — {amount}', 'medium')
        if event.event_type == 'budget_calculated':
            total = self._format_amount(payload.get('total_budget'))
            count = payload.get('expenses_count')
            extra = f' ({count} статей)' if count is not None else ''
            return (f'• Пересчитал бюджет: {total}{extra}', 'high')
        return None

    @staticmethod
    def _format_actor(event: PendingLeadEvent) -> str:
        full_name = ' '.join(part for part in [event.first_name, event.last_name] if part).strip()
        if full_name and event.username:
            return f'{full_name} (@{event.username})'
        if full_name:
            return full_name
        if event.username:
            return f'@{event.username}'
        return f'Пользователь (telegram_id={event.telegram_id})'

    @staticmethod
    def _format_changes(changes: Any, labels: dict[str, str]) -> str:
        if not isinstance(changes, list) or not changes:
            return ''
        lines: list[str] = []
        for change in changes:
            if not isinstance(change, dict):
                continue
            field = str(change.get('field'))
            label = labels.get(field, field)
            old_value = AdminNotificationService._format_field_value(field, change.get('old'))
            new_value = AdminNotificationService._format_field_value(field, change.get('new'))
            lines.append(f'• {label}: {old_value} -> {new_value}')
        return '\n'.join(lines)

    @staticmethod
    def _format_value(value: Any) -> str:
        if value is None or value == '':
            return 'пусто'
        if isinstance(value, bool):
            return 'да' if value else 'нет'
        return str(value)

    @staticmethod
    def _format_field_value(field: str, value: Any) -> str:
        if value is None or value == '':
            return 'пусто'
        if field == 'role':
            return ROLE_VALUES.get(str(value), str(value))
        if field == 'city':
            return CITY_VALUES.get(str(value), str(value))
        if field == 'venue_status':
            return VENUE_STATUS_VALUES.get(str(value), str(value))
        if field == 'season':
            return SEASON_VALUES.get(str(value), str(value))
        if field == 'wedding_date_mode':
            return WEDDING_DATE_MODE_VALUES.get(str(value), str(value))
        if field == 'source':
            return SOURCE_VALUES.get(str(value), str(value))
        if field == 'wedding_date_exact':
            return AdminNotificationService._format_date_value(value)
        return AdminNotificationService._format_value(value)

    @staticmethod
    def _format_amount(value: Any) -> str:
        if value is None:
            return '0'
        try:
            amount = Decimal(str(value))
            normalized = format(amount.quantize(Decimal('0.01')), 'f')
            integer, _, fraction = normalized.partition('.')
            integer = f'{int(integer):,}'.replace(',', ' ')
            return f'{integer}{"." + fraction if fraction != "00" else ""} ₽'
        except Exception:
            return str(value)

    def _format_budget_snapshot(self, snapshot: LeadSnapshot | None) -> str:
        if snapshot is None:
            return ''

        lines: list[str] = ['📋 Смета свадьбы', '']
        if snapshot.role:
            lines.append(f'Кто: {self._format_field_value("role", snapshot.role)}')
        if snapshot.city:
            lines.append(f'Город: {self._format_field_value("city", snapshot.city)}')
        if snapshot.venue_status:
            lines.append(f'Статус площадки: {self._format_field_value("venue_status", snapshot.venue_status)}')
        if snapshot.venue_name:
            lines.append(f'Площадка: {snapshot.venue_name}')
        wedding_date = self._format_wedding_date(snapshot)
        if wedding_date:
            lines.append(f'Дата свадьбы: {wedding_date}')
        if snapshot.guests_count is not None:
            lines.append(f'Гостей: {snapshot.guests_count}')
        lines.append('')

        for expense in snapshot.expenses:
            lines.append(f'{expense.category_name} — {self._format_amount(expense.amount)}')

        total = self._format_amount(snapshot.total_budget)
        lines.append('')
        lines.append(f'Итого: {total}')
        return '\n'.join(lines)

    @staticmethod
    def _format_wedding_date(snapshot: LeadSnapshot) -> str | None:
        if snapshot.wedding_date_exact:
            return AdminNotificationService._format_date_value(snapshot.wedding_date_exact)
        if snapshot.next_year_flag:
            return SEASON_VALUES['next_year']
        if snapshot.season:
            return SEASON_VALUES.get(snapshot.season, snapshot.season)
        return None

    @staticmethod
    def _format_date_value(value: Any) -> str:
        if value is None or value == '':
            return 'пусто'
        try:
            parsed = date.fromisoformat(str(value))
            return parsed.strftime('%d.%m.%Y')
        except Exception:
            return str(value)


PROFILE_FIELD_LABELS = {
    'role': 'Роль',
    'city': 'Город',
    'venue_status': 'Площадка',
    'venue_name': 'Название площадки',
    'wedding_date_exact': 'Дата свадьбы',
    'wedding_date_mode': 'Формат даты',
    'season': 'Сезон',
    'next_year_flag': 'Следующий год',
    'guests_count': 'Количество гостей',
    'source': 'Источник',
    'utm_source': 'UTM source',
    'utm_medium': 'UTM medium',
    'utm_campaign': 'UTM campaign',
    'partner_code': 'Партнёрский код',
}

EXPENSE_FIELD_LABELS = {
    'category_code': 'Код категории',
    'category_name': 'Категория',
    'amount': 'Сумма',
}

ROLE_VALUES = {
    'bride': 'Невеста',
    'groom': 'Жених',
    'mother': 'Мама',
    'pro': 'Свадебный специалист',
}

CITY_VALUES = {
    'moscow': 'Москва',
    'mo': 'МО',
    'region': 'Другой регион',
}

VENUE_STATUS_VALUES = {
    'chosen': 'Уже выбрали',
    'searching': 'Пока выбираем',
}

SEASON_VALUES = {
    'spring': 'Весна',
    'summer': 'Лето',
    'autumn': 'Осень',
    'winter': 'Зима',
    'next_year': 'В следующем году',
}

WEDDING_DATE_MODE_VALUES = {
    'exact': 'Точная дата',
    'season': 'Сезон',
}

SOURCE_VALUES = {
    'telegram_mini_app': 'Telegram Mini App',
}


async def run_lead_event_notifier(
    service: AdminNotificationService,
    repository: BotRepository,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        await process_pending_events_once(service, repository)
        await asyncio.sleep(settings.bot_event_poll_interval_seconds)


async def process_pending_events_once(service: AdminNotificationService, repository: BotRepository) -> int:
    batches = repository.list_ready_lead_event_batches(
        delay_seconds=settings.bot_event_batch_delay_seconds,
        limit=20,
    )
    processed = 0
    for batch in batches:
        await service.notify_lead_event_batch(batch)
        processed += len(batch.events)
    return processed
