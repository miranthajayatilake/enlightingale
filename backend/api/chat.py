from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from models.chat import ChatMessage, ChatSession
from models.database import get_session
from models.muse import Muse

router = APIRouter(prefix="/muses/{muse_id}/chat", tags=["chat"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SessionRead(BaseModel):
    id: str
    muse_id: str
    title: Optional[str]
    created_at: datetime


class MessageRead(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    citations: list
    created_at: datetime


class SessionDetail(SessionRead):
    messages: list[MessageRead]


class MessageCreate(BaseModel):
    content: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_muse_or_404(muse_id: str, session: Session) -> Muse:
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")
    return muse


def _get_session_or_404(muse_id: str, session_id: str, db: Session) -> ChatSession:
    chat = db.get(ChatSession, session_id)
    if not chat or chat.muse_id != muse_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return chat


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[SessionRead])
def list_sessions(muse_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    sessions = session.exec(
        select(ChatSession)
        .where(ChatSession.muse_id == muse_id)
        .order_by(ChatSession.created_at.desc())
    ).all()
    return [SessionRead(id=s.id, muse_id=s.muse_id, title=s.title, created_at=s.created_at) for s in sessions]


@router.post("/sessions", response_model=SessionRead, status_code=201)
def create_session(muse_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    chat = ChatSession(muse_id=muse_id)
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return SessionRead(id=chat.id, muse_id=chat.muse_id, title=chat.title, created_at=chat.created_at)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session_detail(muse_id: str, session_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    chat = _get_session_or_404(muse_id, session_id, session)
    messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    ).all()
    return SessionDetail(
        id=chat.id,
        muse_id=chat.muse_id,
        title=chat.title,
        created_at=chat.created_at,
        messages=[
            MessageRead(
                id=m.id,
                session_id=m.session_id,
                role=m.role,
                content=m.content,
                citations=m.citations or [],
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


@router.post("/sessions/{session_id}/message")
async def send_message(
    muse_id: str,
    session_id: str,
    body: MessageCreate,
    session: Session = Depends(get_session),
):
    _get_muse_or_404(muse_id, session)
    _get_session_or_404(muse_id, session_id, session)

    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    from services.chat.rag import stream_response

    return StreamingResponse(
        stream_response(
            muse_id=muse_id,
            session_id=session_id,
            user_message=body.content.strip(),
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(muse_id: str, session_id: str, session: Session = Depends(get_session)):
    _get_muse_or_404(muse_id, session)
    chat = _get_session_or_404(muse_id, session_id, session)
    messages = session.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    ).all()
    for m in messages:
        session.delete(m)
    session.delete(chat)
    session.commit()
