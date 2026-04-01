from dataclasses import dataclass
from datetime import datetime, timezone
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
    created_at: str | None


@dataclass
class PendingLeadEventBatch:
    lead_id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    events: list[PendingLeadEvent]


@dataclass
class LeadExpenseSnapshot:
    category_name: str
    amount: str
    created_at: str | None


@dataclass
class LeadSnapshot:
    role: str | None
    city: str | None
    venue_status: str | None
    venue_name: str | None
    wedding_date_exact: str | None
    season: str | None
    next_year_flag: bool
    guests_count: int | None
    total_budget: str | None
    expenses: list[LeadExpenseSnapshot]


@dataclass
class ReminderCandidate:
    lead_id: int
    telegram_id: int
    reminder_code: str
    reason: str


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
                    INSERT INTO leads (user_id, lead_status, source, created_at, updated_at)
                    VALUES (:user_id, 'draft', 'direct_personal', now(), now())
                    RETURNING id;
                    """
                ),
                {'user_id': user_id},
            ).scalar_one()
            return int(created)

    def create_lead_event(self, lead_id: int, event_type: str, event_payload: dict[str, Any] | None = None) -> None:
        with SessionLocal.begin() as db:
            db.execute(
                text(
                    """
                    INSERT INTO lead_events (lead_id, event_type, event_payload, created_at)
                    VALUES (:lead_id, :event_type, CAST(:event_payload AS jsonb), now());
                    """
                ),
                {
                    'lead_id': lead_id,
                    'event_type': event_type,
                    'event_payload': json.dumps(event_payload) if event_payload is not None else None,
                },
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

    def list_ready_lead_event_batches(self, delay_seconds: int, limit: int = 20) -> list[PendingLeadEventBatch]:
        with SessionLocal.begin() as db:
            rows = db.execute(
                text(
                    """
                    WITH candidate_leads AS (
                      SELECT
                        le.lead_id,
                        MAX(le.created_at) AS last_event_at
                      FROM lead_events le
                      WHERE le.event_type IN (
                        'miniapp_opened',
                        'app_resumed',
                        'profile_started',
                        'profile_updated',
                        'profile_completed',
                        'expense_added',
                        'expense_updated',
                        'expense_removed',
                        'budget_calculated',
                        'ui_action'
                      )
                        AND NOT EXISTS (
                          SELECT 1
                          FROM admin_notifications an
                          WHERE an.lead_id = le.lead_id
                            AND an.notification_type = CONCAT('lead_event:', le.id)
                            AND an.status = 'sent'
                        )
                      GROUP BY le.lead_id
                      HAVING MAX(le.created_at) <= now() - make_interval(secs => :delay_seconds)
                      ORDER BY MAX(le.created_at) ASC
                      LIMIT :limit
                    )
                    SELECT
                      le.id,
                      le.lead_id,
                      le.event_type,
                      le.event_payload,
                      le.created_at::text AS created_at,
                      u.telegram_id,
                      u.username,
                      u.first_name,
                      u.last_name
                    FROM lead_events le
                    JOIN candidate_leads cl ON cl.lead_id = le.lead_id
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
                      'budget_calculated',
                      'ui_action'
                    )
                      AND NOT EXISTS (
                        SELECT 1
                        FROM admin_notifications an
                        WHERE an.lead_id = le.lead_id
                          AND an.notification_type = CONCAT('lead_event:', le.id)
                          AND an.status = 'sent'
                      )
                    ORDER BY le.lead_id ASC, le.id ASC;
                    """
                ),
                {'limit': limit, 'delay_seconds': delay_seconds},
            ).mappings().all()
            batches: list[PendingLeadEventBatch] = []
            current: PendingLeadEventBatch | None = None
            for row in rows:
                event = PendingLeadEvent(
                    id=int(row['id']),
                    lead_id=int(row['lead_id']),
                    event_type=str(row['event_type']),
                    telegram_id=int(row['telegram_id']),
                    username=row['username'],
                    first_name=row['first_name'],
                    last_name=row['last_name'],
                    event_payload=self._parse_json_payload(row['event_payload']),
                    created_at=row['created_at'],
                )
                if current is None or current.lead_id != event.lead_id:
                    current = PendingLeadEventBatch(
                        lead_id=event.lead_id,
                        telegram_id=event.telegram_id,
                        username=event.username,
                        first_name=event.first_name,
                        last_name=event.last_name,
                        events=[event],
                    )
                    batches.append(current)
                    continue
                current.events.append(event)
            return batches

    def list_due_reminder_candidates(self, limit: int) -> list[ReminderCandidate]:
        with SessionLocal.begin() as db:
            rows = db.execute(
                text(
                    """
                    WITH reminder_stats AS (
                      SELECT
                        an.lead_id,
                        MAX(an.created_at) FILTER (WHERE an.notification_type = 'reminder_d2' AND an.status = 'sent') AS d2_at,
                        MAX(an.created_at) FILTER (WHERE an.notification_type = 'reminder_d7' AND an.status = 'sent') AS d7_at,
                        MAX(an.created_at) FILTER (WHERE an.notification_type = 'reminder_d14' AND an.status = 'sent') AS d14_at
                      FROM admin_notifications an
                      GROUP BY an.lead_id
                    )
                    SELECT
                      l.id AS lead_id,
                      u.telegram_id,
                      u.last_seen_at,
                      rs.d2_at,
                      rs.d7_at,
                      rs.d14_at
                    FROM leads l
                    JOIN users u ON u.id = l.user_id
                    LEFT JOIN reminder_stats rs ON rs.lead_id = l.id
                    WHERE u.last_seen_at IS NOT NULL
                      AND l.lead_status <> 'archived'
                    ORDER BY u.last_seen_at ASC
                    LIMIT :limit;
                    """
                ),
                {'limit': max(limit * 5, 200)},
            ).mappings().all()
            now = datetime.now(timezone.utc)
            candidates: list[ReminderCandidate] = []
            for row in rows:
                last_seen_at = row['last_seen_at']
                if last_seen_at is None:
                    continue
                if last_seen_at.tzinfo is None:
                    last_seen_at = last_seen_at.replace(tzinfo=timezone.utc)

                d2_at = row['d2_at']
                d7_at = row['d7_at']
                d14_at = row['d14_at']
                if d2_at is not None and d2_at.tzinfo is None:
                    d2_at = d2_at.replace(tzinfo=timezone.utc)
                if d7_at is not None and d7_at.tzinfo is None:
                    d7_at = d7_at.replace(tzinfo=timezone.utc)
                if d14_at is not None and d14_at.tzinfo is None:
                    d14_at = d14_at.replace(tzinfo=timezone.utc)

                inactivity_days = (now - last_seen_at).total_seconds() / 86400
                reminder_code: str | None = None
                reason = ''
                # Stage progression is monotonic:
                # d2 -> d7 -> d14.
                # Any new visit resets inactivity timer, but does not roll stage back to d2.
                if d2_at is None:
                    if inactivity_days >= 2:
                        reminder_code = 'reminder_d2'
                        reason = 'inactivity_2d'
                elif d7_at is None:
                    if inactivity_days >= 7:
                        reminder_code = 'reminder_d7'
                        reason = 'inactivity_7d_after_d2_stage'
                elif d14_at is None:
                    if inactivity_days >= 14:
                        reminder_code = 'reminder_d14'
                        reason = 'inactivity_14d_after_d7_stage'
                else:
                    # Keep a gentle periodic ping while user remains inactive.
                    if inactivity_days >= 14 and (now - d14_at).total_seconds() >= 14 * 86400:
                        reminder_code = 'reminder_d14'
                        reason = 'periodic_14d_after_d14'

                if reminder_code:
                    candidates.append(
                        ReminderCandidate(
                            lead_id=int(row['lead_id']),
                            telegram_id=int(row['telegram_id']),
                            reminder_code=reminder_code,
                            reason=reason,
                        )
                    )
                    if len(candidates) >= limit:
                        break
            return candidates

    def get_lead_snapshot(self, lead_id: int) -> LeadSnapshot | None:
        with SessionLocal.begin() as db:
            lead_row = db.execute(
                text(
                    """
                    SELECT
                      role,
                      city,
                      venue_status,
                      venue_name,
                      wedding_date_exact::text AS wedding_date_exact,
                      season,
                      next_year_flag,
                      guests_count,
                      total_budget::text AS total_budget
                    FROM leads
                    WHERE id = :lead_id
                    LIMIT 1;
                    """
                ),
                {'lead_id': lead_id},
            ).mappings().one_or_none()
            if lead_row is None:
                return None

            expense_rows = db.execute(
                text(
                    """
                    SELECT
                      category_name,
                      amount::text AS amount,
                      created_at::text AS created_at
                    FROM expenses
                    WHERE lead_id = :lead_id
                    ORDER BY created_at ASC, id ASC;
                    """
                ),
                {'lead_id': lead_id},
            ).mappings().all()

            return LeadSnapshot(
                role=lead_row['role'],
                city=lead_row['city'],
                venue_status=lead_row['venue_status'],
                venue_name=lead_row['venue_name'],
                wedding_date_exact=lead_row['wedding_date_exact'],
                season=lead_row['season'],
                next_year_flag=bool(lead_row['next_year_flag']),
                guests_count=lead_row['guests_count'],
                total_budget=lead_row['total_budget'],
                expenses=[
                    LeadExpenseSnapshot(
                        category_name=row['category_name'],
                        amount=row['amount'],
                        created_at=row['created_at'],
                    )
                    for row in expense_rows
                ],
            )

    @staticmethod
    def _parse_json_payload(value: Any) -> dict[str, Any] | None:
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        if isinstance(value, str):
            return json.loads(value)
        return dict(value)
