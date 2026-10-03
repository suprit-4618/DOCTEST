import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DB_FILE = BACKEND_DIR / "mcq_selftest.db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "MCQ Self-Test API"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Database (defaults to absolute path to mcq_selftest.db inside backend directory)
    DATABASE_URL: str = f"sqlite:///{DB_FILE.as_posix()}"

    # Storage & Ingestion Settings
    STORAGE_DIR: str = str(BACKEND_DIR / "storage")
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    MAX_PAGE_COUNT: int = 150
    PDF_RENDER_DPI: int = 150
    IMAGE_MAX_DIMENSION: int = 2000

    # AI / LLM Configuration
    DEFAULT_LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3-flash-preview"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Optional App Access Password for public hosting
    APP_PASSWORD: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure base storage directory exists
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
