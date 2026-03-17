from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lead_event import LeadEvent


class LeadEventRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, lead_id: int, event_type: str, event_payload: dict | None = None) -> LeadEvent:
        event = LeadEvent(lead_id=lead_id, event_type=event_type, event_payload=event_payload)
        self.db.add(event)
        return event

    def exists_for_lead(self, lead_id: int, event_type: str) -> bool:
        stmt = select(LeadEvent.id).where(LeadEvent.lead_id == lead_id, LeadEvent.event_type == event_type).limit(1)
        return self.db.execute(stmt).first() is not None
