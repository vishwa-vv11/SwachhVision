from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "SwachhVision"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://civicai_user:civicai_password@localhost:5432/civicai_db"
    )
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()
