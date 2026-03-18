from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.telegram_auth import InvalidTelegramInitData, validate_telegram_init_data


def get_current_user(
    telegram_init_data: str | None = Header(default=None, alias='X-Telegram-Init-Data'),
    db: Session = Depends(get_db),
) -> User:
    if not telegram_init_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing initData')

    try:
        auth_data = validate_telegram_init_data(telegram_init_data)
    except InvalidTelegramInitData as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid initData') from exc

    telegram_id = int(auth_data.user['id'])
    user = UserRepository(db).get_by_telegram_id(telegram_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User is not initialized')

    return user


def require_admin_access(x_admin_token: str | None = Header(default=None, alias='X-Admin-Token')) -> None:
    configured_token = settings.admin_api_token
    if not configured_token:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Admin access is not configured')

    if x_admin_token != configured_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin access denied')
