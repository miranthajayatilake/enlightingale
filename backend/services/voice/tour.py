"""Guided Tour coordinator.

The backend owns the tour cursor and hands Gemini ONE Canvas section at a time,
emitting the `canvas_section` highlight event in lockstep with the audio it is about
to produce. Because the backend decides section boundaries, the on-screen highlight is
deterministic — never inferred from the audio/transcript (see PRD §7.1).

Detour / resume (M0.2.4): when the student barges in with a question, Gemini emits
`interrupted` and we enter the `detour` phase (the frontend dims the active section to
"paused"). The Mentor answers freely; the cursor does NOT advance. We detect that the
answer has finished — rather than the cut-off section turn finalizing — by waiting for a
`turn_complete` that arrives AFTER the model produced fresh audio while in detour. Then we
re-anchor: re-emit `canvas_section` for the current cursor and dispatch a "brief recap, then
continue this section" instruction. Click-to-jump repositions the cursor to any section.
"""

from typing import Optional

from fastapi import WebSocket
from google.genai import types as gtypes


class TourController:
    def __init__(self, websocket: WebSocket, gemini_session, sections: list[dict], intro_text: Optional[str] = None):
        self.ws = websocket
        self.gs = gemini_session
        self.sections = sections
        self.intro_text = intro_text
        self.cursor = 0
        self.phase = "intro" if intro_text else "touring"   # intro | touring | detour | complete
        self.saw_user_input_this_turn = False
        self.detour_answer_started = False  # model produced audio since entering detour
        # A jump interrupts Gemini's current turn via realtime input. That self-induced
        # interrupt produces an `interrupted` event and a `turn_complete` for the abandoned
        # turn — both must be ignored (they are not a user barge-in nor a finished section).
        self._ignore_next_interrupt = False
        self._ignore_turn_completes = 0

    def _index_of(self, section_id: str) -> Optional[int]:
        return next((i for i, s in enumerate(self.sections) if s["id"] == section_id), None)

    async def begin(self, start_section_id: Optional[str] = None) -> None:
        start = self._index_of(start_section_id) if start_section_id else 0
        self.cursor = start if start is not None else 0
        if self.intro_text:
            # Intro plays before section 0 — no canvas highlight yet.
            await self.ws.send_json({"type": "tour_state", "value": "intro"})
            await self._send(self.intro_text)
        else:
            await self._emit_section()
            await self._dispatch(kind="first")

    async def _emit_section(self) -> None:
        section = self.sections[self.cursor]
        await self.ws.send_json({
            "type": "canvas_section",
            "id": section["id"],
            "index": self.cursor,
            "total": len(self.sections),
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
        narration before dispatching a new section (used by jump)."""
        await self.gs.send_realtime_input(text="(The student jumped to a different section.)")

    async def _dispatch(self, kind: str = "next") -> None:
        section = self.sections[self.cursor]
        title = section.get("title", "")
        narration = (section.get("narration") or "").strip()
        if kind == "first":
            text = (
                "Begin the guided tour now. Greet the student in one warm sentence that "
                f'names the topic, then present this first section, titled "{title}". '
                f"Cover this:\n\n{narration}"
            )
        elif kind == "first_after_intro":
            text = (
                f'The orientation is complete. Now flow naturally into the first section, titled "{title}". '
                f"No need to re-introduce the topic — just transition smoothly and present:\n\n{narration}"
            )
        elif kind == "resume":
            text = (
                "The student's question is fully answered. In one short sentence, recap where "
                f'we were in the section titled "{title}", then continue and finish presenting it:'
                f"\n\n{narration}"
            )
        elif kind == "jump":
            text = (
                f'The student has jumped to the section titled "{title}". Go there now and '
                f"present it from the top:\n\n{narration}"
            )
        else:
            text = (
                f'Now move on to the next section, titled "{title}". Bridge smoothly from '
                f"what you just covered, then present this:\n\n{narration}"
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
            # Orientation finished — start the actual tour at section 0.
            self.phase = "touring"
            await self._emit_section()
            await self._dispatch(kind="first_after_intro")
            return

        if self.phase == "detour":
            # Resume only once the answer has actually played (not on the cut-off
            # section turn finalizing). Otherwise keep waiting.
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
        if self.cursor >= len(self.sections):
            self.phase = "complete"
            await self.ws.send_json({"type": "tour_state", "value": "complete"})
            await self._send(
                "That was the final section. Give a brief, warm closing — one or two "
                "sentences — wrapping up the tour. Do not start a new topic."
            )
            return
        await self._emit_section()
        await self._dispatch(kind="next")

    async def _resume(self) -> None:
        self.phase = "touring"
        self.detour_answer_started = False
        await self._emit_section()
        await self._dispatch(kind="resume")

    async def jump_to(self, section_id: str) -> None:
        idx = self._index_of(section_id)
        if idx is None:
            return
        self.phase = "touring"
        self.detour_answer_started = False
        self.cursor = idx
        # Cut off whatever Gemini is currently narrating, then present the new section.
        # The self-induced interrupt yields one `interrupted` + one `turn_complete` to ignore.
        self._ignore_next_interrupt = True
        self._ignore_turn_completes += 1
        await self._interrupt()
        await self._emit_section()
        await self._dispatch(kind="jump")
