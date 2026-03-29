from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session

from app.models.admin_notification import AdminNotification
from app.models.enums import NotificationStatus
from app.models.expense import Expense
from app.models.lead import Lead
from app.models.lead_event import LeadEvent
from app.models.user import User


class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_leads(self) -> list[tuple[Lead, User]]:
        stmt: Select[tuple[Lead, User]] = (
            select(Lead, User)
            .join(User, User.id == Lead.user_id)
            .order_by(desc(Lead.updated_at), desc(Lead.id))
        )
        return list(self.db.execute(stmt).all())

    def get_lead_with_user(self, lead_id: int) -> tuple[Lead, User] | None:
        stmt: Select[tuple[Lead, User]] = (
            select(Lead, User)
            .join(User, User.id == Lead.user_id)
            .where(Lead.id == lead_id)
            .limit(1)
        )
        return self.db.execute(stmt).first()

    def list_lead_events(self, lead_id: int, limit: int = 100) -> list[LeadEvent]:
        stmt = (
            select(LeadEvent)
            .where(LeadEvent.lead_id == lead_id)
            .order_by(desc(LeadEvent.id))
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_expenses(self, lead_id: int) -> list[Expense]:
        stmt = select(Expense).where(Expense.lead_id == lead_id).order_by(Expense.id.asc())
        return list(self.db.execute(stmt).scalars().all())

    def list_notifications(self, limit: int = 200) -> list[tuple[AdminNotification, User | None]]:
        stmt = (
            select(AdminNotification, User)
            .join(Lead, Lead.id == AdminNotification.lead_id)
            .join(User, User.id == Lead.user_id, isouter=True)
            .order_by(desc(AdminNotification.created_at), desc(AdminNotification.id))
            .limit(limit)
        )
        return list(self.db.execute(stmt).all())

    def create_notification_log(
        self,
        lead_id: int,
        notification_type: str,
        priority: str | None,
        status: NotificationStatus,
    ) -> AdminNotification:
        notification = AdminNotification(
            lead_id=lead_id,
            notification_type=notification_type,
            priority=priority,
            status=status,
            sent_at=None,
        )
        if status == NotificationStatus.SENT:
            from datetime import datetime, timezone

            notification.sent_at = datetime.now(timezone.utc)
        self.db.add(notification)
        return notification

    def reset_lead_data(self, lead: Lead) -> Lead:
        lead.role = None
        lead.city = None
        lead.venue_status = None
        lead.venue_name = None
        lead.wedding_date_exact = None
        lead.wedding_date_mode = None
        lead.season = None
        lead.next_year_flag = False
        lead.guests_count = None
        lead.total_budget = None
        lead.source = None
        lead.utm_source = None
        lead.utm_medium = None
        lead.utm_campaign = None
        lead.partner_code = None

        for expense in list(lead.expenses):
            self.db.delete(expense)
        for event in list(lead.events):
            self.db.delete(event)
        for notification in list(lead.admin_notifications):
            self.db.delete(notification)
        for message in list(lead.scheduled_messages):
            self.db.delete(message)

        self.db.flush()
        return lead

    def delete_lead(self, lead: Lead) -> None:
        self.db.delete(lead)
        self.db.flush()

    def get_bot_contact_state_map(self, lead_ids: list[int]) -> dict[int, str]:
        if not lead_ids:
            return {}

        rows = self.db.execute(
            select(LeadEvent.lead_id, LeadEvent.event_type, LeadEvent.event_payload, LeadEvent.created_at)
            .where(LeadEvent.lead_id.in_(lead_ids))
            .where(
                LeadEvent.event_type.in_(
                    [
                        'admin_message_sent',
                        'user_message',
                        'bot_message_sent',
                        'bot_started',
                        'miniapp_opened',
                        'app_resumed',
                    ]
                )
            )
            .order_by(LeadEvent.lead_id.asc(), LeadEvent.created_at.desc(), LeadEvent.id.desc())
        ).all()

        blocked_at: dict[int, object] = {}
        active_at: dict[int, object] = {}

        for lead_id, event_type, event_payload, created_at in rows:
            payload = event_payload or {}
            if event_type == 'admin_message_sent':
                status = str(payload.get('status') or '')
                blocked = bool(payload.get('blocked') is True)
                if blocked and lead_id not in blocked_at:
                    blocked_at[lead_id] = created_at
                if status == 'sent' and lead_id not in active_at:
                    active_at[lead_id] = created_at
                continue

            if lead_id not in active_at:
                active_at[lead_id] = created_at

        result: dict[int, str] = {}
        for lead_id in lead_ids:
            b_at = blocked_at.get(lead_id)
            a_at = active_at.get(lead_id)
            if b_at is not None and (a_at is None or b_at > a_at):
                result[lead_id] = 'blocked'
            elif a_at is not None:
                result[lead_id] = 'active'
            else:
                result[lead_id] = 'unknown'

        return result
