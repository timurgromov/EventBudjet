import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter

from bot.config import settings
from bot.db import BotRepository, LeadSnapshot, PendingLeadEvent, PendingLeadEventBatch, ReminderCandidate

logger = logging.getLogger(__name__)

REMINDER_TEXTS: dict[str, list[str]] = {
    'reminder_d2': [
        'Вы давно не заходили в свадебный калькулятор. Продолжите с того места, где остановились.',
    ],
    'reminder_d7': [
        'Привет! Если подготовка уже двигается, загляните в калькулятор на 5 минут — обновить смету и сверить приоритеты.',
    ],
    'reminder_followup': [
        'Привет! Если подготовка продолжается, можно быстро вернуться в калькулятор и обновить смету.',
        'Напомню про калькулятор: по ходу подготовки часто меняются суммы, площадка и приоритеты. Проверьте, всё ли ещё актуально.',
        'Если свадьба всё ещё в процессе планирования, загляните в калькулятор ещё раз — удобно сверить бюджет и ничего не потерять.',
        'Калькулятор по-прежнему доступен: можно вернуться в любой момент, обновить цифры и продолжить с сохранённого места.',
    ],
}


@dataclass
class SendAttemptResult:
    sent: bool
    blocked: bool = False
    error: str | None = None


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

    async def notify_incoming_user_message(self, event: PendingLeadEvent) -> None:
        text = self._render_incoming_user_message_alert(event)
        await self._send_and_log(
            event.lead_id,
            'incoming_user_message',
            'high',
            text,
            notification_key=f'user_message:{event.id}',
            actor_telegram_id=event.telegram_id,
        )

    async def send_reminder(self, candidate: ReminderCandidate) -> bool:
        text = self._resolve_reminder_text(candidate)
        if not text:
            return False

        if settings.bot_dry_run or settings.bot_reminder_dry_run:
            logger.info(
                'bot_dry_run_reminder lead_id=%s telegram_id=%s code=%s reason=%s text=%s',
                candidate.lead_id,
                candidate.telegram_id,
                candidate.reminder_code,
                candidate.reason,
                text,
            )
            result = SendAttemptResult(sent=True)
        else:
            result = await _safe_send_message(bot=self.bot, chat_id=candidate.telegram_id, text=text)

        status = 'sent' if result.sent else 'failed'
        self.repository.log_admin_notification(
            lead_id=candidate.lead_id,
            notification_type=candidate.reminder_code,
            priority='low',
            status=status,
        )
        self.repository.create_lead_event(
            lead_id=candidate.lead_id,
            event_type='bot_message_sent',
            event_payload={
                'text': text,
                'source': candidate.reminder_code,
                'reason': candidate.reason,
                'status': status,
                'blocked': result.blocked,
                'error': result.error,
            },
        )
        if result.blocked:
            self.repository.create_lead_event(
                lead_id=candidate.lead_id,
                event_type='bot_blocked',
                event_payload={
                    'source': candidate.reminder_code,
                    'reason': candidate.reason,
                    'detected_via': 'reminder_send',
                    'error': result.error,
                },
            )
        return result.sent

    def _resolve_reminder_text(self, candidate: ReminderCandidate) -> str | None:
        variants = REMINDER_TEXTS.get(candidate.reminder_code)
        if not variants:
            return None
        index = candidate.variant_index % len(variants)
        return variants[index]

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
        changes, priority = self._build_batch_change_lines(batch.events)
        if not changes:
            return None
        lines.append('Что изменил:')
        lines.extend(changes)
        snapshot_text = self._format_budget_snapshot(snapshot)
        if snapshot_text:
            lines.extend(['', snapshot_text])
        return ('\n'.join(lines), priority)

    def _render_incoming_user_message_alert(self, event: PendingLeadEvent) -> str:
        actor = self._format_actor(event)
        snapshot = self.repository.get_lead_snapshot(event.lead_id)
        source_label = snapshot.source_label or snapshot.source or '—'
        payload = event.event_payload or {}
        text_value = str(payload.get('text') or '').strip()
        content_type = str(payload.get('content_type') or '').strip()

        lines = [
            'Новое сообщение в Telegram',
            '',
            actor,
            f'lead #{event.lead_id}',
            f'Источник: {source_label}',
        ]

        if text_value:
            lines.extend(['', f'Сообщение: {text_value[:1500]}'])
        elif content_type:
            lines.extend(['', f'Сообщение без текста ({content_type})'])
        else:
            lines.extend(['', 'Сообщение без текста'])

        return '\n'.join(lines)

    def _build_batch_change_lines(self, events: list[PendingLeadEvent]) -> tuple[list[str], str]:
        priority = 'medium'
        profile_changes: dict[str, dict[str, Any]] = {}
        expense_changes: dict[int, dict[str, Any]] = {}
        ui_actions: list[str] = []
        budget_line: str | None = None

        for event in events:
            payload = event.event_payload or {}
            if event.event_type == 'profile_updated':
                self._merge_change_set(profile_changes, payload.get('changes'))
                continue

            if event.event_type == 'expense_added':
                expense_id = self._parse_expense_id(payload.get('expense_id'))
                if expense_id is None:
                    continue
                expense_changes[expense_id] = {
                    'action': 'added',
                    'name': payload.get('category_name') or 'Новая статья',
                    'amount': payload.get('amount'),
                    'changes': {},
                }
                continue

            if event.event_type == 'expense_updated':
                expense_id = self._parse_expense_id(payload.get('expense_id'))
                if expense_id is None:
                    continue
                entry = expense_changes.setdefault(
                    expense_id,
                    {
                        'action': 'updated',
                        'name': payload.get('category_name') or 'Статья расходов',
                        'amount': payload.get('amount'),
                        'changes': {},
                    },
                )
                if entry.get('action') != 'added':
                    entry['action'] = 'updated'
                entry['name'] = payload.get('category_name') or entry.get('name') or 'Статья расходов'
                entry['amount'] = payload.get('amount') or entry.get('amount')
                self._merge_change_set(entry['changes'], payload.get('changes'))
                continue

            if event.event_type == 'expense_removed':
                expense_id = self._parse_expense_id(payload.get('expense_id'))
                if expense_id is None:
                    continue
                existing = expense_changes.get(expense_id)
                if existing and existing.get('action') == 'added':
                    expense_changes.pop(expense_id, None)
                    continue
                expense_changes[expense_id] = {
                    'action': 'removed',
                    'name': payload.get('category_name') or 'Статья расходов',
                    'amount': payload.get('amount'),
                    'changes': {},
                }
                continue

            rendered = self._render_event_summary_line(event)
            if rendered is None:
                continue
            line, line_priority = rendered
            if event.event_type == 'ui_action':
                if line not in ui_actions:
                    ui_actions.append(line)
            elif event.event_type == 'budget_calculated':
                budget_line = line
            else:
                ui_actions.append(line)
            if line_priority == 'high':
                priority = 'high'

        lines: list[str] = []
        profile_details = self._format_changes(list(profile_changes.values()), PROFILE_FIELD_LABELS)
        if profile_details:
            lines.extend(profile_details.splitlines())

        for expense_entry in expense_changes.values():
            rendered_expense_lines = self._render_expense_summary_lines(expense_entry)
            lines.extend(rendered_expense_lines)

        if budget_line:
            lines.append(budget_line)
        lines.extend(ui_actions)
        return lines, priority

    @staticmethod
    def _merge_change_set(target: dict[str, dict[str, Any]], changes: Any) -> None:
        if not isinstance(changes, list):
            return
        for change in changes:
            if not isinstance(change, dict):
                continue
            field = str(change.get('field') or '')
            if not field:
                continue
            if field not in target:
                target[field] = {
                    'field': field,
                    'old': change.get('old'),
                    'new': change.get('new'),
                }
            else:
                target[field]['new'] = change.get('new')

    def _render_expense_summary_lines(self, entry: dict[str, Any]) -> list[str]:
        action = str(entry.get('action') or '')
        name = str(entry.get('name') or 'Статья расходов')
        if action == 'added':
            return [f'• Добавил расход: {name} — {self._format_amount(entry.get("amount"))}']
        if action == 'removed':
            return [f'• Удалил расход: {name} — {self._format_amount(entry.get("amount"))}']
        changes = entry.get('changes') or {}
        details = self._format_changes(list(changes.values()), EXPENSE_FIELD_LABELS)
        if not details:
            return []
        lines = [f'• Изменил расход: {name}']
        lines.extend([f'  {line}' for line in details.splitlines()])
        return lines

    @staticmethod
    def _parse_expense_id(value: Any) -> int | None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _render_event_summary_line(self, event: PendingLeadEvent) -> tuple[str, str] | None:
        payload = event.event_payload or {}
        if event.event_type == 'miniapp_opened':
            return None
        if event.event_type == 'app_resumed':
            return None
        if event.event_type == 'profile_started':
            return None
        if event.event_type == 'profile_completed':
            return None
        if event.event_type == 'profile_updated':
            details = self._format_changes(payload.get('changes'), PROFILE_FIELD_LABELS)
            if details:
                return (details, 'medium')
            return None
        if event.event_type == 'user_message':
            text_value = str(payload.get('text') or '').strip()
            if text_value:
                return (f'• Написал в Telegram: {text_value[:500]}', 'high')
            content_type = str(payload.get('content_type') or '').strip()
            if content_type:
                return (f'• Написал в Telegram ({content_type})', 'high')
            return ('• Написал в Telegram', 'high')
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
        if event.event_type == 'ui_action':
            return (self._format_ui_action(payload), 'low')
        return None

    @staticmethod
    def _format_ui_action(payload: dict[str, Any]) -> str:
        action = str(payload.get('action') or '')
        if action == 'copy_estimate':
            return '• Нажал «Скопировать смету»'
        if action == 'view_online_review':
            return '• Нажал «Посмотреть онлайн-разбор»'
        if action == 'open_site_header':
            return '• Перешёл на timurgromov.ru из шапки'
        if action == 'open_site_footer':
            return '• Перешёл на timurgromov.ru из подвала'
        return '• Совершил дополнительное действие в интерфейсе'

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
        venue_status_old = venue_status_new = None
        venue_name_old = venue_name_new = None
        has_venue_status = False
        has_venue_name = False
        for change in changes:
            if not isinstance(change, dict):
                continue
            field = str(change.get('field'))
            if field == 'venue_status':
                has_venue_status = True
                venue_status_old = change.get('old')
                venue_status_new = change.get('new')
                continue
            if field == 'venue_name':
                has_venue_name = True
                venue_name_old = change.get('old')
                venue_name_new = change.get('new')
                continue
            label = labels.get(field, field)
            old_value = AdminNotificationService._format_field_value(field, change.get('old'))
            new_value = AdminNotificationService._format_field_value(field, change.get('new'))
            if old_value == new_value:
                continue
            lines.append(f'• {label}: {old_value} -> {new_value}')
        if has_venue_status or has_venue_name:
            if has_venue_name and not has_venue_status:
                old_value = str(venue_name_old).strip() if venue_name_old else 'выбрали'
                new_value = str(venue_name_new).strip() if venue_name_new else 'выбрали'
            else:
                old_value = AdminNotificationService._format_venue_value(
                    str(venue_status_old) if venue_status_old is not None else None,
                    str(venue_name_old).strip() if venue_name_old else None,
                )
                new_value = AdminNotificationService._format_venue_value(
                    str(venue_status_new) if venue_status_new is not None else None,
                    str(venue_name_new).strip() if venue_name_new else None,
                )
            if old_value != new_value:
                lines.append(f'• Площадка: {old_value} -> {new_value}')
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
        source_label = (snapshot.source_label or snapshot.source or '').strip()
        if source_label:
            lines.append(f'Источник: {source_label}')
        lines.append(f'Площадка: {self._format_venue_value(snapshot.venue_status, snapshot.venue_name)}')
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

    @staticmethod
    def _format_venue_value(status: str | None, name: str | None) -> str:
        if name:
            return name
        if status == 'chosen':
            return 'выбрали'
        return 'не выбрали'


PROFILE_FIELD_LABELS = {
    'role': 'Роль',
    'city': 'Город',
    'venue_status': 'Площадка',
    'venue_name': 'Площадка',
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
    next_reminder_check_at = 0.0
    while not stop_event.is_set():
        await process_pending_events_once(service, repository)
        now = time.monotonic()
        if now >= next_reminder_check_at:
            await process_due_reminders_once(service, repository)
            next_reminder_check_at = now + max(5, settings.bot_reminder_check_interval_seconds)
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


async def process_due_reminders_once(service: AdminNotificationService, repository: BotRepository) -> int:
    if not settings.bot_reminder_enabled:
        return 0
    if not _is_reminder_send_window_open():
        return 0

    candidates = repository.list_due_reminder_candidates(limit=settings.bot_reminder_max_per_run)
    if candidates:
        logger.info('reminder_candidates_found count=%s dry_run=%s', len(candidates), settings.bot_reminder_dry_run)
    sent = 0
    for candidate in candidates:
        ok = await service.send_reminder(candidate)
        if ok:
            sent += 1
        await asyncio.sleep(0)
    return sent


def _is_reminder_send_window_open() -> bool:
    tz_name = settings.bot_reminder_timezone
    start_hour = settings.bot_reminder_send_hour_start
    end_hour = settings.bot_reminder_send_hour_end
    now_local = datetime.now(ZoneInfo(tz_name))
    hour = now_local.hour

    if start_hour == end_hour:
        # 24/7 mode if start == end.
        return True

    if start_hour < end_hour:
        allowed = start_hour <= hour < end_hour
    else:
        # Overnight window support (e.g. 22 -> 6).
        allowed = hour >= start_hour or hour < end_hour

    if not allowed:
        logger.info(
            'reminder_window_closed tz=%s local_hour=%s allowed=%02d..%02d',
            tz_name,
            hour,
            start_hour,
            end_hour,
        )
    return allowed


def _is_blocked_error(raw_error: str | None) -> bool:
    lowered = (raw_error or '').lower()
    return 'blocked by the user' in lowered or 'user is deactivated' in lowered


async def _safe_send_message(bot: Bot, chat_id: int, text: str) -> SendAttemptResult:
    try:
        await bot.send_message(chat_id=chat_id, text=text)
        return SendAttemptResult(sent=True)
    except TelegramRetryAfter as exc:
        await asyncio.sleep(exc.retry_after)
        try:
            await bot.send_message(chat_id=chat_id, text=text)
            return SendAttemptResult(sent=True)
        except Exception as retry_exc:  # noqa: BLE001
            error_text = str(retry_exc)
            return SendAttemptResult(sent=False, blocked=_is_blocked_error(error_text), error=error_text)
    except Exception as exc:  # noqa: BLE001
        error_text = str(exc)
        return SendAttemptResult(sent=False, blocked=_is_blocked_error(error_text), error=error_text)
