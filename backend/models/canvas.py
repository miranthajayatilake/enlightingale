import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from pydantic import BaseModel


def _uuid() -> str:
    return str(uuid.uuid4())


# Block-type palette the planner composes from (v0.4). The frontend renders one
# component per type and falls back to prose for anything unknown, so this set is
# guidance for generation, not a hard rendering constraint.
CANVAS_SECTION_TYPES = {
    "hero",
    "prose",
    "key_concepts",
    "timeline",
    "comparison",
    "stat_band",
    "resource_spotlight",
    "data_sources",
    "gaps",
    "takeaways",
}


class CanvasSection(BaseModel):
    """One block in the free-form Canvas (v0.4). Carries visual `data`, a `layout`
    hint, and the `anchors` (addressable sub-units) the Mentor can highlight or be
    asked to explain. Narration is no longer baked in here — it lives in the
    Walkthrough Plan, authored after the page exists (see PRD v0.4 §3, KD2)."""

    id: str
    type: str
    title: str
    layout: dict = {}            # {width, emphasis, columns} — visual rhythm
    data: dict = {}              # shape depends on `type`
    anchors: list[str] = []      # addressable ids within this block (block id + sub-ids)
    order: int
    narration: str = ""          # legacy; empty for v0.4 canvases


class MuseCanvas(SQLModel, table=True):
    __tablename__ = "muse_canvases"

    muse_id: str = Field(primary_key=True, foreign_key="muses.id")
    sections: list = Field(default_factory=list, sa_column=Column(JSON))  # typed sections (legacy) OR node tree (v0.4.2)
    theme: dict = Field(default_factory=dict, sa_column=Column(JSON))     # per-Muse visual theme (v0.4)
    walkthrough: dict = Field(default_factory=dict, sa_column=Column(JSON))  # Mentor's Walkthrough Plan {stops:[...]} (v0.4 Phase B)
    format: str = ""                # "" = legacy typed sections | "nodes/v1" = unstructured node tree (v0.4.2)
    status: str = "idle"            # idle | building | ready | stale | failed
    error: Optional[str] = None
    source_signature: str = ""      # fingerprint of inputs at build time; drives staleness
    built_at: Optional[datetime] = None


class MuseCanvasRead(SQLModel):
    muse_id: str
    sections: list
    theme: dict = {}
    walkthrough: dict = {}
    format: str = ""
    status: str
    error: Optional[str]
    source_signature: str
    built_at: Optional[datetime]
    stale: bool = False             # computed at read time: current signature != stored
