from dataclasses import dataclass
from typing import Any

import json

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from bot.config import settings


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@dataclass
class PendingLeadEvent:
    id: int
    lead_id: int
    event_type: str
    telegram_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    event_payload: dict[str, Any] | None


class BotRepository:
    def create_or_update_user(self, telegram_user: dict[str, Any]) -> tuple[int, int]:
        with SessionLocal.begin() as db:
            row = db.execute(
                text(
                    """
                    INSERT INTO users (telegram_id, username, first_name, last_name, language_code, created_at, first_started_at, last_seen_at, visits_count)
                    VALUES (:telegram_id, :username, :first_name, :last_name, :language_code, now(), now(), now(), 1)
                    ON CONFLICT (telegram_id)
                    DO UPDATE SET
                      username = EXCLUDED.username,
                      first_name = EXCLUDED.first_name,
                      last_name = EXCLUDED.last_name,
                      language_code = EXCLUDED.language_code,
                      last_seen_at = now(),
                      visits_count = users.visits_count + 1,
                      first_started_at = COALESCE(users.first_started_at, now())
                    RETURNING id, visits_count;
                    """
                ),
                {
                    'telegram_id': int(telegram_user['id']),
                    'username': telegram_user.get('username'),
                    'first_name': telegram_user.get('first_name'),
                    'last_name': telegram_user.get('last_name'),
                    'language_code': telegram_user.get('language_code'),
                },
            ).mappings().one()
            return int(row['id']), int(row['visits_count'])

    def get_or_create_lead_for_user(self, user_id: int) -> int:
        with SessionLocal.begin() as db:
            existing = db.execute(
                text('SELECT id FROM leads WHERE user_id = :user_id ORDER BY id DESC LIMIT 1'),
                {'user_id': user_id},
            ).scalar_one_or_none()
            if existing is not None:
                return int(existing)

            created = db.execute(
                text(
                    """
                    INSERT INTO leads (user_id, lead_status, created_at, updated_at)
                    VALUES (:user_id, 'draft', now(), now())
                    RETURNING id;
                    """
                ),
                {'user_id': user_id},
            ).scalar_one()
            return int(created)

    def create_lead_event(self, lead_id: int, event_type: str) -> None:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    INSERT INTO lead_events (lead_id, event_type, event_payload, created_at)
                    VALUES (:lead_id, :event_type, NULL, now());
                    """
                ),
                {'lead_id': lead_id, 'event_type': event_type},
            )

    def log_admin_notification(self, lead_id: int, notification_type: str, priority: str, status: str) -> None:
        is_sent = status == 'sent'
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    INSERT INTO admin_notifications (lead_id, notification_type, priority, status, sent_at, created_at)
                    VALUES (
                      :lead_id,
                      :notification_type,
                      :priority,
                      :status,
                      CASE WHEN :is_sent THEN now() ELSE NULL END,
                      now()
                    );
                    """
                ),
                {
                    'lead_id': lead_id,
                    'notification_type': notification_type,
                    'priority': priority,
                    'status': status,
                    'is_sent': is_sent,
                },
            )

    def list_pending_lead_events(self, limit: int = 100) -> list[PendingLeadEvent]:
        with SessionLocal.begin() as db:
            rows = db.execute(
                text(
                    """
                    SELECT
                      le.id,
                      le.lead_id,
                      le.event_type,
                      le.event_payload,
                      u.telegram_id,
                      u.username,
                      u.first_name,
                      u.last_name
                    FROM lead_events le
                    JOIN leads l ON l.id = le.lead_id
                    JOIN users u ON u.id = l.user_id
                    WHERE le.event_type IN (
                      'miniapp_opened',
                      'app_resumed',
                      'profile_started',
                      'profile_updated',
                      'profile_completed',
                      'expense_added',
                      'expense_updated',
                      'expense_removed',
                      'budget_calculated'
                    )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM admin_notifications an
                        WHERE an.lead_id = le.lead_id
                          AND an.notification_type = CONCAT('lead_event:', le.id)
                      )
                    ORDER BY le.id ASC
                    LIMIT :limit;
                    """
                ),
                {'limit': limit},
            ).mappings().all()

            return [
                PendingLeadEvent(
                    id=int(row['id']),
                    lead_id=int(row['lead_id']),
                    event_type=str(row['event_type']),
                    telegram_id=int(row['telegram_id']),
                    username=row['username'],
                    first_name=row['first_name'],
                    last_name=row['last_name'],
                    event_payload=self._parse_json_payload(row['event_payload']),
                )
                for row in rows
            ]

    @staticmethod
    def _parse_json_payload(value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            return json.loads(value)
        return dict(value)
