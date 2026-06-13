from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from models.database import get_session
from models.muse import Muse
from models.job import BackgroundJob, JobRead
from models.resource import Resource, ResourceRead
from services.knowledge.autorebuild import maybe_enqueue_kl_build


class AgentRunBody(BaseModel):
    focus: Optional[str] = None


class AgentResultsRead(BaseModel):
    job: Optional[JobRead] = None
    resources: list[ResourceRead] = []
    report: Optional[dict] = None


router = APIRouter(prefix="/muses/{muse_id}/agent", tags=["research-agent"])


def _muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


def _latest_agent_job(muse_id: str, session: Session) -> BackgroundJob | None:
    return session.exec(
        select(BackgroundJob)
        .where(
            BackgroundJob.muse_id == muse_id,
            BackgroundJob.job_type == "research_agent",
        )
        .order_by(BackgroundJob.created_at.desc())  # type: ignore[arg-type]
    ).first()


@router.post("/run", response_model=JobRead, status_code=202)
async def run_agent(
    muse_id: str,
    body: AgentRunBody,
    request: Request,
    session: Session = Depends(get_session),
):
    muse = _muse_or_404(muse_id, session)

    job = BackgroundJob(muse_id=muse_id, job_type="research_agent")
    session.add(job)
    muse.agent_status = "running"
    session.add(muse)
    session.commit()
    session.refresh(job)

    await request.app.state.arq_pool.enqueue_job(
        "run_research_agent", muse_id=muse_id, job_id=job.id, focus=body.focus
    )
    return job


@router.get("/status", response_model=JobRead)
def agent_status(muse_id: str, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    job = _latest_agent_job(muse_id, session)
    if not job:
        raise HTTPException(status_code=404, detail="No agent job found for this Muse")
    return job


@router.get("/results", response_model=AgentResultsRead)
def agent_results(muse_id: str, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    job = _latest_agent_job(muse_id, session)
    resources = session.exec(
        select(Resource).where(
            Resource.muse_id == muse_id,
            Resource.origin == "research_agent",
        )
    ).all()
    return AgentResultsRead(
        job=JobRead.model_validate(job) if job else None,
        resources=[ResourceRead.model_validate(r) for r in resources],
        report=job.result if job else None,
    )


@router.post("/approve-all")
async def approve_all(muse_id: str, request: Request, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    pending = session.exec(
        select(Resource).where(
            Resource.muse_id == muse_id,
            Resource.approved == False,  # noqa: E712
        )
    ).all()
    for r in pending:
        r.approved = True
        session.add(r)
    session.commit()
    if pending:
        await maybe_enqueue_kl_build(muse_id, request.app.state.arq_pool, session)
    return {"approved": len(pending)}
