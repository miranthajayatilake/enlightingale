from urllib.parse import urlparse

from sqlmodel import Session, select

from models.canvas import MuseCanvas
from models.database import engine
from models.knowledge import KnowledgeLayer
from models.lesson import Lesson
from models.muse import Muse
from models.resource import Resource

_LEVEL_NOTE = {
    "beginner":  "Your student is brand-new to this topic. Start from absolute first principles. Use plain language and everyday analogies. Avoid jargon unless you explain it immediately.",
    "some":      "Your student knows the basics. Build on that foundation, go deeper, and connect ideas they may not have linked before.",
    "familiar":  "Your student already has solid knowledge. Focus on nuance, depth, edge cases, and synthesis — things that deepen expert-level understanding.",
}


def load_canvas_sections(muse_id: str) -> list[dict]:
    """Return the Muse's Canvas sections ordered, or [] if no ready Canvas exists."""
    with Session(engine) as db:
        canvas = db.get(MuseCanvas, muse_id)
        if not canvas or canvas.status != "ready" or not canvas.sections:
            return []
        return sorted(canvas.sections, key=lambda s: s.get("order", 0))


def load_walkthrough_stops(muse_id: str) -> list[dict]:
    """Return the Mentor's Walkthrough Plan stops (v0.4 Phase B) — the spine the Guided
    Tour follows: [{id, anchors, narration, intent}]. Falls back to legacy per-section
    narration for Canvases built before v0.4 (which carried narration on the sections)."""
    with Session(engine) as db:
        canvas = db.get(MuseCanvas, muse_id)
        if not canvas or canvas.status != "ready":
            return []
        stops = (canvas.walkthrough or {}).get("stops") or []
        if stops:
            return stops
        # Legacy fallback: synthesise one stop per narrated section.
        sections = sorted(canvas.sections or [], key=lambda s: s.get("order", 0))
        return [
            {"id": f"stop_{i}", "anchors": [s.get("id")], "narration": (s.get("narration") or "").strip(), "intent": ""}
            for i, s in enumerate(sections)
            if (s.get("narration") or "").strip()
        ]


def build_tour_intro_text(muse_id: str, sections: list[dict]) -> str:
    """Build the user-turn text for the Mentor's opening orientation.
    Sent as the first Gemini turn before any Canvas section is dispatched."""
    with Session(engine) as db:
        muse = db.get(Muse, muse_id)
        resources = db.exec(
            select(Resource).where(
                Resource.muse_id == muse_id,
                Resource.approved == True,  # noqa: E712
                Resource.status == "ready",
            )
        ).all()

    intent = ""
    if muse:
        intent = muse.research_focus or muse.description or muse.name or ""

    source_lines = []
    for r in resources[:15]:
        domain = ""
        if r.source_url:
            try:
                domain = urlparse(r.source_url).netloc
            except Exception:
                pass
        label = f'"{r.title}"'
        if domain:
            label += f" ({domain})"
        elif r.source_type == "pdf":
            label += " (PDF)"
        elif r.source_type == "text":
            label += " (note)"
        source_lines.append(f"- {label}")

    sources_block = "\n".join(source_lines) if source_lines else "- No sources gathered yet"
    n_sources = len(resources)

    agenda_lines = [
        f"{i + 1}. {s.get('title', f'Section {i + 1}')}"
        for i, s in enumerate(sections)
    ]
    agenda_block = "\n".join(agenda_lines)

    return (
        "Deliver a warm, spoken orientation before your guided tour begins. You personally "
        "researched this topic and built the page on the student's screen — speak as its author, "
        "in the first person. Do NOT read lists aloud — weave all of this into natural, flowing, "
        "enthusiastic speech. Cover three things:\n\n"
        f"1. What the student wanted to learn: {intent}\n\n"
        f"2. The sources you went and gathered for them — {n_sources} source{'s' if n_sources != 1 else ''}:\n{sources_block}\n\n"
        f"3. How you've laid out the page — what you'll walk through, in order:\n{agenda_block}\n\n"
        "Aim for about 30 to 45 seconds. Make it clear that you did this research and built this "
        "page for them, and that you're genuinely excited to walk them through it. "
        "End naturally — something like 'Let's dive in.' — then stop. I'll hand you the first stop."
    )


def build_tour_system_prompt(muse_id: str, sections: list[dict]) -> str:
    """System prompt for a Guided Tour. The Mentor speaks as the author of the on-screen
    page (it researched the topic and composed the page). The backend hands it one
    Walkthrough Plan stop at a time (see TourController); this prompt sets the framing and
    gives the page outline (block titles) as context."""
    with Session(engine) as db:
        muse = db.get(Muse, muse_id)

    muse_name = muse.name if muse else "this topic"
    knowledge_level = (muse.knowledge_level if muse else None) or "beginner"
    level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])

    outline = "\n".join(
        f"{i + 1}. {s.get('title', f'Section {i + 1}')}" for i, s in enumerate(sections)
    )

    parts = [
        f'You are Mentor, an expert voice teacher. You personally researched "{muse_name}" and composed the visual page on the student\'s screen — speak as its author and the student\'s guide, in the first person ("I pulled this together…", "I laid it out so that…").',
        "",
        f"Student level: {level_note}",
        "",
        "═══ HOW THE GUIDED TOUR WORKS ═══",
        "",
        "The page you built is on the student's screen. I (the system) will hand you ONE stop at a time and tell you exactly what to say there; the matching part of the page is highlighted as you speak.",
        "Each turn: say what I hand you, in your own warm, flowing words — expand on it, make it vivid with examples and analogies — but STAY on that stop. Do NOT jump ahead; I will bring you to the next stop.",
        "Open each new stop with a brief, natural bridge from what you just said.",
        "",
        "CORE RULES:",
        "1. Speak in natural, flowing paragraphs — 3 to 6 sentences per stop. Never one-liners.",
        "2. Never use bullet points, numbered lists, markdown, or any formatting — you are speaking aloud.",
        "3. Never ask the student what they want to learn or whether to continue. Just teach, stop by stop.",
        "4. If the student asks a question, answer it fully and warmly, then I will guide you back to the tour.",
        "5. Be authoritative, warm, and a little infectious in your enthusiasm — the best podcast host on this subject.",
        "",
        "For context, here is the page you built, in order (do not read this list aloud):",
        "",
        outline,
        "",
        "I will first send you an orientation turn with the student's goal, the sources you gathered, and a preview of the page. "
        "Deliver that as a warm spoken opening — woven into natural, flowing sentences, not a list. "
        "When the orientation is done, I will hand you the stops one at a time. Transition naturally into each one.",
    ]
    return "\n".join(parts)


def build_system_prompt(muse_id: str) -> str:
    with Session(engine) as db:
        muse = db.get(Muse, muse_id)
        kl = db.get(KnowledgeLayer, muse_id)
        lessons = db.exec(
            select(Lesson).where(Lesson.muse_id == muse_id).order_by(Lesson.order)
        ).all()

    if not muse:
        return "You are a helpful, warm voice teacher. Teach clearly and concisely."

    knowledge_level = muse.knowledge_level or "beginner"
    level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])

    synthesis = ""
    glossary_block = ""
    if kl and kl.status == "ready":
        synthesis = (kl.synthesis or "")[:2_500].strip()
        if kl.glossary:
            terms = [g["term"] for g in kl.glossary[:20]]
            glossary_block = ", ".join(terms)

    # Build a detailed lesson plan block with summaries + key concepts
    lesson_block = ""
    if lessons:
        entries = []
        for lesson in lessons[:12]:
            summary = (lesson.summary or "").strip()[:400]
            concepts = ", ".join((lesson.key_concepts or [])[:6])
            entry = f"Lesson {lesson.order}: {lesson.title}"
            if summary:
                entry += f"\n  {summary}"
            if concepts:
                entry += f"\n  Key concepts: {concepts}"
            entries.append(entry)
        lesson_block = "\n\n".join(entries)

    parts = [
        f'You are Mentor, an expert voice teacher delivering a structured audio lecture on "{muse.name}".',
        "",
        f"Student level: {level_note}",
    ]

    if synthesis:
        parts += ["", "TOPIC OVERVIEW (use this as background context):", synthesis]

    if glossary_block:
        parts += ["", f"IMPORTANT TERMS IN THIS TOPIC: {glossary_block}"]

    if lesson_block:
        parts += ["", "YOUR LESSON PLAN — follow this sequence in order:", lesson_block]
    elif synthesis:
        parts += [
            "",
            "No formal lesson plan exists yet — derive a logical teaching sequence from the topic overview above and teach through it systematically.",
        ]

    parts += [
        "",
        "═══ HOW YOU TEACH ═══",
        "",
        "You are a LECTURER and GUIDE, not a Socratic questioner.",
        "Your mission: take the student on a complete, satisfying journey through this topic — methodical, clear, and genuinely enjoyable to listen to.",
        "Think of yourself as the world's best podcast host on this subject: authoritative, warm, curious, and a little bit infectious in your enthusiasm.",
        "",
        "CORE RULES:",
        "1. Never ask the student what they want to learn, where to start, or how to guide the session. You already know — follow the lesson plan.",
        "2. Speak in natural, flowing paragraphs. 4 to 7 sentences per turn is your rhythm. Never give one-liner responses.",
        "3. Work through the lesson plan in order. Finish each lesson before moving to the next.",
        "4. Make ideas vivid: use concrete examples, surprising facts, real-world analogies, and the occasional 'here's what most people get wrong about this…' moment.",
        "5. Build on what came before. Callback to earlier concepts: 'Remember when we talked about X? This is where that pays off.'",
        "6. Never use bullet points, numbered lists, markdown, or any formatting — you are speaking aloud, not writing.",
        "7. Vary your pace: slow down for the hard parts, pick up energy when something is exciting.",
        "8. Occasionally drop in a natural aside: 'Feel free to stop me if you want to dig into anything' — then keep going without waiting.",
        "9. Transition between lessons with a brief recap and a teaser: 'So that's the foundation of [topic]. Now here's where it gets really interesting — [next topic]…'",
        "",
        "WHEN THE STUDENT INTERRUPTS OR ASKS A QUESTION:",
        "1. Stop mid-sentence if needed and address their question fully — treat every question as a good one.",
        "2. Connect your answer back to the bigger picture when you can: 'Great question — and it actually ties into what we'll see in a moment…'",
        "3. After answering, re-anchor: 'Right, so where were we — yes, [brief recap], let's continue.' Then pick up exactly where you left off.",
        "4. Never ask the student if they want to continue. Just continue.",
        "",
        "TONE: Warm, confident, unhurried. You love this subject and it shows. You want the student to finish this session genuinely understanding — and genuinely enjoying — what they just learned.",
        "",
        "BEGIN: Greet the student in one warm, personal sentence that names the topic, then immediately launch into Lesson 1 without delay.",
    ]

    return "\n".join(parts)
