from sqlalchemy.orm import Session

from app.models.enums import LeadStatus
from app.models.lead import Lead
from app.repositories.lead_repository import LeadRepository
from app.schemas.lead import LeadCreate, LeadUpdate
from app.services.event_service import EventService
from app.services.event_types import EventType


class LeadService:
    def __init__(self, db: Session):
        self.db = db
        self.leads = LeadRepository(db)
        self.events = EventService(db)

    def get_user_lead(self, user_id: int) -> Lead | None:
        return self.leads.get_by_user_id(user_id)

    def create_user_lead(self, user_id: int, payload: LeadCreate) -> Lead:
        data = payload.model_dump(exclude_none=True)
        data.setdefault('lead_status', LeadStatus.ACTIVE)

        lead = self.leads.create(user_id=user_id, data=data)
        self.events.write_event(lead.id, EventType.BOT_STARTED, {'user_id': user_id})
        self.events.write_event(lead.id, EventType.LEAD_CREATED, {'user_id': user_id})
        self.events.write_event(lead.id, EventType.PROFILE_STARTED, {'user_id': user_id})

        if self._is_profile_completed(lead) and not self.events.has_event(lead.id, EventType.PROFILE_COMPLETED):
            self.events.write_event(lead.id, EventType.PROFILE_COMPLETED, {'user_id': user_id})

        self.db.commit()
        self.db.refresh(lead)
        return lead

    def update_user_lead(self, lead: Lead, payload: LeadUpdate) -> Lead:
        data = payload.model_dump(exclude_unset=True)
        updated = self.leads.update(lead=lead, data=data)

        self.events.write_event(updated.id, EventType.PROFILE_UPDATED, {'updated_fields': sorted(list(data.keys()))})
        if self._is_profile_completed(updated) and not self.events.has_event(updated.id, EventType.PROFILE_COMPLETED):
            self.events.write_event(updated.id, EventType.PROFILE_COMPLETED, {'user_id': updated.user_id})

        self.db.commit()
        self.db.refresh(updated)
        return updated

    def record_progress_entry(self, lead: Lead, expenses_count: int) -> None:
        if self.events.has_event(lead.id, EventType.MINIAPP_OPENED):
            event_type = EventType.APP_RESUMED
        else:
            event_type = EventType.MINIAPP_OPENED

        self.events.write_event(
            lead.id,
            event_type,
            {
                'user_id': lead.user_id,
                'expenses_count': expenses_count,
            },
        )
        self.db.commit()

    @staticmethod
    def _is_profile_completed(lead: Lead) -> bool:
        has_identity = bool(lead.role and lead.city)
        has_context = bool(lead.venue_status and lead.guests_count is not None)
        has_date_signal = bool(lead.wedding_date_exact or lead.wedding_date_mode or lead.season or lead.next_year_flag)
        return has_identity and has_context and has_date_signal
