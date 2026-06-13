import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class BackgroundJob(SQLModel, table=True):
    __tablename__ = "background_jobs"

    id: str = Field(default_factory=_uuid, primary_key=True)
    muse_id: str = Field(foreign_key="muses.id", index=True)
    job_type: str                            # research_agent | knowledge_layer | lesson_gen
    status: str = "queued"                  # queued | running | complete | failed
    progress: int = 0                        # 0–100
    status_message: str = ""
    result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class JobRead(SQLModel):
    id: str
    muse_id: str
    job_type: str
    status: str
    progress: int
    status_message: str
    error: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
