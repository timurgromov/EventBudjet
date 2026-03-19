import asyncio
import logging

from aiogram import Bot

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
        if event.event_type == 'profile_completed':
            text = (
                f'Профиль заполнен: @{event.username}'
                if event.username
                else f'Профиль заполнен (telegram_id={event.telegram_id})'
            )
            priority = 'high'
        elif event.event_type == 'budget_calculated':
            text = (
                f'Расчёт бюджета завершён: @{event.username}'
                if event.username
                else f'Расчёт бюджета завершён (telegram_id={event.telegram_id})'
            )
            priority = 'medium'
        else:
            return

        await self._send_and_log(
            event.lead_id,
            event.event_type,
            priority,
            text,
            actor_telegram_id=event.telegram_id,
        )

    async def _send_and_log(
        self,
        lead_id: int,
        notification_type: str,
        priority: str,
        text: str,
        actor_telegram_id: int | None = None,
    ) -> None:
        status = 'failed'

        if settings.bot_dry_run:
            logger.info('bot_dry_run_notification type=%s lead_id=%s text=%s', notification_type, lead_id, text)
            status = 'sent'
            self.repository.log_admin_notification(lead_id, notification_type, priority, status)
            return

        if settings.bot_admin_chat_id is None:
            logger.warning('admin_chat_id_missing type=%s lead_id=%s', notification_type, lead_id)
            self.repository.log_admin_notification(lead_id, notification_type, priority, status)
            return

        try:
            await self.bot.send_message(chat_id=settings.bot_admin_chat_id, text=text)
            status = 'sent'
        except Exception:
            logger.exception('notification_send_failed type=%s lead_id=%s', notification_type, lead_id)
        finally:
            self.repository.log_admin_notification(lead_id, notification_type, priority, status)


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
