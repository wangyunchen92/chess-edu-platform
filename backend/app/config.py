"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    DATABASE_URL: str = "sqlite:///./data.db"

    # JWT
    JWT_SECRET: str = "your-256-bit-secret-key-change-in-production"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    # LLM
    LLM_API_KEY: str = ""
    LLM_API_BASE_URL: str = "https://ark.cn-beijing.volces.com/api/v3"
    LLM_MODEL_REVIEW: str = "doubao-pro-xxxxx"
    LLM_MODEL_SIMPLE: str = "doubao-lite-xxxxx"
    LLM_MONTHLY_BUDGET_CNY: int = 1000

    # OSS
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET: str = "chess-edu"
    OSS_ENDPOINT: str = "oss-cn-hangzhou.aliyuncs.com"

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
