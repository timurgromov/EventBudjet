import asyncio
import logging
from pathlib import Path

from aiogram import Bot, Dispatcher, Router
from aiogram.exceptions import TelegramNetworkError
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

from bot.config import settings
from bot.db import BotRepository
from bot.notifications import AdminNotificationService, process_pending_events_once, run_lead_event_notifier

logging.basicConfig(level=logging.INFO, format='time=%(asctime)s level=%(levelname)s logger=%(name)s message=%(message)s')
logger = logging.getLogger(__name__)

router = Router()
repository = BotRepository()
READY_FILE = Path('/tmp/bot_ready')


def build_start_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text='Открыть свадебный калькулятор',
                    web_app=WebAppInfo(url=settings.mini_app_url),
                )
            ]
        ]
    )


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    if message.from_user is None:
        return

    if message.chat.type != 'private':
        return

    telegram_user = {
        'id': message.from_user.id,
        'username': message.from_user.username,
        'first_name': message.from_user.first_name,
        'last_name': message.from_user.last_name,
        'language_code': message.from_user.language_code,
    }

    user_id, _visits_count = repository.create_or_update_user(telegram_user)
    lead_id = repository.get_or_create_lead_for_user(user_id)
    repository.create_lead_event(lead_id, 'bot_started')

    await message.answer(
        'Нажмите кнопку ниже, чтобы открыть свадебный калькулятор и начать планирование бюджета.',
        reply_markup=build_start_keyboard(),
    )

async def main() -> None:
    READY_FILE.unlink(missing_ok=True)
    bot = Bot(token=settings.telegram_bot_token)
    notification_service = AdminNotificationService(bot=bot, repository=repository)

    if settings.bot_dry_run:
        READY_FILE.write_text('ready')
        logger.info('bot_running_in_dry_mode')
        while True:
            processed = await process_pending_events_once(notification_service, repository)
            if processed:
                logger.info('bot_dry_run_processed_events=%s', processed)
            await asyncio.sleep(60)

    while True:
        try:
            me = await bot.get_me()
            READY_FILE.write_text('ready')
            logger.info('telegram_connection_ready bot_username=%s bot_id=%s', me.username, me.id)
            break
        except TelegramNetworkError as exc:
            READY_FILE.unlink(missing_ok=True)
            logger.warning(
                'telegram_connection_not_ready retry_in_seconds=%s error=%s',
                settings.bot_startup_retry_seconds,
                exc,
            )
            await asyncio.sleep(settings.bot_startup_retry_seconds)

    dp = Dispatcher()
    dp.include_router(router)
    stop_event = asyncio.Event()
    notifier_task = asyncio.create_task(run_lead_event_notifier(notification_service, repository, stop_event))

    try:
        await dp.start_polling(bot)
    finally:
        READY_FILE.unlink(missing_ok=True)
        stop_event.set()
        notifier_task.cancel()
        await bot.session.close()


if __name__ == '__main__':
    asyncio.run(main())
