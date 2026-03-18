import asyncio

from aiogram import Bot
from sqlalchemy import text

from bot.config import settings
from bot.db import BotRepository, SessionLocal
from bot.notifications import AdminNotificationService, process_pending_events_once


async def run() -> None:
    repository = BotRepository()
    bot = Bot(token=settings.telegram_bot_token)
    notifier = AdminNotificationService(bot=bot, repository=repository)

    user_id, _ = repository.create_or_update_user(
        {
            'id': 424242,
            'username': 'bot_selfcheck',
            'first_name': 'Bot',
            'last_name': 'Selfcheck',
            'language_code': 'en',
        }
    )
    lead_id = repository.get_or_create_lead_for_user(user_id)

    await notifier.notify_bot_started(lead_id=lead_id, telegram_id=424242, username='bot_selfcheck')

    repository.create_lead_event(lead_id, 'profile_completed')
    repository.create_lead_event(lead_id, 'budget_calculated')
    processed = await process_pending_events_once(notifier, repository)

    with SessionLocal.begin() as db:
        rows = db.execute(
            text(
                """
                SELECT notification_type, status, COUNT(*) AS c
                FROM admin_notifications
                WHERE lead_id = :lead_id
                GROUP BY notification_type, status
                ORDER BY notification_type, status;
                """
            ),
            {'lead_id': lead_id},
        ).mappings().all()

    print(f'processed_events={processed}')
    for row in rows:
        print(f"{row['notification_type']}|{row['status']}|{row['c']}")

    await bot.session.close()


if __name__ == '__main__':
    asyncio.run(run())
