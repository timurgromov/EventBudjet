from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_telegram_id(self, telegram_id: int) -> User | None:
        return self.db.execute(select(User).where(User.telegram_id == telegram_id)).scalar_one_or_none()

    def upsert_from_telegram_payload(self, payload: dict) -> tuple[User, bool]:
        telegram_id = int(payload['id'])
        now = datetime.now(timezone.utc)
        user = self.get_by_telegram_id(telegram_id)

        if user is None:
            user = User(
                telegram_id=telegram_id,
                username=payload.get('username'),
                first_name=payload.get('first_name'),
                last_name=payload.get('last_name'),
                language_code=payload.get('language_code'),
                first_started_at=now,
                last_seen_at=now,
                visits_count=1,
            )
            self.db.add(user)
            is_new_user = True
        else:
            user.username = payload.get('username')
            user.first_name = payload.get('first_name')
            user.last_name = payload.get('last_name')
            user.language_code = payload.get('language_code')
            user.last_seen_at = now
            user.visits_count += 1
            if user.first_started_at is None:
                user.first_started_at = now
            is_new_user = False

        self.db.commit()
        self.db.refresh(user)
        return user, is_new_user
