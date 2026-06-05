"""Application configuration via pydantic-settings."""
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",  # allow per-brand webhook secret vars
    )

    # Google Cloud
    google_cloud_project: str = "local-dev"
    gcs_bucket_name: str = "support-hub-attachments"
    cloud_tasks_queue: str = "projects/local-dev/locations/us-central1/queues/support-hub-ai"
    cloud_run_service_url: str = "http://localhost:8080"

    # Resend
    resend_api_key: str = "re_placeholder"

    # App
    app_env: str = "development"
    log_level: str = "INFO"

    def get_webhook_secret(self, env_var_name: str) -> str | None:
        """Look up a per-brand webhook secret by env var name."""
        return os.environ.get(env_var_name)


@lru_cache
def get_settings() -> Settings:
    return Settings()
