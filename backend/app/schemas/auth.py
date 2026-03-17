from pydantic import BaseModel, Field


class TelegramInitRequest(BaseModel):
    init_data: str = Field(min_length=1)


class TelegramInitResponse(BaseModel):
    user_id: int
    telegram_id: int
    is_new_user: bool
    visits_count: int
