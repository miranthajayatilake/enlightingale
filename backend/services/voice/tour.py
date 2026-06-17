"""Guided Tour coordinator (v0.4 — drives the Mentor's Walkthrough Plan).

The backend owns the tour cursor and hands Gemini ONE Walkthrough Plan *stop* at a time,
emitting the `canvas_focus` event (the stop's anchor ids) in lockstep with the audio it is
about to produce. Because the backend decides stop boundaries, the on-screen highlight is
deterministic — never inferred from the audio/transcript (PRD v0.4 §6.2, KD2). A stop may
highlight a whole block or a single element (e.g. one timeline event), so highlights can be
finer-grained than the old per-section model.

Detour / resume: when the student barges in with a question, Gemini emits `interrupted` and
we enter the `detour` phase (the frontend dims the active highlight). The Mentor answers
freely; the cursor does NOT advance. We detect the answer has finished — rather than the
cut-off stop turn finalizing — by waiting for a `turn_complete` that arrives AFTER the model
produced fresh audio while in detour. Then we re-anchor: re-emit `canvas_focus` for the
current stop and dispatch a "brief recap, then continue" instruction. Click-to-jump
repositions the cursor to the stop matching the clicked anchor.
"""

from typing import Optional

from fastapi import WebSocket
from google.genai import types as gtypes


class TourController:
    def __init__(self, websocket: WebSocket, gemini_session, stops: list[dict], intro_text: Optional[str] = None):
        self.ws = websocket
        self.gs = gemini_session
        self.stops = stops
        self.intro_text = intro_text
        self.cursor = 0
        self.phase = "intro" if intro_text else "touring"   # intro | touring | detour | complete
        self.saw_user_input_this_turn = False
        self.detour_answer_started = False  # model produced audio since entering detour
        # A jump interrupts Gemini's current turn via realtime input. That self-induced
        # interrupt produces an `interrupted` event and a `turn_complete` for the abandoned
        # turn — both must be ignored (they are not a user barge-in nor a finished stop).
        self._ignore_next_interrupt = False
        self._ignore_turn_completes = 0

    def _stop_for_anchor(self, anchor_id: str) -> Optional[int]:
        """Map a clicked anchor id to the stop that covers it: an exact anchor match first,
        then any stop in the same block (anchor ids are `{block}.{unit}`)."""
        for i, s in enumerate(self.stops):
            if anchor_id in (s.get("anchors") or []):
                return i
        block = anchor_id.split(".")[0]
        for i, s in enumerate(self.stops):
            if any((a or "").split(".")[0] == block for a in (s.get("anchors") or [])):
                return i
        return None

    async def begin(self, start_anchor_id: Optional[str] = None) -> None:
        start = self._stop_for_anchor(start_anchor_id) if start_anchor_id else 0
        self.cursor = start if start is not None else 0
        if self.intro_text:
            # Intro plays before the first stop — no canvas highlight yet.
            await self.ws.send_json({"type": "tour_state", "value": "intro"})
            await self._send(self.intro_text)
        else:
            await self._emit_focus()
            await self._dispatch(kind="first")

    async def _emit_focus(self) -> None:
        stop = self.stops[self.cursor]
        await self.ws.send_json({
            "type": "canvas_focus",
            "anchor_ids": stop.get("anchors") or [],
            "index": self.cursor,
            "total": len(self.stops),
        })
        await self.ws.send_json({"type": "tour_state", "value": "touring"})

    async def _send(self, text: str) -> None:
        await self.gs.send_client_content(
            turns=gtypes.Content(role="user", parts=[gtypes.Part(text=text)]),
            turn_complete=True,
        )

    async def _interrupt(self) -> None:
        """Stop Gemini's in-progress turn. `send_client_content` does NOT interrupt an
        active turn, but realtime input does — so we use it to cut off the current
        narration before dispatching a new stop (used by jump)."""
        await self.gs.send_realtime_input(text="(The student jumped to a different part of the page.)")

    async def _dispatch(self, kind: str = "next") -> None:
        stop = self.stops[self.cursor]
        narration = (stop.get("narration") or "").strip()
        if kind == "first":
            text = (
                "Begin the guided tour now. Greet the student in one warm sentence that "
                "names the topic, then say this, in your own voice:\n\n" + narration
            )
        elif kind == "first_after_intro":
            text = (
                "The orientation is complete. Now begin the walkthrough — flow naturally in "
                "and say this:\n\n" + narration
            )
        elif kind == "resume":
            text = (
                "The student's question is fully answered. In one short sentence, pick up "
                "where you left off, then continue and say this:\n\n" + narration
            )
        elif kind == "jump":
            text = (
                "The student jumped to this part of the page. Go there now and say this:\n\n" + narration
            )
        else:
            text = (
                "Move on to the next stop. Bridge smoothly from what you just covered, then "
                "say this:\n\n" + narration
            )
        self.saw_user_input_this_turn = False
        await self._send(text)

    # ── Signals from the recv/send loops ─────────────────────────────────────────

    def note_user_input(self) -> None:
        """A user transcript arrived during the current turn."""
        self.saw_user_input_this_turn = True

    def note_model_audio(self) -> None:
        """Model produced audio. While in detour, this marks that the answer has begun."""
        if self.phase == "detour":
            self.detour_answer_started = True

    async def on_interrupted(self) -> None:
        """Barge-in: the student is asking something. Pause the tour (don't advance).
        Ignore a self-induced interrupt from a jump."""
        if self._ignore_next_interrupt:
            self._ignore_next_interrupt = False
            return
        if self.phase != "complete" and self.phase != "detour":
            self.phase = "detour"
            self.detour_answer_started = False
            await self.ws.send_json({"type": "tour_state", "value": "detour"})

    async def on_turn_complete(self) -> None:
        if self.phase == "complete":
            return
        # Swallow the turn_complete from a turn we deliberately cut off (jump).
        if self._ignore_turn_completes > 0:
            self._ignore_turn_completes -= 1
            return

        if self.phase == "intro":
            # Orientation finished — start the actual walkthrough at the first stop.
            self.phase = "touring"
            await self._emit_focus()
            await self._dispatch(kind="first_after_intro")
            return

        if self.phase == "detour":
            # Resume only once the answer has actually played (not on the cut-off
            # stop turn finalizing). Otherwise keep waiting.
            if self.detour_answer_started:
                await self._resume()
            return

        # touring
        if self.saw_user_input_this_turn:
            # A question came in without a clean barge-in interrupt — enter detour and
            # wait for the answer to complete before resuming.
            self.phase = "detour"
            self.detour_answer_started = False
            await self.ws.send_json({"type": "tour_state", "value": "detour"})
            return

        await self._advance()

    # ── Cursor moves ──────────────────────────────────────────────────────────────

    async def _advance(self) -> None:
        self.cursor += 1
        if self.cursor >= len(self.stops):
            self.phase = "complete"
            await self.ws.send_json({"type": "tour_state", "value": "complete"})
            await self._send(
                "That was the final stop. Give a brief, warm closing — one or two "
                "sentences — wrapping up the tour. Do not start a new topic."
            )
            return
        await self._emit_focus()
        await self._dispatch(kind="next")

    async def _resume(self) -> None:
        self.phase = "touring"
        self.detour_answer_started = False
        await self._emit_focus()
        await self._dispatch(kind="resume")

    async def jump_to_anchor(self, anchor_id: str) -> None:
        idx = self._stop_for_anchor(anchor_id)
        if idx is None:
            return
        self.phase = "touring"
        self.detour_answer_started = False
        self.cursor = idx
        # Cut off whatever Gemini is currently narrating, then present the new stop.
        # The self-induced interrupt yields one `interrupted` + one `turn_complete` to ignore.
        self._ignore_next_interrupt = True
        self._ignore_turn_completes += 1
        await self._interrupt()
        await self._emit_focus()
        await self._dispatch(kind="jump")

    async def explain(self, anchor_id: str, selected_text: Optional[str] = None) -> None:
        """The student pointed at a specific spot and asked the Mentor to explain it.
        Modelled as a user-initiated detour: highlight exactly what they pointed at, explain
        just that, then re-anchor to the current stop (the cursor does NOT move)."""
        self.phase = "detour"
        self.detour_answer_started = False
        # Cut off the current narration (same self-induced-interrupt bookkeeping as a jump).
        self._ignore_next_interrupt = True
        self._ignore_turn_completes += 1
        await self._interrupt()
        # Highlight exactly the clicked anchor while answering.
        await self.ws.send_json({
            "type": "canvas_focus",
            "anchor_ids": [anchor_id],
            "index": self.cursor,
            "total": len(self.stops),
        })
        await self.ws.send_json({"type": "tour_state", "value": "detour"})
        focus = f' Focus specifically on: "{selected_text.strip()}".' if selected_text and selected_text.strip() else ""
        await self._send(
            "The student pointed at this part of the page and asked you to explain it. "
            f"Explain just this, warmly and concretely.{focus} Then stop — I'll bring you back to the tour."
        )
