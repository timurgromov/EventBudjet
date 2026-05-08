from datetime import date, datetime

from pydantic import BaseModel, field_validator, model_validator


class IncomingRequestBase(BaseModel):
    source: str | None = None
    event_date: date | None = None
    last_contact_date: date | None = None
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
    source: str
    event_date: date | None = None
    last_contact_date: date | None = None
    comment: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    needs_follow_up: bool


class IncomingRequestListResponse(BaseModel):
    requests: list[IncomingRequestRead]
