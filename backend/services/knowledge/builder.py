"""
Knowledge Layer builder.

Steps:
  1. Re-summarize any approved resources that are missing summaries
  2. Extract key concepts per resource
  3. Embed all approved resources into ChromaDB
  4. Generate cross-resource synthesis
  5. Build concept glossary
  6. Analyze knowledge gaps
  7. Persist KnowledgeLayer + mark job complete
"""

import json
from datetime import datetime
from sqlmodel import Session, select

from models.database import engine
from models.muse import Muse
from models.resource import Resource
from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer
from vector_store.base import Chunk
from vector_store.chroma import get_vector_store
from services.ingest import summarizer as ingest_summarizer
from services.knowledge import concept_extractor, synthesizer, glossary as glossary_builder, gap_analyzer

_CHUNK_SIZE = 900    # chars — safely under all-MiniLM-L6-v2's 256-token limit
_CHUNK_OVERLAP = 150


def _chunk_text(text: str, resource_id: str, muse_id: str, title: str) -> list[Chunk]:
    text = text.strip()
    if not text:
        return []
    chunks, idx, i = [], 0, 0
    while i < len(text):
        piece = text[i : i + _CHUNK_SIZE].strip()
        if piece:
            chunks.append(Chunk(
                id=f"{resource_id}_chunk_{idx}",
                text=piece,
                resource_id=resource_id,
                muse_id=muse_id,
                metadata={"resource_title": title},
            ))
            idx += 1
        i += _CHUNK_SIZE - _CHUNK_OVERLAP
    return chunks


async def _pub(redis_conn, job_id: str, payload: dict) -> None:
    await redis_conn.publish(f"job_progress:{job_id}", json.dumps(payload))


async def build_knowledge_layer(muse_id: str, job_id: str, redis_conn) -> None:
    # ── Load muse + resources ────────────────────────────────────────────────
    with Session(engine) as session:
        muse = session.get(Muse, muse_id)
        if not muse:
            return
        name, description = muse.name, muse.description

        kl = session.get(KnowledgeLayer, muse_id)
        if not kl:
            kl = KnowledgeLayer(muse_id=muse_id)
            session.add(kl)
        kl.status = "building"
        kl.error = None

        job = session.get(BackgroundJob, job_id)
        if job:
            job.status = "running"
        session.commit()

        resources = session.exec(
            select(Resource).where(
                Resource.muse_id == muse_id,
                Resource.approved == True,  # noqa: E712
                Resource.status == "ready",
            )
        ).all()
        # Detach from session to use in later sessions
        resources = list(resources)
        for r in resources:
            session.expunge(r)

    try:
        vs = get_vector_store()

        # ── 1. Summarize resources missing summaries (5 → 25%) ──────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 5, "step": "Reading resources…"})
        for resource in resources:
            if not resource.summary and resource.raw_content:
                summary = await ingest_summarizer.summarize_resource(
                    resource.title, resource.raw_content, name
                )
                with Session(engine) as session:
                    r = session.get(Resource, resource.id)
                    if r:
                        r.summary = summary
                        session.commit()
                resource.summary = summary

        # ── 2. Extract key concepts per resource (25 → 45%) ─────────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 25, "step": "Extracting concepts…"})
        all_concepts: list[str] = []
        for resource in resources:
            if not resource.key_concepts and resource.raw_content:
                concepts = await concept_extractor.extract_concepts(
                    resource.title, resource.raw_content
                )
                with Session(engine) as session:
                    r = session.get(Resource, resource.id)
                    if r:
                        r.key_concepts = concepts
                        session.commit()
                resource.key_concepts = concepts
            all_concepts.extend(resource.key_concepts or [])

        # ── 3. Embed into ChromaDB (45 → 65%) ───────────────────────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 45, "step": "Building vector index…"})
        for resource in resources:
            if resource.raw_content:
                chunks = _chunk_text(resource.raw_content, resource.id, muse_id, resource.title)
                if chunks:
                    await vs.delete_resource(muse_id, resource.id)
                    await vs.add_chunks(muse_id, chunks)
                    with Session(engine) as session:
                        r = session.get(Resource, resource.id)
                        if r:
                            r.embedded = True
                            session.commit()

        # ── 4. Synthesize (65 → 80%) ─────────────────────────────────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 65, "step": "Synthesizing knowledge…"})
        summaries = [
            {"title": r.title, "summary": r.summary}
            for r in resources if r.summary
        ]
        synthesis = await synthesizer.synthesize(name, description, summaries)

        # ── 5. Glossary (80 → 92%) ───────────────────────────────────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 80, "step": "Building glossary…"})
        glossary = await glossary_builder.build_glossary(name, all_concepts)

        # ── 6. Gaps (92 → 100%) ──────────────────────────────────────────────
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 92, "step": "Analyzing gaps…"})
        gaps = await gap_analyzer.analyze_gaps(name, description, synthesis, glossary)

        # ── 7. Persist ───────────────────────────────────────────────────────
        with Session(engine) as session:
            kl = session.get(KnowledgeLayer, muse_id)
            if not kl:
                kl = KnowledgeLayer(muse_id=muse_id)
                session.add(kl)
            kl.synthesis = synthesis
            kl.glossary = glossary
            kl.gaps = gaps
            kl.status = "ready"
            kl.error = None
            kl.resource_count = len(resources)
            kl.built_at = datetime.utcnow()

            job_obj = session.get(BackgroundJob, job_id)
            if job_obj:
                job_obj.status = "complete"
                job_obj.progress = 100
                job_obj.status_message = "Knowledge layer ready"
                job_obj.completed_at = datetime.utcnow()

            session.commit()

        await _pub(redis_conn, job_id, {"type": "complete", "progress": 100})

        # Auto-trigger Canvas regeneration: the knowledge base just changed, so the
        # Overview's visual presentation (and what the Mentor teaches from it) must
        # refresh. Failure here must not fail the Knowledge Layer build.
        try:
            from models.canvas import MuseCanvas

            canvas_job_id = None
            with Session(engine) as session:
                # Skip if a Canvas build is already queued/running for this Muse.
                active = session.exec(
                    select(BackgroundJob).where(
                        BackgroundJob.muse_id == muse_id,
                        BackgroundJob.job_type == "canvas",
                        BackgroundJob.status.in_(["queued", "running"]),
                    )
                ).first()
                if not active:
                    canvas = session.get(MuseCanvas, muse_id)
                    if not canvas:
                        canvas = MuseCanvas(muse_id=muse_id)
                        session.add(canvas)
                    canvas.status = "building"
                    canvas.error = None

                    canvas_job = BackgroundJob(muse_id=muse_id, job_type="canvas")
                    session.add(canvas_job)
                    session.commit()
                    session.refresh(canvas_job)
                    canvas_job_id = canvas_job.id

            if canvas_job_id:
                await redis_conn.enqueue_job(
                    "run_build_canvas", muse_id=muse_id, job_id=canvas_job_id
                )
        except Exception as canvas_exc:
            await _pub(redis_conn, job_id, {"type": "progress", "progress": 100, "step": f"Canvas enqueue skipped: {canvas_exc}"})

    except Exception as exc:
        error_msg = f"Knowledge layer build failed: {exc}"
        with Session(engine) as session:
            kl = session.get(KnowledgeLayer, muse_id)
            if kl:
                kl.status = "failed"
                kl.error = str(exc)
                session.add(kl)
            job_obj = session.get(BackgroundJob, job_id)
            if job_obj:
                job_obj.status = "failed"
                job_obj.status_message = error_msg
                job_obj.error = str(exc)
                job_obj.completed_at = datetime.utcnow()
                session.add(job_obj)
            session.commit()

        await _pub(redis_conn, job_id, {"type": "error", "message": error_msg})
        raise
