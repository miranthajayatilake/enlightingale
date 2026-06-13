import logging
from sqlmodel import Session, select

from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer

logger = logging.getLogger(__name__)


async def maybe_enqueue_kl_build(muse_id: str, arq_conn, session: Session) -> None:
    """Enqueue a KL build unless one is already queued/running for this Muse."""
    active = session.exec(
        select(BackgroundJob).where(
            BackgroundJob.muse_id == muse_id,
            BackgroundJob.job_type == "knowledge_layer",
            BackgroundJob.status.in_(["queued", "running"]),
        )
    ).first()
    if active:
        logger.debug("KL build debounced for muse %s — job %s already %s", muse_id, active.id, active.status)
        return

    kl = session.get(KnowledgeLayer, muse_id)
    if not kl:
        kl = KnowledgeLayer(muse_id=muse_id, status="building")
        session.add(kl)
    else:
        kl.status = "building"
        session.add(kl)

    job = BackgroundJob(muse_id=muse_id, job_type="knowledge_layer")
    session.add(job)
    session.commit()
    session.refresh(job)

    try:
        await arq_conn.enqueue_job("run_build_knowledge_layer", muse_id=muse_id, job_id=job.id)
        logger.info("KL build enqueued for muse %s — job %s", muse_id, job.id)
    except Exception as exc:
        logger.error("Failed to enqueue KL build for muse %s: %s — rolling back", muse_id, exc)
        # Undo the DB changes so the next trigger can retry cleanly.
        job.status = "failed"
        job.status_message = f"Enqueue failed: {exc}"
        kl.status = "idle"
        session.add(job)
        session.add(kl)
        session.commit()
        raise
