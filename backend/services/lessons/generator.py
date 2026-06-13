import json
from datetime import datetime

from redis.asyncio import Redis
from sqlmodel import Session, select

from models.database import engine
from models.job import BackgroundJob
from models.knowledge import KnowledgeLayer
from models.lesson import Lesson
from models.muse import Muse
from models.resource import Resource
from services.lessons.curriculum import generate_curriculum
from services.lessons.lesson_writer import write_lesson
from services.lessons.quiz_generator import generate_quiz


async def _publish(redis: Redis, job_id: str, progress: int, message: str) -> None:
    await redis.publish(
        f"job_progress:{job_id}",
        json.dumps({"progress": progress, "status_message": message}),
    )


async def _fail_job(job_id: str, message: str, redis: Redis) -> None:
    with Session(engine) as session:
        j = session.get(BackgroundJob, job_id)
        if j:
            j.status = "failed"
            j.status_message = message
            j.completed_at = datetime.utcnow()
            session.add(j)
            session.commit()
    await redis.publish(
        f"job_progress:{job_id}",
        json.dumps({"progress": 0, "status_message": message, "status": "failed"}),
    )


async def generate_lessons(muse_id: str, job_id: str, redis_conn: Redis) -> None:
    try:
        with Session(engine) as session:
            job = session.get(BackgroundJob, job_id)
            if not job:
                return
            job.status = "running"
            session.add(job)
            session.commit()

        await _publish(redis_conn, job_id, 5, "Loading knowledge layer…")

        with Session(engine) as session:
            kl = session.get(KnowledgeLayer, muse_id)
            muse = session.get(Muse, muse_id)
            if not kl or kl.status != "ready" or not muse:
                await _fail_job(job_id, "Knowledge layer not ready", redis_conn)
                return

            synthesis = kl.synthesis
            glossary = kl.glossary or []
            muse_name = muse.name
            muse_description = muse.description or muse.name
            knowledge_level = muse.knowledge_level or "beginner"

        await _publish(redis_conn, job_id, 10, "Planning curriculum…")

        curriculum = await generate_curriculum(
            muse_name=muse_name,
            muse_description=muse_description,
            knowledge_level=knowledge_level,
            synthesis=synthesis,
            glossary=glossary,
        )

        if not curriculum:
            await _fail_job(job_id, "Curriculum generation returned no lessons", redis_conn)
            return

        # Delete any existing lessons for this muse
        with Session(engine) as session:
            existing = session.exec(select(Lesson).where(Lesson.muse_id == muse_id)).all()
            for lesson in existing:
                session.delete(lesson)
            session.commit()

        n = len(curriculum)
        progress_per_lesson = (85 - 10) // n

        for i, stub in enumerate(curriculum):
            lesson_num = i + 1
            progress = 10 + i * progress_per_lesson
            await _publish(redis_conn, job_id, progress, f"Writing lesson {lesson_num} of {n}: {stub['title']}…")

            content = await write_lesson(
                stub=stub,
                muse_name=muse_name,
                knowledge_level=knowledge_level,
                synthesis=synthesis,
            )

            quiz = await generate_quiz(
                lesson_title=stub["title"],
                lesson_content=content,
                knowledge_level=knowledge_level,
            )

            with Session(engine) as session:
                lesson = Lesson(
                    muse_id=muse_id,
                    order=stub["order"],
                    title=stub["title"],
                    content=content,
                    summary=stub.get("focus", ""),
                    key_concepts=stub.get("key_concepts", []),
                    quiz_questions=quiz,
                    source_resource_ids=[],
                )
                session.add(lesson)
                session.commit()

        await _publish(redis_conn, job_id, 95, "Finalizing…")

        with Session(engine) as session:
            j = session.get(BackgroundJob, job_id)
            if j:
                j.status = "complete"
                j.progress = 100
                j.status_message = f"Generated {n} lessons"
                j.completed_at = datetime.utcnow()
                session.add(j)
                session.commit()

        await _publish(redis_conn, job_id, 100, f"Done — {n} lessons ready")

    except Exception as exc:
        await _fail_job(job_id, f"Lesson generation failed: {exc}", redis_conn)
