from pydantic import Field
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

    database_url: str = 'postgresql+psycopg://postgres:postgres@postgres:5432/wedding_calculator'

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')


settings = Settings()
