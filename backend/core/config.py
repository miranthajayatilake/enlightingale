from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI APIs
    ANTHROPIC_API_KEY: str = ""
    TAVILY_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Database — swap to postgresql://... for AWS
    DATABASE_URL: str = "sqlite:///data/db/enlightingale.db"

    # Vector store
    VECTOR_STORE_BACKEND: Literal["chroma"] = "chroma"
    CHROMA_DB_PATH: str = "./data/chroma"

    # File storage — swap to "s3" for AWS
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    FILES_PATH: str = "./data/files"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""

    # Queue
    REDIS_URL: str = "redis://redis:6379"

    # Dev/testing only — when true, the Research Agent does a single 1-result search and
    # skips planning/evaluation/curation, then continues the normal pipeline. Saves time +
    # API cost while iterating. NEVER enable in production (you get 1-source Canvases).
    TESTING_MODE: bool = False


settings = Settings()
