import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from pydantic import BaseModel


def _uuid() -> str:
    return str(uuid.uuid4())


# Controlled block-type vocabulary (v0.2 M0.2.1). The frontend renders one
# component per type; the generator may only emit these.
CANVAS_SECTION_TYPES = {
    "hero",
    "prose",
    "key_concepts",
    "timeline",
    "comparison",
    "stat_band",
    "resource_spotlight",
    "gaps",
    "takeaways",
}


class CanvasSection(BaseModel):
    """One typed block in the Canvas. Carries visual `data` AND a spoken `narration`
    script — the separation is what keeps the page and the Mentor's voice in sync."""

    id: str
    type: str
    title: str
    narration: str        # what the Mentor speaks for this section; plain spoken language, no markdown
    data: dict            # shape depends on `type`
    order: int


class MuseCanvas(SQLModel, table=True):
    __tablename__ = "muse_canvases"

    muse_id: str = Field(primary_key=True, foreign_key="muses.id")
    sections: list = Field(default_factory=list, sa_column=Column(JSON))  # list[CanvasSection dict]
    status: str = "idle"            # idle | building | ready | stale | failed
    error: Optional[str] = None
    source_signature: str = ""      # fingerprint of inputs at build time; drives staleness
    built_at: Optional[datetime] = None


class MuseCanvasRead(SQLModel):
    muse_id: str
    sections: list
    status: str
    error: Optional[str]
    source_signature: str
    built_at: Optional[datetime]
    stale: bool = False             # computed at read time: current signature != stored
