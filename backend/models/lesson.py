import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class Lesson(SQLModel, table=True):
    __tablename__ = "lessons"

    id: str = Field(default_factory=_uuid, primary_key=True)
    muse_id: str = Field(foreign_key="muses.id", index=True)
    order: int
    title: str
    content: str                             # Full markdown
    summary: str = ""
    key_concepts: list = Field(default_factory=list, sa_column=Column(JSON))
    quiz_questions: list = Field(default_factory=list, sa_column=Column(JSON))
    source_resource_ids: list = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LessonProgress(SQLModel, table=True):
    __tablename__ = "lesson_progress"

    id: str = Field(default_factory=_uuid, primary_key=True)
    lesson_id: str = Field(foreign_key="lessons.id", index=True)
    status: str = "not_started"              # not_started | in_progress | complete
    quiz_score: Optional[int] = None
    completed_at: Optional[datetime] = None
