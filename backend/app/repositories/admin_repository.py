from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session

from app.models.admin_notification import AdminNotification
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
