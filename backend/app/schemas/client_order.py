from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


class ClientOrderItemBase(BaseModel):
    item_type: str
    category_code: str | None = None
    title: str
    amount: Decimal = Field(gt=0)
    position: int | None = Field(default=None, ge=0)


class ClientOrderItemCreate(ClientOrderItemBase):
    pass


class ClientOrderItemUpdate(BaseModel):
    category_code: str | None = None
    title: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    position: int | None = Field(default=None, ge=0)

    @model_validator(mode='after')
    def at_least_one_field(self):
        if self.category_code is None and self.title is None and self.amount is None and self.position is None:
            raise ValueError('at least one field must be provided')
        return self


class ClientOrderItemRead(BaseModel):
    id: int
    order_id: int
    item_type: str
    category_code: str | None = None
    title: str
    amount: Decimal
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class ClientOrderBase(BaseModel):
    lead_id: int | None = None
    client_name: str | None = None
    event_title: str | None = None
    event_date: date | None = None
    contract_date: date | None = None
    source: str | None = None
    status: str | None = None
    comment: str | None = None

    @field_validator('event_date', 'contract_date', mode='before')
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


class ClientOrderCreate(ClientOrderBase):
    client_name: str
    event_date: date
    contract_date: date


class ClientOrderUpdate(ClientOrderBase):
    @model_validator(mode='after')
    def at_least_one_field(self):
        if (
            self.lead_id is None
            and self.client_name is None
            and self.event_title is None
            and self.event_date is None
            and self.contract_date is None
            and self.source is None
            and self.status is None
            and self.comment is None
        ):
            raise ValueError('at least one field must be provided')
        return self


class ClientOrderRead(BaseModel):
    id: int
    lead_id: int | None = None
    order_code: str | None = None
    client_name: str
    event_title: str | None = None
    event_date: date | None = None
    contract_date: date | None = None
    source: str | None = None
    status: str
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
    revenue: Decimal
    total_costs: Decimal
    profit: Decimal
    margin: Decimal


class ClientOrderDetailResponse(BaseModel):
    order: ClientOrderRead
    items: list[ClientOrderItemRead]


class ClientOrderListResponse(BaseModel):
    orders: list[ClientOrderRead]


class ClientOrderSummaryResponse(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    orders_count: int
    low_margin_orders_count: int
    total_revenue: Decimal
    total_costs: Decimal
    total_profit: Decimal
    average_margin: Decimal
    average_profit_per_order: Decimal


class MarginCalculatorOrderCreateRequest(BaseModel):
    client_name: str
    event_title: str | None = None
    event_date: date
    contract_date: date
    source: str | None = None
    status: str | None = None
    comment: str | None = None
    lead_id: int | None = None
    base_package: Decimal = Field(default=Decimal('0'), ge=0)
    extra_equipment: Decimal = Field(default=Decimal('0'), ge=0)
    extra_hours: Decimal = Field(default=Decimal('0'), ge=0)
    extra_hour_rate: Decimal = Field(default=Decimal('0'), ge=0)
    dj_payout: Decimal = Field(default=Decimal('0'), ge=0)
    ads_cost: Decimal = Field(default=Decimal('0'), ge=0)
    other_costs: Decimal = Field(default=Decimal('0'), ge=0)

    @field_validator('event_date', 'contract_date', mode='before')
    @classmethod
    def normalize_margin_dates(cls, value: object) -> object:
        return ClientOrderBase.normalize_date(value)
