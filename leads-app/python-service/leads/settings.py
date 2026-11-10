"""Environment settings, validated at first use (SPEC_00 5.2)."""

import base64
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parent.parent


def _b64_bytes(value: str, name: str, min_len: int, exact: bool = False) -> str:
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"{name} must be base64") from e
    if (exact and len(raw) != min_len) or len(raw) < min_len:
        raise ValueError(f"{name} must decode to {'exactly' if exact else 'at least'} {min_len} bytes")
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVICE_DIR / ".env",), env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = Field(validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_DSN"))
    celery_broker_url: str = "redis://127.0.0.1:6379/0"
    celery_result_backend: str = "redis://127.0.0.1:6379/1"
    celery_timezone: str = "Asia/Karachi"

    phone_hash_pepper: str
    phone_enc_key: str

    olx_access_token: str | None = None
    olx_id_token: str | None = None
    ilaan_auth_token: str | None = None
    ilaan_csrf_token: str | None = None

    resend_api_key: str | None = None
    email_from: str | None = None
    admin_alert_email: str | None = None

    playwright_headless: bool = True

    # Area conversion lives in config, not code (SPEC_01 3.1).
    marla_sqft: float = 225.0
    kanal_marla: float = 20.0

    # Portal sellers' numbers are purged this many days after we last saw their ad.
    phone_purge_days: int = 60

    db_pool_min: int = 1
    db_pool_max: int = 4
    write_batch_size: int = 100

    @field_validator("phone_hash_pepper")
    @classmethod
    def _pepper(cls, v: str) -> str:
        return _b64_bytes(v, "PHONE_HASH_PEPPER", 32)

    @field_validator("phone_enc_key")
    @classmethod
    def _enc_key(cls, v: str) -> str:
        return _b64_bytes(v, "PHONE_ENC_KEY", 32, exact=True)

    @field_validator("database_url")
    @classmethod
    def _dsn(cls, v: str) -> str:
        # Prisma-style "?schema=public" is not a libpq option.
        return v.split("?schema=")[0]


@lru_cache
def get_settings() -> Settings:
    return Settings()
