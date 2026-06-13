"""
Voice Agent — Gemini 2.0 Flash Live proxy.

REST endpoint creates a session (returns session_id + ws_url).
WebSocket endpoint proxies audio bidirectionally between the browser and Gemini Live.
"""

import asyncio
import base64
import contextlib
import json
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlmodel import Session

from core.config import settings
from models.database import get_session
from models.muse import Muse
from services.voice.context import build_system_prompt, build_tour_system_prompt, load_canvas_sections
from services.voice.tour import TourController

router     = APIRouter(prefix="/muses/{muse_id}/voice", tags=["voice"])
router_ws  = APIRouter(tags=["voice-ws"])

# In-memory session store — single user, ephemeral sessions
_sessions: dict[str, dict] = {}
_SESSION_TTL = 600  # 10 minutes


def _purge_stale_sessions() -> None:
    now = time.time()
    stale = [sid for sid, s in _sessions.items() if now - s.get("created_at", now) > _SESSION_TTL]
    for sid in stale:
        _sessions.pop(sid, None)


# ── REST ─────────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    mode: str = "tour"        # tour | chat
    start_section_id: Optional[str] = None   # tour: begin at this Canvas section


class SessionResponse(BaseModel):
    session_id: str
    ws_url: str


@router.post("/session", response_model=SessionResponse)
def create_voice_session(
    muse_id: str,
    body: SessionCreate = SessionCreate(),
    session: Session = Depends(get_session),
):
    muse = session.get(Muse, muse_id)
    if not muse:
        raise HTTPException(status_code=404, detail="Muse not found")

    _purge_stale_sessions()
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "muse_id": muse_id,
        "created_at": time.time(),
        "mode": body.mode,
        "start_section_id": body.start_section_id,
    }
    return SessionResponse(
        session_id=session_id,
        ws_url=f"/ws/voice/{session_id}",
    )


@router.post("/session/{session_id}/end", status_code=204)
def end_voice_session(muse_id: str, session_id: str):
    _sessions.pop(session_id, None)


# ── WebSocket proxy ───────────────────────────────────────────────────────────

@router_ws.websocket("/ws/voice/{session_id}")
async def voice_proxy(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()

    session_data = _sessions.get(session_id)
    if not session_data:
        await websocket.send_json({"type": "error", "message": "Invalid or expired session"})
        await websocket.close()
        return

    if not settings.GEMINI_API_KEY:
        await websocket.send_json({"type": "error", "message": "GEMINI_API_KEY is not configured"})
        await websocket.close()
        return

    muse_id = session_data["muse_id"]
    mode = session_data.get("mode", "tour")

    # Tour mode requires a ready Canvas with sections; otherwise fall back to free chat.
    tour_sections = load_canvas_sections(muse_id) if mode == "tour" else []
    is_tour = bool(tour_sections)
    system_prompt = (
        build_tour_system_prompt(muse_id, tour_sections) if is_tour else build_system_prompt(muse_id)
    )

    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options={"api_version": "v1alpha"},
        )

        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": "Puck"}
                }
            },
            "input_audio_transcription": {},
            # Request transcript of model's spoken audio (not thinking text)
            "output_audio_transcription": {},
        }

        async with client.aio.live.connect(
            model="gemini-2.5-flash-native-audio-latest",
            config=config,
        ) as gemini_session:
            # Notify the frontend that Gemini is ready
            await websocket.send_json({"type": "ready"})

            from google.genai import types as gtypes

            tour: Optional[TourController] = None
            if is_tour:
                # Guided Tour: dispatch the first section; the controller advances through
                # the rest as each section's turn completes (see _recv_loop).
                tour = TourController(websocket, gemini_session, tour_sections)
                await tour.begin(start_section_id=session_data.get("start_section_id"))
            else:
                # Free chat: send an empty turn so Gemini greets first.
                await gemini_session.send_client_content(
                    turns=gtypes.Content(role="user", parts=[gtypes.Part(text="")]),
                    turn_complete=True,
                )

            send_task = asyncio.create_task(
                _send_loop(websocket, gemini_session, tour)
            )
            recv_task = asyncio.create_task(
                _recv_loop(websocket, gemini_session, tour)
            )

            _done, pending = await asyncio.wait(
                [send_task, recv_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": str(exc)})
    finally:
        _sessions.pop(session_id, None)
        with contextlib.suppress(Exception):
            await websocket.close()


async def _send_loop(websocket: WebSocket, gemini_session, tour: "Optional[TourController]" = None) -> None:
    """Read messages from the browser and forward them to Gemini (audio + tour controls)."""
    from google.genai import types as gtypes

    async for raw in websocket.iter_text():
        try:
            msg = json.loads(raw)
        except Exception:
            continue

        msg_type = msg.get("type")

        if msg_type == "audio_chunk":
            audio_bytes = base64.b64decode(msg["data"])
            await gemini_session.send_realtime_input(
                audio=gtypes.Blob(
                    data=audio_bytes,
                    mime_type="audio/pcm;rate=16000",
                )
            )
        elif msg_type == "jump_section":
            if tour and msg.get("id"):
                await tour.jump_to(msg["id"])
        elif msg_type == "end":
            return


async def _recv_loop(websocket: WebSocket, gemini_session, tour: "Optional[TourController]" = None) -> None:
    """Read responses from Gemini and forward them to the browser.

    receive() yields until one turn_complete, then stops — so we loop over
    turns ourselves to keep the session alive across multiple exchanges.

    In tour mode, advance the tour cursor when a backend-dispatched section turn
    completes (the TourController guards against advancing on a user-driven turn).
    """
    is_speaking = False

    while True:
        async for response in gemini_session.receive():
            audio_data: Optional[bytes] = None
            text_data:  Optional[str]   = None
            user_transcript: Optional[str] = None
            interrupted   = False
            turn_complete = False

            # Primary: structured server content (native audio model path)
            if hasattr(response, "server_content") and response.server_content:
                sc = response.server_content

                model_turn = getattr(sc, "model_turn", None)
                if model_turn and model_turn.parts:
                    for part in model_turn.parts:
                        if hasattr(part, "inline_data") and part.inline_data:
                            audio_data = part.inline_data.data
                            break  # one audio part per response

                output_trans = getattr(sc, "output_transcription", None)
                if output_trans and getattr(output_trans, "text", None):
                    text_data = output_trans.text

                input_trans = getattr(sc, "input_transcription", None)
                if input_trans and getattr(input_trans, "text", None):
                    user_transcript = input_trans.text

                interrupted   = bool(getattr(sc, "interrupted",    False))
                turn_complete = bool(getattr(sc, "turn_complete",  False))

            # Fallback: response.data shorthand (older SDK versions).
            # Only used when model_turn produced no audio to avoid sending the same
            # bytes twice (some SDK versions expose both paths for the same chunk).
            if audio_data is None and hasattr(response, "data") and response.data:
                audio_data = response.data

            # Send audio
            if audio_data:
                if tour:
                    tour.note_model_audio()
                if not is_speaking:
                    is_speaking = True
                    await websocket.send_json({"type": "state", "value": "speaking"})
                await websocket.send_json({
                    "type": "audio_chunk",
                    "data": base64.b64encode(audio_data).decode(),
                })

            # Send model transcript
            if text_data:
                await websocket.send_json({
                    "type": "transcript",
                    "role": "model",
                    "text": text_data,
                })

            # Send user transcript
            if user_transcript:
                if tour:
                    tour.note_user_input()
                await websocket.send_json({
                    "type": "transcript",
                    "role": "user",
                    "text": user_transcript,
                })

            if interrupted:
                is_speaking = False
                if tour:
                    await tour.on_interrupted()
                await websocket.send_json({"type": "interrupted"})
                await websocket.send_json({"type": "state", "value": "listening"})

            if turn_complete:
                is_speaking = False
                await websocket.send_json({"type": "state", "value": "listening"})
                if tour:
                    await tour.on_turn_complete()
