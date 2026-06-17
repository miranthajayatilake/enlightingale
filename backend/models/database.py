from pathlib import Path
from sqlalchemy import text
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


def run_migrations() -> None:
    """Additive schema migrations that SQLModel's create_all can't handle."""
    with engine.connect() as conn:
        # v0.3.1 — research_focus on Muse
        try:
            conn.execute(text("ALTER TABLE muses ADD COLUMN research_focus TEXT"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # v0.4 — theme on MuseCanvas (free-form, topic-tailored Canvas)
        try:
            conn.execute(text("ALTER TABLE muse_canvases ADD COLUMN theme TEXT DEFAULT '{}'"))
            conn.commit()
        except Exception:
            pass  # column already exists

        # v0.4 Phase B — walkthrough (Mentor's authored teaching plan) on MuseCanvas
        try:
            conn.execute(text("ALTER TABLE muse_canvases ADD COLUMN walkthrough TEXT DEFAULT '{}'"))
            conn.commit()
        except Exception:
            pass  # column already exists


def get_session():
    with Session(engine) as session:
        yield session
