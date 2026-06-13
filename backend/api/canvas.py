from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from models.canvas import MuseCanvas, MuseCanvasRead
from models.database import get_session
from models.job import BackgroundJob, JobRead
from models.knowledge import KnowledgeLayer
from models.muse import Muse
from services.canvas.signature import compute_source_signature

router = APIRouter(prefix="/muses/{muse_id}/canvas", tags=["canvas"])


def _muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


@router.get("", response_model=MuseCanvasRead | None)
def get_canvas(muse_id: str, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    canvas = session.get(MuseCanvas, muse_id)
    if not canvas:
        return None

    stale = (
        canvas.status == "ready"
        and bool(canvas.source_signature)
        and compute_source_signature(muse_id) != canvas.source_signature
    )
    return MuseCanvasRead(
        muse_id=canvas.muse_id,
        sections=canvas.sections,
        status=canvas.status,
        error=canvas.error,
        source_signature=canvas.source_signature,
        built_at=canvas.built_at,
        stale=stale,
    )


@router.post("/build", response_model=JobRead, status_code=202)
async def build_canvas(
    muse_id: str,
    request: Request,
    session: Session = Depends(get_session),
):
    _muse_or_404(muse_id, session)

    kl = session.get(KnowledgeLayer, muse_id)
    if not kl or kl.status != "ready":
        raise HTTPException(
            status_code=400,
            detail="Knowledge Layer must be built before generating the Canvas.",
        )

    canvas = session.get(MuseCanvas, muse_id)
    if not canvas:
        canvas = MuseCanvas(muse_id=muse_id, status="building")
        session.add(canvas)
    else:
        canvas.status = "building"
        session.add(canvas)

    job = BackgroundJob(muse_id=muse_id, job_type="canvas")
    session.add(job)
    session.commit()
    session.refresh(job)

    await request.app.state.arq_pool.enqueue_job(
        "run_build_canvas", muse_id=muse_id, job_id=job.id
    )
    return job
