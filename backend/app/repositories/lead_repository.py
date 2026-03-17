from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lead import Lead


class LeadRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> Lead | None:
        stmt = select(Lead).where(Lead.user_id == user_id).order_by(Lead.id.desc()).limit(1)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, user_id: int, data: dict) -> Lead:
        lead = Lead(user_id=user_id, **data)
        self.db.add(lead)
        self.db.flush()
        return lead

    def update(self, lead: Lead, data: dict) -> Lead:
        for key, value in data.items():
            setattr(lead, key, value)
        self.db.flush()
        return lead
