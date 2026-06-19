"""Canvas generator (arq job body) — v0.4.2: compose the unstructured node-tree page.

Phase A: one structured pass produces a free-form tree of presentation primitives
(no topic-semantic section types, no hero/takeaways spine — PRD v0.4.2). The generator
assigns a stable id to every node (the id IS its anchor) and persists the tree with
`format="nodes/v1"`.

Phase B: the Mentor reads the finished page and authors the Walkthrough Plan
(decoupled teaching — PRD v0.4 §3). Fully wrapped in try/except with a DB failure path.
"""

import json
from datetime import datetime

from redis.asyncio import Redis
from sqlmodel import Session, select

from models.canvas import MuseCanvas
from models.database import engine
from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer
from models.muse import Muse
from models.resource import Resource
from services.canvas.planner import generate_document
from services.canvas.prompts import CONTAINER_KINDS, NODE_KINDS
from services.canvas.signature import compute_source_signature
from services.canvas.walkthrough import plan_walkthrough
from core.logging import logger

_LEVEL_NOTE = {
    "beginner": "Brand-new to this topic. Start from first principles, plain language, everyday analogies.",
    "some": "Knows the basics. Build on that foundation and connect ideas.",
    "familiar": "Solid existing knowledge. Focus on nuance, depth, and synthesis.",
}


async def _publish(redis: Redis, job_id: str, progress: int, message: str, status: str | None = None) -> None:
    payload = {"progress": progress, "status_message": message}
    if status:
        payload["status"] = status
    await redis.publish(f"job_progress:{job_id}", json.dumps(payload))


def _mark_canvas(muse_id: str, **fields) -> None:
    with Session(engine) as session:
        canvas = session.get(MuseCanvas, muse_id)
        if not canvas:
            canvas = MuseCanvas(muse_id=muse_id)
            session.add(canvas)
        for k, v in fields.items():
            setattr(canvas, k, v)
        session.commit()


async def _fail(muse_id: str, job_id: str, message: str, redis: Redis) -> None:
    _mark_canvas(muse_id, status="failed", error=message)
    with Session(engine) as session:
        job = session.get(BackgroundJob, job_id)
        if job:
            job.status = "failed"
            job.status_message = message
            job.error = message
            job.completed_at = datetime.utcnow()
            session.add(job)
            session.commit()
    await _publish(redis, job_id, 0, message, status="failed")


def _assign_ids(raw_nodes: list, parent_id: str | None = None) -> list[dict]:
    """Assign a stable id to every node (top-level `n{i}`, children `{parent}.{i}`) and
    keep only well-formed nodes with a known kind. The id is the node's `data-anchor`."""
    out: list[dict] = []
    for i, node in enumerate(raw_nodes):
        if not isinstance(node, dict):
            continue
        kind = node.get("kind")
        if not isinstance(kind, str) or kind not in NODE_KINDS:
            continue
        node_id = f"{parent_id}.{i}" if parent_id else f"n{i}"
        clean = {k: v for k, v in node.items() if k != "children"}
        clean["id"] = node_id
        if kind in CONTAINER_KINDS and isinstance(node.get("children"), list):
            kids = _assign_ids(node["children"], node_id)
            if kids:
                clean["children"] = kids
        out.append(clean)
    return out


async def build_canvas(muse_id: str, job_id: str, redis_conn: Redis) -> None:
    try:
        with Session(engine) as session:
            job = session.get(BackgroundJob, job_id)
            if not job:
                return
            job.status = "running"
            session.add(job)
            session.commit()

        _mark_canvas(muse_id, status="building", error=None)
        await _publish(redis_conn, job_id, 5, "Loading knowledge…")

        with Session(engine) as session:
            muse = session.get(Muse, muse_id)
            kl = session.get(KnowledgeLayer, muse_id)
            if not muse or not kl or kl.status != "ready":
                await _fail(muse_id, job_id, "Knowledge Layer must be ready before building the Canvas", redis_conn)
                return

            muse_name = muse.name
            muse_description = muse.description or muse.name
            knowledge_level = muse.knowledge_level or "beginner"
            synthesis = kl.synthesis or ""
            glossary = kl.glossary or []
            gaps = kl.gaps or []

            resources = session.exec(
                select(Resource).where(
                    Resource.muse_id == muse_id,
                    Resource.approved == True,  # noqa: E712
                    Resource.status == "ready",
                )
            ).all()
            resource_titles = [r.title for r in resources]

        level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])
        glossary_terms = ", ".join(g["term"] for g in glossary[:25])

        # ── Phase A — compose the unstructured page (one node-tree pass) ─────────
        await _publish(redis_conn, job_id, 20, "Designing your page…")
        theme, raw_nodes = await generate_document(
            muse_name=muse_name,
            muse_description=muse_description,
            level_note=level_note,
            synthesis=synthesis,
            glossary_terms=glossary_terms,
            gaps=gaps,
            resource_titles=resource_titles,
        )
        nodes = _assign_ids(raw_nodes)
        if not nodes:
            await _fail(muse_id, job_id, "Canvas generation returned no usable nodes", redis_conn)
            return
        await _publish(redis_conn, job_id, 85, f"Composed your page — {len(nodes)} sections…")

        # ── Phase B — the Mentor reads the page and authors the Walkthrough Plan ──
        await _publish(redis_conn, job_id, 92, "Reading it through and planning your walkthrough…")
        walkthrough = await plan_walkthrough(muse_name, level_note, synthesis, nodes)

        signature = compute_source_signature(muse_id)
        _mark_canvas(
            muse_id,
            sections=nodes,
            theme=theme,
            walkthrough=walkthrough,
            format="nodes/v1",
            status="ready",
            error=None,
            source_signature=signature,
            built_at=datetime.utcnow(),
        )

        n_stops = len(walkthrough.get("stops", []))
        done_msg = f"Canvas ready — {len(nodes)} sections, {n_stops} walkthrough stops"
        with Session(engine) as session:
            job = session.get(BackgroundJob, job_id)
            if job:
                job.status = "complete"
                job.progress = 100
                job.status_message = done_msg
                job.completed_at = datetime.utcnow()
                session.add(job)
                session.commit()

        await _publish(redis_conn, job_id, 100, done_msg, status="complete")

    except Exception as exc:
        logger.exception("Canvas build failed")
        await _fail(muse_id, job_id, f"Canvas build failed: {exc}", redis_conn)
