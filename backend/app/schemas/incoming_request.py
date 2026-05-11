from datetime import date, datetime

from pydantic import BaseModel, field_validator, model_validator


class IncomingRequestSourceBase(BaseModel):
    name: str | None = None
    source_type: str | None = None
    description: str | None = None


class IncomingRequestSourceCreate(IncomingRequestSourceBase):
    name: str


class IncomingRequestSourceRead(BaseModel):
    id: int
    name: str
    source_type: str
    description: str | None = None
    is_archived: bool
    requests_count: int
    signed_count: int
    rejected_count: int
    in_work_count: int
    conversion_rate: float
    created_at: datetime
    updated_at: datetime


class IncomingRequestSourcesResponse(BaseModel):
    sources: list[IncomingRequestSourceRead]


class IncomingRequestSourceActionResponse(BaseModel):
    source_id: int
    status: str


class IncomingRequestBase(BaseModel):
    source_id: int | None = None
    source: str | None = None
    event_date: date | None = None
    last_contact_date: date | None = None
    meeting_held: bool | None = None
    comment: str | None = None
    status: str | None = None

    @field_validator('event_date', 'last_contact_date', mode='before')
    @classmethod
    def normalize_date(cls, value: object) -> object:
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
                return value
        return value


class IncomingRequestCreate(IncomingRequestBase):
    source: str


class IncomingRequestUpdate(IncomingRequestBase):
    @model_validator(mode='after')
    def at_least_one_field(self):
        fields_set = self.model_fields_set
        if not fields_set:
            raise ValueError('at least one field must be provided')
        return self


class IncomingRequestRead(BaseModel):
    id: int
    source_id: int | None = None
    source: str
    source_name: str
    source_type: str | None = None
    event_date: date | None = None
    last_contact_date: date | None = None
    meeting_held: bool
    comment: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    needs_follow_up: bool


class IncomingRequestListResponse(BaseModel):
    requests: list[IncomingRequestRead]


class IncomingRequestSourceSummaryItem(BaseModel):
    source_id: int | None = None
    source_name: str
    source_type: str | None = None
    total_count: int
    signed_count: int
    rejected_count: int
    in_work_count: int
    meeting_count: int
    conversion_rate: float
    meeting_conversion_rate: float


class IncomingRequestSummaryResponse(BaseModel):
    total_count: int
    signed_count: int
    rejected_count: int
    in_work_count: int
    attention_count: int
    meeting_count: int
    conversion_rate: float
    meeting_conversion_rate: float
    sources: list[IncomingRequestSourceSummaryItem]
