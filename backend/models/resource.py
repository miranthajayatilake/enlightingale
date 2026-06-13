import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class Resource(SQLModel, table=True):
    __tablename__ = "resources"

    id: str = Field(default_factory=_uuid, primary_key=True)
    muse_id: str = Field(foreign_key="muses.id", index=True)
    title: str
    source_type: str                         # url | pdf | text | agent
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    raw_content: str = ""
    summary: Optional[str] = None
    key_concepts: list = Field(default_factory=list, sa_column=Column(JSON))
    origin: str = "user"                     # user | research_agent
    approved: bool = True
    status: str = "pending"                  # pending | processing | ready | failed
    embedded: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ResourceRead(SQLModel):
    id: str
    muse_id: str
    title: str
    source_type: str
    source_url: Optional[str]
    summary: Optional[str]
    key_concepts: list
    origin: str
    approved: bool
    status: str
    created_at: datetime
