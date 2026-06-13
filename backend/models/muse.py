import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


def _uuid() -> str:
    return str(uuid.uuid4())


class MuseBase(SQLModel):
    name: str
    description: str
    knowledge_level: str = "beginner"
    cover_emoji: Optional[str] = None


class Muse(MuseBase, table=True):
    __tablename__ = "muses"

    id: str = Field(default_factory=_uuid, primary_key=True)
    status: str = "active"           # active | archived
    agent_status: str = "idle"       # idle | running | complete | failed
    resource_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MuseCreate(MuseBase):
    pass


class MuseUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    knowledge_level: Optional[str] = None
    cover_emoji: Optional[str] = None
    status: Optional[str] = None


class MuseRead(MuseBase):
    id: str
    status: str
    agent_status: str
    resource_count: int
    created_at: datetime
    updated_at: datetime
