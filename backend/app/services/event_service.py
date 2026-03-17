from sqlalchemy.orm import Session

from app.repositories.lead_event_repository import LeadEventRepository


class EventService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LeadEventRepository(db)

    def write_event(self, lead_id: int, event_type: str, event_payload: dict | None = None) -> None:
        self.repo.create(lead_id=lead_id, event_type=event_type, event_payload=event_payload)

    def has_event(self, lead_id: int, event_type: str) -> bool:
        return self.repo.exists_for_lead(lead_id=lead_id, event_type=event_type)
