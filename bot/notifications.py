import asyncio
import logging
from decimal import Decimal
from typing import Any

from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter

from bot.config import settings
from bot.db import BotRepository, PendingLeadEvent

logger = logging.getLogger(__name__)


class AdminNotificationService:
    def __init__(self, bot: Bot, repository: BotRepository):
        self.bot = bot
        self.repository = repository

    async def notify_bot_started(self, lead_id: int, telegram_id: int, username: str | None) -> None:
        text = f'Пользователь запустил бота: @{username}' if username else f'Пользователь запустил бота (telegram_id={telegram_id})'
        await self._send_and_log(lead_id, 'bot_started', 'low', text, actor_telegram_id=telegram_id)

    async def notify_lead_event(self, event: PendingLeadEvent) -> None:
        rendered = self._render_lead_event(event)
        if rendered is None:
            return
        text, priority = rendered

        await self._send_and_log(
            event.lead_id,
            event.event_type,
            priority,
            text,
            notification_key=f'lead_event:{event.id}',
            actor_telegram_id=event.telegram_id,
        )

    async def _send_and_log(
        self,
        lead_id: int,
        notification_type: str,
        priority: str,
        text: str,
        notification_key: str | None = None,
        actor_telegram_id: int | None = None,
    ) -> None:
        status = 'failed'
        log_key = notification_key or notification_type

        if settings.bot_dry_run:
            logger.info('bot_dry_run_notification type=%s lead_id=%s text=%s', notification_type, lead_id, text)
            status = 'sent'
            self.repository.log_admin_notification(lead_id, log_key, priority, status)
            return

        if settings.bot_admin_chat_id is None:
            logger.warning('admin_chat_id_missing type=%s lead_id=%s', notification_type, lead_id)
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
            self.repository.log_admin_notification(lead_id, log_key, priority, status)

    def _render_lead_event(self, event: PendingLeadEvent) -> tuple[str, str] | None:
        actor = self._format_actor(event)
        payload = event.event_payload or {}

        if event.event_type == 'miniapp_opened':
            return (f'{actor} открыл мини-приложение', 'low')
        if event.event_type == 'app_resumed':
            return (f'{actor} вернулся в мини-приложение', 'low')
        if event.event_type == 'profile_started':
            return (f'{actor} начал заполнять профиль', 'medium')
        if event.event_type == 'profile_completed':
            return (f'{actor} заполнил профиль', 'high')
        if event.event_type == 'profile_updated':
            details = self._format_changes(payload.get('changes'), PROFILE_FIELD_LABELS)
            suffix = f'\n{details}' if details else ''
            return (f'{actor} изменил данные профиля{suffix}', 'medium')
        if event.event_type == 'expense_added':
            name = payload.get('category_name') or 'Новая статья'
            amount = self._format_amount(payload.get('amount'))
            return (f'{actor} добавил расход: {name} — {amount}', 'medium')
        if event.event_type == 'expense_updated':
            name = payload.get('category_name') or 'Статья расходов'
            details = self._format_changes(payload.get('changes'), EXPENSE_FIELD_LABELS)
            suffix = f'\n{details}' if details else ''
            return (f'{actor} изменил расход: {name}{suffix}', 'medium')
        if event.event_type == 'expense_removed':
            name = payload.get('category_name') or 'Статья расходов'
            amount = self._format_amount(payload.get('amount'))
            return (f'{actor} удалил расход: {name} — {amount}', 'medium')
        if event.event_type == 'budget_calculated':
            total = self._format_amount(payload.get('total_budget'))
            count = payload.get('expenses_count')
            extra = f' ({count} статей)' if count is not None else ''
            return (f'{actor} завершил расчёт бюджета: {total}{extra}', 'high')
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
            old_value = AdminNotificationService._format_value(change.get('old'))
            new_value = AdminNotificationService._format_value(change.get('new'))
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


PROFILE_FIELD_LABELS = {
    'role': 'Роль',
    'city': 'Город',
    'venue_status': 'Площадка',
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


async def run_lead_event_notifier(
    service: AdminNotificationService,
    repository: BotRepository,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        await process_pending_events_once(service, repository)
        await asyncio.sleep(settings.bot_event_poll_interval_seconds)


async def process_pending_events_once(service: AdminNotificationService, repository: BotRepository) -> int:
    pending = repository.list_pending_lead_events(limit=100)
    for event in pending:
        await service.notify_lead_event(event)
    return len(pending)
