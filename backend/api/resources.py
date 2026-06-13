import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from models.database import get_session
from models.job import BackgroundJob
from models.muse import Muse
from models.resource import Resource, ResourceRead
from storage.s3 import get_storage_service

router = APIRouter(prefix="/muses/{muse_id}/resources", tags=["resources"])


class ResourceUpdate(BaseModel):
    approved: Optional[bool] = None
    title: Optional[str] = None


class ResourceCreate(BaseModel):
    source_type: str        # "url" | "text"
    url: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


def _muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


async def _enqueue_process(request: Request, resource_id: str, muse_id: str, session: Session) -> BackgroundJob:
    job = BackgroundJob(muse_id=muse_id, job_type="process_resource")
    session.add(job)
    session.commit()
    session.refresh(job)
    await request.app.state.arq_pool.enqueue_job(
        "run_process_resource", resource_id=resource_id, job_id=job.id
    )
    return job


@router.get("", response_model=list[ResourceRead])
def list_resources(muse_id: str, session: Session = Depends(get_session)):
    _muse_or_404(muse_id, session)
    return session.exec(
        select(Resource)
        .where(Resource.muse_id == muse_id)
        .order_by(Resource.created_at.desc())  # type: ignore[arg-type]
    ).all()


@router.post("", response_model=ResourceRead, status_code=201)
async def create_resource(
    muse_id: str,
    body: ResourceCreate,
    request: Request,
    session: Session = Depends(get_session),
):
    muse = _muse_or_404(muse_id, session)

    if body.source_type == "url":
        if not body.url:
            raise HTTPException(status_code=422, detail="url is required for source_type='url'")
        resource = Resource(
            muse_id=muse_id,
            title=body.url,   # processor will replace with scraped title
            source_type="url",
            source_url=body.url,
            status="pending",
            approved=True,
        )
    elif body.source_type == "text":
        if not body.title or not body.content:
            raise HTTPException(status_code=422, detail="title and content are required for source_type='text'")
        resource = Resource(
            muse_id=muse_id,
            title=body.title,
            source_type="text",
            raw_content=body.content,
            status="pending",
            approved=True,
        )
    else:
        raise HTTPException(status_code=422, detail="source_type must be 'url' or 'text'")

    session.add(resource)
    muse.resource_count += 1
    session.add(muse)
    session.commit()
    session.refresh(resource)

    await _enqueue_process(request, resource.id, muse_id, session)
    return resource


@router.post("/upload", response_model=ResourceRead, status_code=201)
async def upload_resource(
    muse_id: str,
    request: Request,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    muse = _muse_or_404(muse_id, session)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are supported")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")
    resource_id = str(uuid.uuid4())
    file_key = f"resources/{resource_id}/{file.filename}"

    storage = get_storage_service()
    await storage.save(file_key, content, file.content_type or "application/pdf")

    resource = Resource(
        id=resource_id,
        muse_id=muse_id,
        title=file.filename,    # processor will clean this up
        source_type="pdf",
        file_path=file_key,
        status="pending",
        approved=True,
    )
    session.add(resource)
    muse.resource_count += 1
    session.add(muse)
    session.commit()
    session.refresh(resource)

    await _enqueue_process(request, resource.id, muse_id, session)
    return resource


@router.patch("/{resource_id}", response_model=ResourceRead)
def update_resource(
    muse_id: str,
    resource_id: str,
    body: ResourceUpdate,
    session: Session = Depends(get_session),
):
    resource = session.get(Resource, resource_id)
    if not resource or resource.muse_id != muse_id:
        raise HTTPException(status_code=404, detail="Resource not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)
    session.add(resource)
    session.commit()
    session.refresh(resource)
    return resource


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    muse_id: str,
    resource_id: str,
    session: Session = Depends(get_session),
):
    resource = session.get(Resource, resource_id)
    if not resource or resource.muse_id != muse_id:
        raise HTTPException(status_code=404, detail="Resource not found")
    session.delete(resource)

    muse = session.get(Muse, muse_id)
    if muse and muse.resource_count > 0:
        muse.resource_count -= 1
        session.add(muse)

    session.commit()
