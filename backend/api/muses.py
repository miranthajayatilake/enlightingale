from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from models.database import get_session
from models.muse import Muse, MuseCreate, MuseUpdate, MuseRead

router = APIRouter(prefix="/muses", tags=["muses"])


@router.get("", response_model=list[MuseRead])
def list_muses(session: Session = Depends(get_session)):
    return session.exec(select(Muse).where(Muse.status == "active")).all()


@router.post("", response_model=MuseRead, status_code=201)
def create_muse(body: MuseCreate, session: Session = Depends(get_session)):
    muse = Muse(**body.model_dump(), agent_status="idle")
    session.add(muse)
    session.commit()
    session.refresh(muse)
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
