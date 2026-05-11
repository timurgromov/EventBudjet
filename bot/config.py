from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    telegram_bot_token: str = '123456:TEST_TOKEN'
    bot_admin_chat_id: int | None = None
    mini_app_url: str = 'https://example.com'
    bot_dry_run: bool = True
    bot_event_poll_interval_seconds: int = 10
    bot_event_batch_delay_seconds: int = 90
    bot_startup_retry_seconds: int = 5
    bot_telegram_proxy_url: str | None = None
    bot_reminder_enabled: bool = False
    bot_reminder_dry_run: bool = False
    bot_reminder_check_interval_seconds: int = 300
    bot_reminder_max_per_run: int = 30
    bot_reminder_cooldown_days: int = 10
    bot_reminder_timezone: str = 'Europe/Moscow'
    bot_reminder_send_hour_start: int = Field(default=10, ge=0, le=23)
    bot_reminder_send_hour_end: int = Field(default=22, ge=0, le=23)
    incoming_request_digest_enabled: bool = False
    incoming_request_digest_chat_id: int | None = None
    incoming_request_digest_interval_days: int = Field(default=3, ge=1)
    incoming_request_digest_check_interval_seconds: int = Field(default=300, ge=30)
    incoming_request_digest_send_hour: int = Field(default=11, ge=0, le=23)
    incoming_request_digest_timezone: str = 'Europe/Moscow'

    database_url: str = 'postgresql+psycopg://postgres:postgres@postgres:5432/wedding_calculator'

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    @field_validator('incoming_request_digest_chat_id', mode='before')
    @classmethod
    def normalize_optional_chat_id(cls, value: object) -> object:
        if value is None or value == '':
            return None
        return value


settings = Settings()
