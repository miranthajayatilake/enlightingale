from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session
from core.config import settings


def _ensure_db_dir() -> None:
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        # Extract path from sqlite:///path/to/file.db
        db_path = url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)


_ensure_db_dir()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
