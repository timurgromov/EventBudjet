from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = 'Wedding Calculator API'
    app_host: str = '127.0.0.1'
    app_port: int = 8000

    # Mini App access defaults can be overridden via CORS_ALLOW_ORIGINS.
    cors_allow_origins: list[str] = Field(default_factory=lambda: ['*'])
    telegram_bot_token: str = 'test_bot_token'
    admin_api_token: str = 'change-me-admin-token'

    database_url: str = 'postgresql+psycopg://postgres:postgres@localhost:5432/wedding_calculator'

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')


settings = Settings()
