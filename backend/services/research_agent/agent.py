"""
Research Agent orchestrator.

Called by the arq worker as:
    await agent.run(muse_id=..., job_id=..., redis_conn=ctx["redis"])

Progress is published to Redis channel `job_progress:{job_id}` so the
FastAPI WebSocket endpoint can forward it to connected browser clients.
"""

import json
from datetime import datetime
from sqlmodel import Session

from models.database import engine
from models.muse import Muse
from models.resource import Resource
from models.job import BackgroundJob

from services.research_agent import planner, searcher, evaluator, curator


async def _set_job(job_id: str, progress: int, message: str, status: str = "running") -> None:
    with Session(engine) as session:
        job = session.get(BackgroundJob, job_id)
        if not job:
            return
        job.progress = progress
        job.status_message = message
        job.status = status
        if status in ("complete", "failed"):
            job.completed_at = datetime.utcnow()
        session.add(job)
        session.commit()


async def _pub(redis_conn, job_id: str, payload: dict) -> None:
    await redis_conn.publish(f"job_progress:{job_id}", json.dumps(payload))


async def run(muse_id: str, job_id: str, redis_conn) -> None:
    # ── Load muse ────────────────────────────────────────────────────────────
    with Session(engine) as session:
        muse = session.get(Muse, muse_id)
        if not muse:
            await _set_job(job_id, 0, "Muse not found", "failed")
            return
        name, description, level = muse.name, muse.description, muse.knowledge_level

    try:
        # ── 1. Plan (0 → 15 %) ───────────────────────────────────────────────
        await _set_job(job_id, 5, "Planning research…")
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 5, "step": "Planning research…"})

        plan = await planner.generate_research_plan(name, description, level)
        subtopics = plan.get("subtopics", [])

        await _set_job(job_id, 15, f"Research plan ready — {len(subtopics)} subtopics")
        await _pub(redis_conn, job_id, {
            "type": "plan_ready",
            "progress": 15,
            "subtopics": [s["name"] for s in subtopics],
        })

        # ── 2. Search (15 → 50 %) ────────────────────────────────────────────
        all_results: list[dict] = []
        for i, subtopic in enumerate(subtopics):
            pct = 15 + int((i / max(len(subtopics), 1)) * 35)
            await _set_job(job_id, pct, f"Searching: {subtopic['name']}")
            await _pub(redis_conn, job_id, {
                "type": "searching",
                "progress": pct,
                "subtopic": subtopic["name"],
                "index": i,
                "total": len(subtopics),
            })
            results = await searcher.search_queries(subtopic["queries"])
            all_results.extend(results)

        await _set_job(job_id, 50, f"Found {len(all_results)} candidates, evaluating quality…")
        await _pub(redis_conn, job_id, {
            "type": "progress",
            "progress": 50,
            "step": f"Found {len(all_results)} candidates — evaluating quality…",
        })

        # ── 3. Evaluate (50 → 75 %) ──────────────────────────────────────────
        accepted = await evaluator.evaluate_sources(all_results, name, description, level)

        await _set_job(job_id, 75, f"Kept {len(accepted)} quality sources, curating final set…")
        await _pub(redis_conn, job_id, {
            "type": "progress",
            "progress": 75,
            "step": f"Kept {len(accepted)} quality sources — curating final set…",
        })

        # ── 4. Curate (75 → 90 %) ────────────────────────────────────────────
        result = await curator.curate_and_report(accepted, plan, name, description)
        selected = result["selected"]
        report = result["report"]

        await _set_job(job_id, 90, f"Saving {len(selected)} resources…")
        await _pub(redis_conn, job_id, {
            "type": "progress",
            "progress": 90,
            "step": f"Saving {len(selected)} resources…",
        })

        # ── 5. Persist (90 → 100 %) ──────────────────────────────────────────
        with Session(engine) as session:
            for item in selected:
                session.add(Resource(
                    muse_id=muse_id,
                    title=item["title"] or item["url"],
                    source_type="url",
                    source_url=item["url"],
                    raw_content=item.get("raw_content") or item.get("content", ""),
                    summary=item.get("content"),   # Tavily snippet as preview summary
                    origin="research_agent",
                    approved=False,   # requires user review
                    status="ready",
                ))

            job = session.get(BackgroundJob, job_id)
            if job:
                job.progress = 100
                job.status = "complete"
                job.status_message = f"Complete — {len(selected)} resources ready for review"
                job.result = {
                    "resource_count": len(selected),
                    "coverage_summary": report.get("coverage_summary", ""),
                    "gaps": report.get("gaps", []),
                }
                job.completed_at = datetime.utcnow()
                session.add(job)

            muse_obj = session.get(Muse, muse_id)
            if muse_obj:
                muse_obj.agent_status = "complete"
                muse_obj.resource_count = len(selected)
                session.add(muse_obj)

            session.commit()

        await _pub(redis_conn, job_id, {
            "type": "complete",
            "progress": 100,
            "resource_count": len(selected),
            "coverage_summary": report.get("coverage_summary", ""),
            "gaps": report.get("gaps", []),
        })

    except Exception as exc:
        error_msg = str(exc)
        await _set_job(job_id, 0, f"Error: {error_msg}", "failed")
        await _pub(redis_conn, job_id, {"type": "error", "message": error_msg})

        with Session(engine) as session:
            muse_obj = session.get(Muse, muse_id)
            if muse_obj:
                muse_obj.agent_status = "failed"
                session.add(muse_obj)
            session.commit()

        raise
