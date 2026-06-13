from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from models.database import get_session
from models.muse import Muse
from models.job import BackgroundJob, JobRead
from models.knowledge import KnowledgeLayer, KnowledgeLayerRead

router = APIRouter(prefix="/muses/{muse_id}/knowledge", tags=["knowledge"])


def _muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


@router.get("", response_model=KnowledgeLayerRead | None)
def get_knowledge_layer(muse_id: str, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    return session.get(KnowledgeLayer, muse_id)


@router.post("/build", response_model=JobRead, status_code=202)
async def build_knowledge(
    muse_id: str,
    request: Request,
    session: Session = Depends(get_session),
):
    _muse_or_404(muse_id, session)

    # Don't start a second build if one is already in flight — return the running job.
    existing = session.exec(
        select(BackgroundJob).where(
            BackgroundJob.muse_id == muse_id,
            BackgroundJob.job_type == "knowledge_layer",
            BackgroundJob.status.in_(["queued", "running"]),
        ).order_by(BackgroundJob.created_at.desc())
    ).first()
    if existing:
        return existing

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

    await request.app.state.arq_pool.enqueue_job(
        "run_build_knowledge_layer", muse_id=muse_id, job_id=job.id
    )
    return job
