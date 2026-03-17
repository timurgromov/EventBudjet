from sqlalchemy.orm import Session

from app.repositories.lead_event_repository import LeadEventRepository
from app.services.event_types import EventType


class EventService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = LeadEventRepository(db)

    @staticmethod
    def _normalize_event_type(event_type: EventType | str) -> str:
        if isinstance(event_type, EventType):
            return event_type.value
        if event_type in {event.value for event in EventType}:
            return event_type
        raise ValueError(f'unsupported event type: {event_type}')

    def write_event(self, lead_id: int, event_type: EventType | str, event_payload: dict | None = None) -> None:
        normalized = self._normalize_event_type(event_type)
        self.repo.create(lead_id=lead_id, event_type=normalized, event_payload=event_payload)

    def has_event(self, lead_id: int, event_type: EventType | str) -> bool:
        normalized = self._normalize_event_type(event_type)
        return self.repo.exists_for_lead(lead_id=lead_id, event_type=normalized)
