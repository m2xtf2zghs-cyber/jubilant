from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = Field(default="Bank Intel Platform", alias="APP_NAME")
    env: str = Field(default="dev", alias="ENV")
    database_url: str = Field(default="sqlite:///./bank_intel.db", alias="DATABASE_URL")
    upload_dir: str = Field(default="./data/uploads", alias="UPLOAD_DIR")
    export_dir: str = Field(default="./data/exports", alias="EXPORT_DIR")
    config_dir: str = Field(default="./app/config", alias="CONFIG_DIR")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    remote_parse_base_url: str | None = Field(default=None, alias="REMOTE_PARSE_BASE_URL")
    remote_parse_api_key: str | None = Field(default=None, alias="REMOTE_PARSE_API_KEY")
    remote_parse_timeout_sec: float = Field(default=180.0, alias="REMOTE_PARSE_TIMEOUT_SEC")
    enable_console: bool = Field(default=True, alias="ENABLE_CONSOLE")
    enforce_https_redirect: bool = Field(default=False, alias="ENFORCE_HTTPS_REDIRECT")
    trusted_hosts: str = Field(default="*", alias="TRUSTED_HOSTS")
    proxy_headers_enabled: bool = Field(default=True, alias="PROXY_HEADERS_ENABLED")
    proxy_trusted_ips: str = Field(default="*", alias="PROXY_TRUSTED_IPS")
    max_upload_mb: int = Field(default=50, alias="MAX_UPLOAD_MB")
    max_files_per_job: int = Field(default=12, alias="MAX_FILES_PER_JOB")
    auth_bearer_tokens: str | None = Field(default=None, alias="AUTH_BEARER_TOKENS")
    auth_exempt_paths: str = Field(default="/,/health,/api/health,/api/health/ready", alias="AUTH_EXEMPT_PATHS")
    audit_log_db_enabled: bool = Field(default=True, alias="AUDIT_LOG_DB_ENABLED")
    public_base_url: str | None = Field(default=None, alias="PUBLIC_BASE_URL")

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def export_path(self) -> Path:
        path = Path(self.export_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def config_path(self) -> Path:
        return Path(self.config_dir)

    @property
    def trusted_host_list(self) -> list[str]:
        return [item.strip() for item in self.trusted_hosts.split(",") if item.strip()]

    @property
    def proxy_trusted_ip_list(self) -> list[str]:
        return [item.strip() for item in self.proxy_trusted_ips.split(",") if item.strip()]

    @property
    def auth_token_list(self) -> list[str]:
        raw = self.auth_bearer_tokens or ""
        return [item.strip() for item in raw.split(",") if item.strip()]

    @property
    def exempt_path_list(self) -> list[str]:
        return [item.strip() for item in self.auth_exempt_paths.split(",") if item.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
