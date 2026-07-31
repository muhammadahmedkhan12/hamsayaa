import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hamsayaa Backend Webhook Engine"
    API_V1_STR: str = "/api/v1"
    
    # Meta WhatsApp API Secrets
    WHATSAPP_APP_ID: str = ""
    WHATSAPP_APP_SECRET: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_TEST_NUMBER: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = "1229806946879920"
    WHATSAPP_VERIFY_TOKEN: str = "hamsayaa_webhook_verify_token_secure"
    
    # Gemini API Engine
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    
    # Database Connection
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""
    
    # Background Jobs (Redis / Celery)
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Per-society Defaults
    SOCIETY_PAYMENT_ACCOUNT_DETAILS: str = ""
    
    # Observability
    SENTRY_DSN: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
