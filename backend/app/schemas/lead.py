from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.schemas.expense import ExpenseRead


class LeadBase(BaseModel):
    role: str | None = None
    city: str | None = None
    venue_status: str | None = None
    venue_name: str | None = None
    wedding_date_exact: date | None = None
    wedding_date_mode: str | None = None
    season: str | None = None
    next_year_flag: bool | None = None
    guests_count: int | None = None
    source: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    partner_code: str | None = None

    @field_validator('wedding_date_exact', mode='before')
    @classmethod
    def normalize_wedding_date_exact(cls, value: object) -> object:
        if value is None or value == '':
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None
            try:
                return date.fromisoformat(raw)
            except ValueError:
                pass
            try:
                normalized = raw.replace('Z', '+00:00')
                return datetime.fromisoformat(normalized).date()
            except ValueError:
                return value
        return value


class LeadCreate(LeadBase):
    pass


class LeadUpdate(LeadBase):
    pass


class LeadRead(LeadBase):
    id: int
    user_id: int
    total_budget: Decimal | None = None
    lead_status: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class LeadCalculateResponse(BaseModel):
    lead_id: int
    total_budget: Decimal


class LeadActionTrackRequest(BaseModel):
    action: str
    source: str | None = None
    href: str | None = None


class LeadProgressResponse(BaseModel):
    lead: LeadRead | None
    expenses: list[ExpenseRead]
    total_budget: Decimal | None
    lead_status: str | None
