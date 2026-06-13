import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class KnowledgeLayer(SQLModel, table=True):
    __tablename__ = "knowledge_layers"

    muse_id: str = Field(primary_key=True, foreign_key="muses.id")
    synthesis: str = ""
    glossary: list = Field(default_factory=list, sa_column=Column(JSON))   # [{term, definition}]
    gaps: list = Field(default_factory=list, sa_column=Column(JSON))       # [str]
    status: str = "idle"       # idle | building | ready | failed
    error: Optional[str] = None
    resource_count: int = 0    # how many resources were embedded on last build
    built_at: Optional[datetime] = None


class KnowledgeLayerRead(SQLModel):
    muse_id: str
    synthesis: str
    glossary: list
    gaps: list
    status: str
    error: Optional[str]
    resource_count: int
    built_at: Optional[datetime]
