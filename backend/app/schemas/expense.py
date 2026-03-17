from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class ExpenseCreate(BaseModel):
    category_code: str | None = None
    category_name: str | None = None
    amount: Decimal = Field(gt=0)


class ExpenseUpdate(BaseModel):
    category_code: str | None = None
    category_name: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)

    @model_validator(mode='after')
    def at_least_one_field(self):
        if self.category_code is None and self.category_name is None and self.amount is None:
            raise ValueError('at least one field must be provided')
        return self


class ExpenseRead(BaseModel):
    id: int
    lead_id: int
    category_code: str | None = None
    category_name: str
    amount: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}
