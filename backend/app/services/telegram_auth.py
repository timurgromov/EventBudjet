import hashlib
import hmac
import json
from dataclasses import dataclass
from urllib.parse import parse_qsl

from app.core.config import settings


class InvalidTelegramInitData(ValueError):
    pass


@dataclass
class TelegramAuthData:
    user: dict
    auth_date: int | None


def _build_data_check_string(data: dict[str, str]) -> str:
    items = [f'{key}={value}' for key, value in sorted(data.items()) if key != 'hash']
    return '\n'.join(items)


def validate_telegram_init_data(init_data: str) -> TelegramAuthData:
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    provided_hash = parsed.get('hash')
    if not provided_hash:
        raise InvalidTelegramInitData('hash is missing')

    token = settings.telegram_bot_token
    if not token:
        raise InvalidTelegramInitData('telegram bot token is not configured')

    data_check_string = _build_data_check_string(parsed)
    secret_key = hmac.new(b'WebAppData', token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, provided_hash):
        raise InvalidTelegramInitData('hash mismatch')

    user_raw = parsed.get('user')
    if not user_raw:
        raise InvalidTelegramInitData('user payload is missing')

    try:
        user = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise InvalidTelegramInitData('user payload is not valid json') from exc

    if not isinstance(user, dict) or 'id' not in user:
        raise InvalidTelegramInitData('user payload has invalid shape')

    auth_date: int | None = None
    auth_date_raw = parsed.get('auth_date')
    if auth_date_raw is not None:
        try:
            auth_date = int(auth_date_raw)
        except ValueError as exc:
            raise InvalidTelegramInitData('auth_date must be integer') from exc

    return TelegramAuthData(user=user, auth_date=auth_date)
