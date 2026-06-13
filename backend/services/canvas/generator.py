"""Canvas generator (arq job body).

Two-pass, mirroring the lesson generator: a planner picks the ordered section types,
then each section is filled (data + narration) by a focused structured-output call and
validated against its type schema. Invalid sections are dropped rather than failing the
whole build. Fully wrapped in try/except with a DB failure path (the v0.1 P0 pattern).
"""

import json
from datetime import datetime

from redis.asyncio import Redis
from sqlmodel import Session, select

from models.canvas import MuseCanvas
from models.database import engine
from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer
from models.lesson import Lesson
from models.muse import Muse
from models.resource import Resource
from services.canvas.planner import _parse_json, plan_canvas
from services.canvas.prompts import SECTION_SCHEMAS, build_section_prompt
from services.canvas.signature import compute_source_signature
from core.claude import async_client
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


async def _generate_section(
    stub: dict, order: int, muse_name: str, level_note: str, context_block: str
) -> dict | None:
    section_type = stub["type"]
    prompt = build_section_prompt(
        section_type=section_type,
        title=stub["title"],
        intent=stub.get("intent", ""),
        muse_name=muse_name,
        level_note=level_note,
        context_block=context_block,
    )
    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        parsed = _parse_json(response.content[0].text)
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"Canvas section '{section_type}' returned unparseable JSON — dropping")
        return None

    data = parsed.get("data")
    narration = (parsed.get("narration") or "").strip()
    if not isinstance(data, dict) or not narration:
        logger.warning(f"Canvas section '{section_type}' missing data/narration — dropping")
        return None

    required = SECTION_SCHEMAS[section_type]["required"]
    if any(key not in data for key in required):
        logger.warning(f"Canvas section '{section_type}' missing required keys {required} — dropping")
        return None

    return {
        "id": f"sec_{order}_{section_type}",
        "type": section_type,
        "title": stub["title"],
        "narration": narration,
        "data": data,
        "order": order,
    }


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
            resource_lines = [f"{r.id} — {r.title}" for r in resources]

            lessons = session.exec(
                select(Lesson).where(Lesson.muse_id == muse_id).order_by(Lesson.order)
            ).all()
            lesson_titles = [l.title for l in lessons]

        level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])
        glossary_terms = ", ".join(g["term"] for g in glossary[:25])

        context_block = "\n".join([
            f"TOPIC: {muse_name}",
            f"GOAL: {muse_description}",
            "",
            "SYNTHESIS:",
            synthesis,
            "",
            f"KEY CONCEPTS: {glossary_terms or 'none'}",
            "",
            "GLOSSARY DEFINITIONS:",
            *[f"- {g['term']}: {g.get('definition', '')}" for g in glossary[:25]],
            "",
            f"KNOWLEDGE GAPS: {'; '.join(gaps[:10]) or 'none'}",
            "",
            "RESOURCES (id — title):",
            *resource_lines[:20],
        ])

        await _publish(redis_conn, job_id, 15, "Planning the presentation…")
        outline = await plan_canvas(
            muse_name=muse_name,
            muse_description=muse_description,
            level_note=level_note,
            synthesis=synthesis,
            glossary_terms=glossary_terms,
            gaps=gaps,
            resource_titles=resource_titles,
            lesson_titles=lesson_titles,
        )
        if not outline:
            await _fail(muse_id, job_id, "Canvas planner returned no sections", redis_conn)
            return

        n = len(outline)
        sections: list[dict] = []
        order = 0
        for i, stub in enumerate(outline):
            progress = 20 + int((i / n) * 70)
            await _publish(redis_conn, job_id, progress, f"Building section {i + 1} of {n}: {stub['title']}…")
            section = await _generate_section(stub, order, muse_name, level_note, context_block)
            if section:
                sections.append(section)
                order += 1

        if not sections:
            await _fail(muse_id, job_id, "No Canvas sections could be generated", redis_conn)
            return

        signature = compute_source_signature(muse_id)
        _mark_canvas(
            muse_id,
            sections=sections,
            status="ready",
            error=None,
            source_signature=signature,
            built_at=datetime.utcnow(),
        )

        with Session(engine) as session:
            job = session.get(BackgroundJob, job_id)
            if job:
                job.status = "complete"
                job.progress = 100
                job.status_message = f"Canvas ready — {len(sections)} sections"
                job.completed_at = datetime.utcnow()
                session.add(job)
                session.commit()

        await _publish(redis_conn, job_id, 100, f"Canvas ready — {len(sections)} sections", status="complete")

    except Exception as exc:
        logger.exception("Canvas build failed")
        await _fail(muse_id, job_id, f"Canvas build failed: {exc}", redis_conn)
