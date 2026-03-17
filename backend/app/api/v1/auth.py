import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TelegramInitRequest, TelegramInitResponse
from app.services.telegram_auth import InvalidTelegramInitData, validate_telegram_init_data

router = APIRouter(prefix='/auth/telegram', tags=['auth'])
logger = logging.getLogger(__name__)


@router.post('/init', response_model=TelegramInitResponse)
def auth_telegram_init(payload: TelegramInitRequest, db: Session = Depends(get_db)) -> TelegramInitResponse:
    try:
        auth_data = validate_telegram_init_data(payload.init_data)
    except InvalidTelegramInitData as exc:
        logger.warning('auth_init_rejected reason=%s', str(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid initData') from exc

    repo = UserRepository(db)
    user, is_new_user = repo.upsert_from_telegram_payload(auth_data.user)

    logger.info(
        'auth_init_accepted telegram_id=%s user_id=%s is_new_user=%s',
        user.telegram_id,
        user.id,
        is_new_user,
    )

    return TelegramInitResponse(
        user_id=user.id,
        telegram_id=user.telegram_id,
        is_new_user=is_new_user,
        visits_count=user.visits_count,
    )
