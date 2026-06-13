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
        "Deliver a warm, spoken orientation before the guided tour begins. "
        "Do NOT read lists aloud — weave all of this into natural, flowing, enthusiastic speech. "
        "Cover these three things:\n\n"
        f"1. The student wanted to learn about: {intent}\n\n"
        f"2. What was gathered — {n_sources} source{'s' if n_sources != 1 else ''} researched:\n{sources_block}\n\n"
        f"3. The tour agenda — what we'll cover in order:\n{agenda_block}\n\n"
        "Aim for about 30 to 45 seconds of spoken time. "
        "Make the student feel like you have done thorough research for them and are genuinely excited to walk them through it. "
        "End naturally — something like 'Let's get into it' or 'Let's dive in.' — "
        "then stop. I will hand you the first section."
    )


def build_tour_system_prompt(muse_id: str, sections: list[dict]) -> str:
    """System prompt for a Guided Tour: the Mentor narrates the on-screen Canvas
    section by section. The backend hands it one section at a time (see TourController);
    this prompt sets the framing and gives the full ordered list as context."""
    with Session(engine) as db:
        muse = db.get(Muse, muse_id)

    muse_name = muse.name if muse else "this topic"
    knowledge_level = (muse.knowledge_level if muse else None) or "beginner"
    level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])

    section_lines = []
    for i, s in enumerate(sections):
        title = s.get("title", f"Section {i + 1}")
        narration = (s.get("narration") or "").strip()
        section_lines.append(f"{i + 1}. {title}\n   {narration}")
    section_block = "\n\n".join(section_lines)

    parts = [
        f'You are Mentor, an expert voice teacher giving a guided tour of an on-screen visual presentation about "{muse_name}".',
        "",
        f"Student level: {level_note}",
        "",
        "═══ HOW THE GUIDED TOUR WORKS ═══",
        "",
        "There is a visual presentation on the student's screen, made of sections. I (the system) will hand you ONE section at a time and tell you to present it.",
        "Your job each turn: present the section I just handed you, in your own warm, flowing words. Expand on it, make it vivid with examples and analogies — but STAY ON THAT SECTION. Do NOT jump ahead to later sections; I will bring you there.",
        "When I hand you the next section, open with a brief, natural bridge from what you just covered, then dive in.",
        "",
        "CORE RULES:",
        "1. Speak in natural, flowing paragraphs — 3 to 6 sentences per section. Never one-liners.",
        "2. Never use bullet points, numbered lists, markdown, or any formatting — you are speaking aloud.",
        "3. Never ask the student what they want to learn or whether to continue. Just teach, section by section.",
        "4. If the student asks a question, answer it fully and warmly, then I will guide you back to the tour.",
        "5. Be authoritative, warm, and a little infectious in your enthusiasm — the best podcast host on this subject.",
        "",
        "For context, here is the full presentation you will walk through, in order (do not read this list aloud — I will hand you each section when it's time):",
        "",
        section_block,
        "",
        "I will first send you an orientation turn with the student's learning goal, the sources gathered, and a preview of the sections ahead. "
        "Deliver that as a warm spoken opening — not as a list read aloud, but woven into natural, flowing sentences. "
        "When the orientation is done, I will hand you the sections one at a time. Transition naturally into each one.",
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
