import json
from datetime import datetime
from sqlmodel import Session

from models.database import engine
from models.muse import Muse
from models.resource import Resource
from models.job import BackgroundJob
from storage.s3 import get_storage_service
from . import web_scraper, pdf_parser, summarizer


async def _pub(redis_conn, job_id: str, payload: dict) -> None:
    await redis_conn.publish(f"job_progress:{job_id}", json.dumps(payload))


async def process_resource(resource_id: str, job_id: str, redis_conn) -> None:
    # Load resource metadata from DB
    with Session(engine) as session:
        resource = session.get(Resource, resource_id)
        job = session.get(BackgroundJob, job_id)
        if not resource or not job:
            return

        muse = session.get(Muse, resource.muse_id)
        muse_name = muse.name if muse else "this topic"
        muse_id = resource.muse_id

        source_type = resource.source_type
        source_url = resource.source_url
        file_path = resource.file_path
        resource_title = resource.title
        raw_content = resource.raw_content

        job.status = "running"
        job.progress = 5
        job.status_message = "Starting…"
        session.add(job)
        session.commit()

    try:
        await _pub(redis_conn, job_id, {"type": "progress", "progress": 10, "step": "Fetching content…"})

        if source_type == "url":
            result = await web_scraper.scrape_url(source_url)
            raw_content = result["content"]
            new_title = result["title"] or resource_title
        elif source_type == "pdf":
            storage = get_storage_service()
            file_bytes = await storage.load(file_path)
            result = await pdf_parser.parse_pdf(file_bytes, resource_title)
            raw_content = result["content"]
            new_title = result["title"] or resource_title
        else:
            # text — content already stored, just summarize
            new_title = resource_title

        await _pub(redis_conn, job_id, {"type": "progress", "progress": 50, "step": "Summarizing…"})
        summary = await summarizer.summarize_resource(new_title, raw_content, muse_name)

        await _pub(redis_conn, job_id, {"type": "progress", "progress": 90, "step": "Saving…"})

        with Session(engine) as session:
            res = session.get(Resource, resource_id)
            if not res:
                return  # deleted while processing
            res.raw_content = raw_content
            res.summary = summary
            res.title = new_title
            res.status = "ready"
            session.add(res)

            job_obj = session.get(BackgroundJob, job_id)
            if job_obj:
                job_obj.status = "complete"
                job_obj.progress = 100
                job_obj.status_message = "Ready"
                job_obj.completed_at = datetime.utcnow()
                session.add(job_obj)

            session.commit()

        await _pub(redis_conn, job_id, {"type": "complete", "progress": 100})

    except Exception as exc:
        error_msg = f"Processing failed: {exc}"
        with Session(engine) as session:
            res = session.get(Resource, resource_id)
            if res:
                res.status = "failed"
                session.add(res)
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
