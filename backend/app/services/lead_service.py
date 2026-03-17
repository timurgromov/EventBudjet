from sqlalchemy.orm import Session

from app.models.enums import LeadStatus
from app.models.lead import Lead
from app.repositories.lead_repository import LeadRepository
from app.schemas.lead import LeadCreate, LeadUpdate
from app.services.event_service import EventService


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
        self.events.write_event(lead.id, 'lead_created', {'user_id': user_id})
        self.events.write_event(lead.id, 'profile_started', {'user_id': user_id})

        if self._is_profile_completed(lead) and not self.events.has_event(lead.id, 'profile_completed'):
            self.events.write_event(lead.id, 'profile_completed', {'user_id': user_id})

        self.db.commit()
        self.db.refresh(lead)
        return lead

    def update_user_lead(self, lead: Lead, payload: LeadUpdate) -> Lead:
        data = payload.model_dump(exclude_unset=True)
        updated = self.leads.update(lead=lead, data=data)

        self.events.write_event(updated.id, 'profile_updated', {'updated_fields': sorted(list(data.keys()))})
        if self._is_profile_completed(updated) and not self.events.has_event(updated.id, 'profile_completed'):
            self.events.write_event(updated.id, 'profile_completed', {'user_id': updated.user_id})

        self.db.commit()
        self.db.refresh(updated)
        return updated

    @staticmethod
    def _is_profile_completed(lead: Lead) -> bool:
        has_identity = bool(lead.role and lead.city)
        has_context = bool(lead.venue_status and lead.guests_count is not None)
        has_date_signal = bool(lead.wedding_date_exact or lead.wedding_date_mode or lead.season or lead.next_year_flag)
        return has_identity and has_context and has_date_signal
