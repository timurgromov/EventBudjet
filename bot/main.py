import asyncio
import logging
import re
from pathlib import Path
from urllib.parse import parse_qsl, unquote_plus, urlencode, urlparse, urlunparse

from aiogram import Bot, Dispatcher, Router
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.exceptions import TelegramForbiddenError, TelegramNetworkError
from aiogram.filters import CommandStart
from aiogram.types import ChatMemberUpdated, FSInputFile, InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

from bot.config import settings
from bot.db import BotRepository
from bot.notifications import AdminNotificationService, process_pending_events_once, run_lead_event_notifier

logging.basicConfig(level=logging.INFO, format='time=%(asctime)s level=%(levelname)s logger=%(name)s message=%(message)s')
logger = logging.getLogger(__name__)

router = Router()
repository = BotRepository()
READY_FILE = Path('/tmp/bot_ready')
START_MESSAGE_IMAGE = Path(__file__).resolve().parent / 'assets' / 'start-message.jpg'
START_MESSAGE_SEND_RETRIES = 3
START_MESSAGE_RETRY_DELAY_SECONDS = 2
START_MESSAGE_TEXT = (
    'Привет!\n'
    'Этот бот поможет вам понять свадебный бюджет без хаоса и бесконечных таблиц.\n\n'
    'Здесь вы сможете:\n'
    '— посчитать примерную смету\n'
    '— посмотреть, что влияет на стоимость\n'
    '— переслать расчёт близким\n'
    '— открыть онлайн-разбор по пошаговой подготовке к свадьбе\n\n'
    'Нажмите кнопку ниже, чтобы начать.'
)
SOURCE_CODE_RE = re.compile(r'^[a-z0-9][a-z0-9_-]{1,63}$')


def build_mini_app_url() -> str:
    parsed = urlparse(settings.mini_app_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    # Force Telegram WebView cache busting per day to pick up fresh frontend bundle.
    query["app_v"] = "20260403a"
    return urlunparse(parsed._replace(query=urlencode(query)))


def build_start_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text='Открыть свадебный калькулятор',
                    web_app=WebAppInfo(url=build_mini_app_url()),
                )
            ]
        ]
    )


async def send_start_message_with_retry(message: Message, lead_id: int) -> bool:
    last_error: Exception | None = None
    for attempt in range(1, START_MESSAGE_SEND_RETRIES + 1):
        try:
            if START_MESSAGE_IMAGE.exists():
                await message.answer_photo(
                    photo=FSInputFile(START_MESSAGE_IMAGE),
                    caption=START_MESSAGE_TEXT,
                    reply_markup=build_start_keyboard(),
                )
                return True

            logger.warning('start_message_image_missing path=%s', START_MESSAGE_IMAGE)
            await message.answer(START_MESSAGE_TEXT, reply_markup=build_start_keyboard())
            return True
        except TelegramForbiddenError as exc:
            logger.warning(
                'start_message_blocked telegram_id=%s lead_id=%s error=%s',
                message.chat.id,
                lead_id,
                exc,
            )
            repository.create_lead_event(
                lead_id,
                'bot_blocked',
                {
                    'telegram_id': int(message.chat.id),
                    'detected_via': 'start_reply',
                    'error': str(exc),
                },
            )
            return False
        except TelegramNetworkError as exc:
            last_error = exc
            logger.warning(
                'start_message_send_retry attempt=%s/%s delay_seconds=%s error=%s',
                attempt,
                START_MESSAGE_SEND_RETRIES,
                START_MESSAGE_RETRY_DELAY_SECONDS,
                exc,
            )
            if attempt < START_MESSAGE_SEND_RETRIES:
                await asyncio.sleep(START_MESSAGE_RETRY_DELAY_SECONDS)

    if last_error is not None:
        raise last_error
    return False


def parse_source_code_from_start(message: Message) -> str:
    text_value = (message.text or '').strip()
    if not text_value:
        return 'direct_personal'
    parts = text_value.split(maxsplit=1)
    if len(parts) < 2:
        return 'direct_personal'

    raw = unquote_plus(parts[1].strip().lower())
    if not raw or raw == 'calc':
        return 'direct_personal'
    if not SOURCE_CODE_RE.match(raw):
        return 'direct_personal'
    return raw


def normalize_chat_member_status(value: object) -> str:
    return str(getattr(value, 'status', value) or '').lower()


@router.my_chat_member()
async def my_chat_member_handler(update: ChatMemberUpdated) -> None:
    if update.chat.type != 'private':
        return

    telegram_id = int(update.chat.id)
    lead_id = repository.get_latest_lead_id_by_telegram_id(telegram_id)
    if lead_id is None:
        return

    old_status = normalize_chat_member_status(update.old_chat_member)
    new_status = normalize_chat_member_status(update.new_chat_member)
    if old_status == new_status:
        return

    payload = {
        'telegram_id': telegram_id,
        'old_status': old_status,
        'new_status': new_status,
        'detected_via': 'my_chat_member',
    }
    if new_status == 'kicked':
        repository.create_lead_event(lead_id, 'bot_blocked', payload)
        return

    if old_status == 'kicked' and new_status in {'member', 'administrator'}:
        repository.create_lead_event(lead_id, 'bot_unblocked', payload)
        return


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
    source_code = parse_source_code_from_start(message)
    lead_id = repository.get_or_create_lead_for_user(user_id, source_code=source_code)
    repository.create_lead_event(lead_id, 'bot_started', {'source': source_code})

    sent = await send_start_message_with_retry(message, lead_id)
    repository.create_lead_event(
        lead_id,
        'bot_message_sent',
        {
            'text': START_MESSAGE_TEXT,
            'source': 'start',
            'status': 'sent' if sent else 'failed',
            'blocked': sent is False,
        },
    )


@router.message()
async def user_message_handler(message: Message) -> None:
    if message.from_user is None:
        return
    if message.chat.type != 'private':
        return
    if isinstance(message.text, str) and message.text.startswith('/start'):
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

    text_value = (message.text or message.caption or '').strip()
    payload = {
        'text': text_value[:3000],
        'message_id': message.message_id,
        'has_media': message.content_type not in {'text'},
        'content_type': message.content_type,
    }
    repository.create_lead_event(lead_id, 'user_message', payload)

async def main() -> None:
    READY_FILE.unlink(missing_ok=True)
    session: AiohttpSession | None = None
    if settings.bot_telegram_proxy_url:
        session = AiohttpSession(proxy=settings.bot_telegram_proxy_url)
        logger.info('telegram_proxy_enabled proxy_url=%s', settings.bot_telegram_proxy_url)

    bot = Bot(token=settings.telegram_bot_token, session=session)
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
