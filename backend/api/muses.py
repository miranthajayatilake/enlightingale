from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from models.database import get_session
from models.job import BackgroundJob
from models.muse import Muse, MuseCreate, MuseUpdate, MuseRead
from services.muse.interpreter import interpret_description

router = APIRouter(prefix="/muses", tags=["muses"])


@router.get("", response_model=list[MuseRead])
def list_muses(session: Session = Depends(get_session)):
    return session.exec(select(Muse).where(Muse.status == "active")).all()


@router.post("", response_model=MuseRead, status_code=201)
async def create_muse(body: MuseCreate, request: Request, session: Session = Depends(get_session)):
    interpreted = await interpret_description(body.description)
    muse = Muse(
        name=interpreted.name,
        description=body.description,
        knowledge_level=body.knowledge_level,
        research_focus=interpreted.research_focus,
        agent_status="running",
    )
    session.add(muse)
    session.commit()
    session.refresh(muse)

    job = BackgroundJob(muse_id=muse.id, job_type="research_agent")
    session.add(job)
    session.commit()
    session.refresh(job)

    await request.app.state.arq_pool.enqueue_job(
        "run_research_agent",
        muse_id=muse.id,
        job_id=job.id,
        focus=muse.research_focus,
        auto_approve=True,
    )
    return muse


@router.get("/{muse_id}", response_model=MuseRead)
def get_muse(muse_id: str, session: Session = Depends(get_session)):
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


@router.patch("/{muse_id}", response_model=MuseRead)
def update_muse(
    muse_id: str,
    body: MuseUpdate,
    session: Session = Depends(get_session),
):
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(muse, field, value)
    muse.updated_at = datetime.utcnow()
    session.add(muse)
    session.commit()
    session.refresh(muse)
    return muse


@router.delete("/{muse_id}", status_code=204)
def delete_muse(muse_id: str, session: Session = Depends(get_session)):
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    session.delete(muse)
    session.commit()
