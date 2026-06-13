import json
import logging
from typing import AsyncGenerator

from sqlmodel import Session, select

from core.claude import async_client
from models.chat import ChatMessage, ChatSession
from models.database import engine
from models.knowledge import KnowledgeLayer
from models.resource import Resource
from vector_store.base import SearchResult
from vector_store.chroma import get_vector_store

logger = logging.getLogger(__name__)

_HISTORY_LIMIT = 10  # last 5 turns


async def retrieve(muse_id: str, query: str, k: int = 6) -> list[SearchResult]:
    vs = get_vector_store()
    try:
        return await vs.query(muse_id, query, k=k)
    except Exception as exc:
        logger.error("Vector store query failed for muse %s: %s", muse_id, exc)
        return []


def _build_system_prompt(
    muse_name: str,
    synthesis: str,
    chunks: list[SearchResult],
    resource_map: dict[str, str],
) -> str:
    if chunks:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            title = resource_map.get(chunk.resource_id, "Unknown Source")
            context_parts.append(f"[Source {i}: {title}]\n{chunk.text}")
        context = "\n\n---\n\n".join(context_parts)
    else:
        context = "No specific knowledge base excerpts matched this query. Answer from general knowledge and be transparent about this."

    synthesis_block = f"\nKnowledge base overview:\n{synthesis[:1_200]}\n" if synthesis else ""

    return f"""You are a knowledgeable, conversational learning companion for the topic "{muse_name}". Help the user understand this subject deeply and clearly.
{synthesis_block}
Relevant excerpts from the knowledge base:

{context}

Instructions:
- Ground your answers in the knowledge base excerpts above
- Cite sources naturally: "According to [Source Title], ..." or "[Source Title] explains that..."
- If the knowledge base doesn't cover something, answer from general knowledge but note it
- Be conversational, pedagogically clear, and appropriately concise
- Build on the conversation context — don't repeat what was already covered"""


async def stream_response(
    muse_id: str,
    session_id: str,
    user_message: str,
) -> AsyncGenerator[str, None]:
    # Load recent history before saving the new user message
    with Session(engine) as db:
        recent = db.exec(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(_HISTORY_LIMIT)
        ).all()
        history = [{"role": m.role, "content": m.content} for m in reversed(recent)]
        history.append({"role": "user", "content": user_message})

        # Load Muse synthesis for system prompt context
        kl = db.get(KnowledgeLayer, muse_id)
        synthesis = kl.synthesis if kl and kl.status == "ready" else ""

    # Save user message
    with Session(engine) as db:
        db.add(ChatMessage(session_id=session_id, role="user", content=user_message))
        db.commit()

    # Retrieve relevant chunks
    chunks = await retrieve(muse_id, user_message)

    # Load resource titles for cited chunks
    with Session(engine) as db:
        resource_ids = list({c.resource_id for c in chunks if c.resource_id})
        if resource_ids:
            resources = db.exec(select(Resource).where(Resource.id.in_(resource_ids))).all()
            resource_map = {r.id: r.title for r in resources}
        else:
            resource_map = {}

    system_prompt = _build_system_prompt(
        muse_name=_load_muse_name(muse_id),
        synthesis=synthesis,
        chunks=chunks,
        resource_map=resource_map,
    )

    full_text = ""
    try:
        async with async_client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system_prompt,
            messages=history,
        ) as stream:
            async for chunk in stream.text_stream:
                full_text += chunk
                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return

    # Build deduplicated citations from retrieved chunks
    seen: set[str] = set()
    citations = []
    for chunk in chunks:
        rid = chunk.resource_id
        if rid and rid not in seen and rid in resource_map:
            seen.add(rid)
            citations.append({
                "resource_id": rid,
                "resource_title": resource_map[rid],
                "excerpt": chunk.text[:200],
            })

    # Save assistant message + auto-title session on first exchange
    with Session(engine) as db:
        db.add(ChatMessage(session_id=session_id, role="assistant", content=full_text, citations=citations))

        chat_session = db.get(ChatSession, session_id)
        if chat_session and chat_session.title is None:
            chat_session.title = user_message[:60].strip()
            db.add(chat_session)

        db.commit()

    yield f"data: {json.dumps({'type': 'done', 'citations': citations})}\n\n"
    yield "data: [DONE]\n\n"


def _load_muse_name(muse_id: str) -> str:
    from models.muse import Muse
    with Session(engine) as db:
        muse = db.get(Muse, muse_id)
        return muse.name if muse else "this topic"
