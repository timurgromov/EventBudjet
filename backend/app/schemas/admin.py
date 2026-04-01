from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel

from app.schemas.expense import ExpenseRead
from app.schemas.lead import LeadRead


class AdminLeadListItem(BaseModel):
    lead_id: int
    name: str | None
    username: str | None
    role: str | None
    city: str | None
    wedding_date_exact: date | None
    season: str | None
    guests_count: int | None
    total_budget: Decimal | None
    lead_status: str | None
    last_seen_at: datetime | None
    source: str | None
    source_label: str | None = None
    bot_contact_state: str | None = None


class AdminLeadListResponse(BaseModel):
    leads: list[AdminLeadListItem]


class AdminUserRead(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    last_seen_at: datetime | None


class AdminLeadEventRead(BaseModel):
    id: int
    lead_id: int
    event_type: str
    event_payload: dict[str, Any] | None
    created_at: datetime

    model_config = {'from_attributes': True}


class AdminLeadDetailResponse(BaseModel):
    lead: LeadRead
    source_label: str | None = None
    user: AdminUserRead
    expenses: list[ExpenseRead]
    recent_events: list[AdminLeadEventRead]


class AdminLeadEventsResponse(BaseModel):
    lead_id: int
    events: list[AdminLeadEventRead]


class AdminNotificationRead(BaseModel):
    id: int
    lead_id: int
    notification_type: str
    priority: str | None
    status: str
    sent_at: datetime | None
    created_at: datetime
    telegram_id: int | None
    username: str | None


class AdminNotificationsResponse(BaseModel):
    notifications: list[AdminNotificationRead]


class AdminDirectMessageRequest(BaseModel):
    text: str


class AdminDirectMessageResponse(BaseModel):
    lead_id: int
    telegram_id: int
    status: str


class AdminLeadActionResponse(BaseModel):
    lead_id: int
    status: str


class AdminLeadSourceRead(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    is_archived: bool
    leads_count: int
    created_at: datetime
    updated_at: datetime


class AdminLeadSourcesResponse(BaseModel):
    sources: list[AdminLeadSourceRead]


class AdminLeadSourceCreateRequest(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class AdminLeadSourceActionResponse(BaseModel):
    source_id: int
    status: str
