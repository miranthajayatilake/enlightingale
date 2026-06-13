"""Source signature for Canvas staleness.

A Canvas is stale when the knowledge it was built from has changed. We fingerprint
the inputs — the Knowledge Layer build time, the set of approved+ready resources, and
the lesson set — so a no-op rebuild that produces identical inputs does not force a
needless Canvas regeneration.
"""

import hashlib

from sqlmodel import Session, select

from models.database import engine
from models.knowledge import KnowledgeLayer
from models.lesson import Lesson
from models.resource import Resource


def compute_source_signature(muse_id: str) -> str:
    with Session(engine) as session:
        kl = session.get(KnowledgeLayer, muse_id)
        kl_part = kl.built_at.isoformat() if kl and kl.built_at else "none"

        resources = session.exec(
            select(Resource).where(
                Resource.muse_id == muse_id,
                Resource.approved == True,  # noqa: E712
                Resource.status == "ready",
            )
        ).all()
        # Resource has no updated_at; id + status + approved captures add/remove/approve.
        res_parts = sorted(f"{r.id}:{r.status}:{int(r.approved)}" for r in resources)

        lessons = session.exec(select(Lesson).where(Lesson.muse_id == muse_id)).all()
        lesson_parts = sorted(l.id for l in lessons)

    raw = "|".join([kl_part, "::", *res_parts, "::", *lesson_parts])
    return hashlib.sha256(raw.encode()).hexdigest()
