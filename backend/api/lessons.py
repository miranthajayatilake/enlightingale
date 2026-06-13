from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from models.database import get_session
from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer
from models.lesson import Lesson, LessonProgress
from models.muse import Muse

router = APIRouter(prefix="/muses/{muse_id}/lessons", tags=["lessons"])


# ── Response schemas ──────────────────────────────────────────────────────────

class LessonProgressRead(BaseModel):
    id: str
    lesson_id: str
    status: str
    quiz_score: Optional[int]
    completed_at: Optional[datetime]


class LessonRead(BaseModel):
    id: str
    muse_id: str
    order: int
    title: str
    summary: str
    key_concepts: list
    created_at: datetime
    progress: Optional[LessonProgressRead] = None


class LessonDetail(LessonRead):
    content: str
    quiz_questions: list


class GenerationJobRead(BaseModel):
    id: str
    status: str
    progress: int
    status_message: str


class ProgressUpdate(BaseModel):
    status: str                     # "in_progress" | "complete"
    quiz_score: Optional[int] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


def _progress_for(lesson_id: str, session: Session) -> Optional[LessonProgress]:
    return session.exec(
        select(LessonProgress).where(LessonProgress.lesson_id == lesson_id)
    ).first()


def _to_progress_read(p: Optional[LessonProgress]) -> Optional[LessonProgressRead]:
    if p is None:
        return None
    return LessonProgressRead(
        id=p.id,
        lesson_id=p.lesson_id,
        status=p.status,
        quiz_score=p.quiz_score,
        completed_at=p.completed_at,
    )


# ── Routes (literal paths before parameterized) ───────────────────────────────

@router.get("", response_model=list[LessonRead])
def list_lessons(muse_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    lessons = session.exec(
        select(Lesson).where(Lesson.muse_id == muse_id).order_by(Lesson.order)
    ).all()
    return [
        LessonRead(
            id=l.id,
            muse_id=l.muse_id,
            order=l.order,
            title=l.title,
            summary=l.summary,
            key_concepts=l.key_concepts,
            created_at=l.created_at,
            progress=_to_progress_read(_progress_for(l.id, session)),
        )
        for l in lessons
    ]


@router.post("/generate", response_model=GenerationJobRead, status_code=202)
async def generate_lessons(
    muse_id: str,
    request: Request,
    session: Session = Depends(get_session),
):
    _get_muse_or_404(muse_id, session)
    kl = session.get(KnowledgeLayer, muse_id)
    if not kl or kl.status != "ready":
        raise HTTPException(status_code=400, detail="Knowledge Layer must be built before generating lessons")

    job = BackgroundJob(
        muse_id=muse_id,
        job_type="lesson_gen",
        status="queued",
        progress=0,
        status_message="Queued",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    await request.app.state.arq_pool.enqueue_job(
        "run_generate_lessons", muse_id=muse_id, job_id=job.id
    )

    return GenerationJobRead(
        id=job.id,
        status=job.status,
        progress=job.progress,
        status_message=job.status_message,
    )


@router.get("/generation", response_model=Optional[GenerationJobRead])
def generation_status(muse_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    job = session.exec(
        select(BackgroundJob)
        .where(BackgroundJob.muse_id == muse_id, BackgroundJob.job_type == "lesson_gen")
        .order_by(BackgroundJob.created_at.desc())
    ).first()
    if not job:
        return None
    return GenerationJobRead(
        id=job.id,
        status=job.status,
        progress=job.progress,
        status_message=job.status_message,
    )


@router.get("/{lesson_id}", response_model=LessonDetail)
def get_lesson(muse_id: str, lesson_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    lesson = session.get(Lesson, lesson_id)
    if not lesson or lesson.muse_id != muse_id:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonDetail(
        id=lesson.id,
        muse_id=lesson.muse_id,
        order=lesson.order,
        title=lesson.title,
        summary=lesson.summary,
        key_concepts=lesson.key_concepts,
        quiz_questions=lesson.quiz_questions,
        content=lesson.content,
        created_at=lesson.created_at,
        progress=_to_progress_read(_progress_for(lesson.id, session)),
    )


@router.post("/{lesson_id}/progress", response_model=LessonProgressRead)
def save_progress(
    muse_id: str,
    lesson_id: str,
    body: ProgressUpdate,
    session: Session = Depends(get_session),
):
    _get_muse_or_404(muse_id, session)
    lesson = session.get(Lesson, lesson_id)
    if not lesson or lesson.muse_id != muse_id:
        raise HTTPException(status_code=404, detail="Lesson not found")

    progress = _progress_for(lesson_id, session)
    if progress is None:
        progress = LessonProgress(lesson_id=lesson_id)
        session.add(progress)

    progress.status = body.status
    if body.quiz_score is not None:
        progress.quiz_score = body.quiz_score
    if body.status == "complete" and progress.completed_at is None:
        progress.completed_at = datetime.utcnow()

    session.commit()
    session.refresh(progress)

    return LessonProgressRead(
        id=progress.id,
        lesson_id=progress.lesson_id,
        status=progress.status,
        quiz_score=progress.quiz_score,
        completed_at=progress.completed_at,
    )
