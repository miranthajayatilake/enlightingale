"""Prompts and per-type data schemas for Canvas generation (v0.4 — free-form).

The planner composes an ordered, topic-tailored sequence of blocks — choosing the
mix, order, length, per-block layout, and a light per-Muse visual theme freely (no
mandatory spine, no fixed length). The per-block generator then fills each block's
visual `data` only. Narration is NOT produced here: the Mentor authors a separate
Walkthrough Plan after reading the finished page (PRD v0.4 §3, KD2).

Keeping an explicit `data` schema per type keeps generation reliable and frontend
rendering total (unknown types fall back to prose).
"""

# Per-type `data` schema. `schema` is shown to the model; `required` are the top-level
# keys the generator validates before accepting a section (invalid sections are dropped).
SECTION_SCHEMAS: dict[str, dict] = {
    "hero": {
        "schema": '{"essence": "one vivid sentence capturing the topic", "emoji": "a single emoji", "stats": [{"label": "Resources", "value": "12"}]}',
        "required": ["essence"],
    },
    "prose": {
        "schema": '{"markdown": "2-4 short paragraphs of readable synthesis. Headings and **emphasis** only — no lists, no links."}',
        "required": ["markdown"],
    },
    "key_concepts": {
        "schema": '{"concepts": [{"term": "Concept name", "definition": "one-sentence plain definition"}]}',
        "required": ["concepts"],
    },
    "timeline": {
        "schema": '{"events": [{"when": "1789", "label": "Short event title", "detail": "one sentence of context"}]}',
        "required": ["events"],
    },
    "comparison": {
        "schema": '{"columns": ["Option A", "Option B"], "rows": [{"label": "Dimension", "a": "how A handles it", "b": "how B handles it"}]}',
        "required": ["columns", "rows"],
    },
    "stat_band": {
        "schema": '{"stats": [{"label": "Sources", "value": "12"}, {"label": "Key concepts", "value": "8"}]}',
        "required": ["stats"],
    },
    "resource_spotlight": {
        "schema": '{"items": [{"resource_id": "the id from the provided resource list", "title": "Resource title", "why": "one sentence on why it matters"}]}',
        "required": ["items"],
    },
    "data_sources": {
        "schema": '{"summary": "one sentence describing the breadth of sources gathered", "sources": [{"title": "Source title", "type": "url", "domain": "hostname or null", "snippet": "one sentence on what this source contributed"}]}',
        "required": ["summary", "sources"],
    },
    "pull_quote": {
        "schema": '{"quote": "a short, striking sentence that captures something essential about the topic", "attribution": "who said it or where it is from, or null"}',
        "required": ["quote"],
    },
    "callout": {
        "schema": '{"tone": "info | tip | warning", "body": "one or two sentences worth emphasising — a key insight, a caution, or a useful tip"}',
        "required": ["body"],
    },
    "gaps": {
        "schema": '{"items": ["A question or area worth exploring next", "Another one"]}',
        "required": ["items"],
    },
    "takeaways": {
        "schema": '{"points": ["A thing to remember", "Another key takeaway"]}',
        "required": ["points"],
    },
}


def build_planner_prompt(
    muse_name: str,
    muse_description: str,
    level_note: str,
    synthesis: str,
    glossary_terms: str,
    gaps: list[str],
    resource_titles: list[str],
    lesson_titles: list[str],
) -> str:
    gaps_text = "; ".join(gaps[:10]) or "none recorded"
    resources_text = "; ".join(resource_titles[:20]) or "none"
    lessons_text = "; ".join(lesson_titles[:15]) or "none"
    allowed = ", ".join(sorted(SECTION_SCHEMAS.keys()))

    return f"""You are the author and designer of a one-of-a-kind visual web page (a "Canvas") that teaches someone about "{muse_name}". This page should feel hand-built for THIS topic — not assembled from a template. Two different topics should produce visibly different pages: different section mixes, different rhythm, different length.

Learning goal: {muse_description}
Student level: {level_note}

Knowledge base overview:
{synthesis[:2_500]}

Key concepts available: {glossary_terms or "none"}
Known knowledge gaps: {gaps_text}
Resources available: {resources_text}
Existing lessons: {lessons_text}

Compose an ordered sequence of blocks that takes the learner on a satisfying journey through this topic. You decide the composition freely.

Block-type palette (compose from these; mix and order however the topic wants):
{allowed}

Composition principles — NOT a template:
- Length follows the topic: a slim topic may need as few as 4 blocks; a rich one may want 10–12. Let the material decide. Do not pad.
- Most pages benefit from an opening "hero" and a closing "takeaways", but this is guidance, not a rule — open and close however serves the topic.
- When real resources exist, an early "data_sources" block builds trust by showing where the knowledge came from. Strongly consider it, but it is optional.
- Let the subject drive the structure: a historical topic leans on "timeline"; a comparative field on "comparison"; a jargon-heavy domain on "key_concepts". A topic that needs none of those should use none.
- You may repeat a type when it genuinely helps (e.g. two "prose" blocks separated by a "key_concepts"), but never just to fill space. Every block must earn its place.

Per-block layout — use this to create visual rhythm (vary it; don't make everything the same):
- "width": "full" (default, spans the column) | "wide" (a touch wider, for heroes/timelines) | "half" (a compact block that can read as an aside)
- "emphasis": "lead" (a marquee block, e.g. the hero) | "normal" (default) | "aside" (a quieter supporting block, e.g. a callout or spotlight)
- "columns": 1 (default) | 2 (only for blocks whose content reads well side by side)

Per-Muse theme — a light visual identity for the whole page:
- "motif": a single emoji that best represents this topic
- "hero_style": "bold" (big and punchy) | "quiet" (understated, editorial) | "editorial" (magazine-like)
- "density": "airy" | "balanced" | "dense" — the overall spacing rhythm
- "accent_treatment": "wash" (soft accent backgrounds) | "rule" (accent rules/dividers) | "none"

Return ONLY valid JSON:
{{
  "theme": {{"motif": "🧭", "hero_style": "bold", "density": "balanced", "accent_treatment": "wash"}},
  "sections": [
    {{"type": "hero", "title": "Section heading shown on screen", "layout": {{"width": "wide", "emphasis": "lead", "columns": 1}}, "intent": "one line on what this block should convey"}}
  ]
}}"""


def build_walkthrough_prompt(
    muse_name: str,
    level_note: str,
    synthesis: str,
    page_block: str,
) -> str:
    """Phase B: the Mentor reads the finished page and plans how to teach it (PRD v0.4 §6.2)."""
    return f"""You are Mentor — the teacher who personally researched "{muse_name}" and built the web page below for your student. Now plan how you will walk them through it, out loud, one stop at a time.

Student level: {level_note}

Background you can draw on:
{synthesis[:1_500]}

THE PAGE YOU BUILT — each block has an id, a type, a heading, the anchor ids you can highlight, and its content:
{page_block}

Produce an ordered list of "stops" — the steps of your spoken walkthrough. For each stop:
- "anchors": the anchor id(s) to highlight on screen while you speak this stop. Use ONLY ids that appear in the page above. Prefer the SMALLEST unit that matches what you're saying — a single concept (e.g. "b2.c1"), one timeline event ("b3.e0"), one paragraph ("b1.p0") — and use a whole-block id (e.g. "b1") only when you're introducing or summing up that block.
- "narration": what you SAY at this stop — 2 to 5 warm, flowing sentences, in the FIRST PERSON as the author of this page ("I pulled this together because…", "Notice here…"). Plain spoken language: NO markdown, NO bullet points, NO lists. Explain and connect the material; do not just read what's on screen.
- "intent": a few words naming the purpose of this stop.

How to plan the walkthrough:
- Generally move top to bottom through the page, but the pacing is your call.
- Break a dense block into several stops (each highlighting a different anchor inside it) when it deserves unpacking.
- You may fold a few small, closely-related items into a single stop.
- A short spoken orientation already greets the student before this, so don't re-introduce the whole topic — ease straight into the first block.
- Aim for a natural lecture rhythm: not one stop per tiny element, and not the entire page in one breath.

Return ONLY valid JSON:
{{
  "stops": [
    {{"anchors": ["b0", "b0.t"], "narration": "...", "intent": "..."}}
  ]
}}"""


def build_section_prompt(
    section_type: str,
    title: str,
    intent: str,
    muse_name: str,
    level_note: str,
    context_block: str,
) -> str:
    schema = SECTION_SCHEMAS[section_type]["schema"]

    data_sources_note = (
        "\nIMPORTANT: For a \"data_sources\" section, populate the \"sources\" array using ONLY "
        "the resources listed in the source material above — do not invent or add any sources. "
        "Copy titles verbatim. Write a genuine one-sentence snippet for each based on what the "
        "title suggests about its contribution to the topic.\n"
        if section_type == "data_sources" else ""
    )

    return f"""You are filling in the visual content of one block of a web page ("Canvas") teaching someone about "{muse_name}".

Student level: {level_note}

This block's type: {section_type}
Heading: {title}
What it should convey: {intent}
{data_sources_note}
Source material to draw from:
{context_block[:6_000]}

Produce the block's visual content as "data", matching EXACTLY this JSON shape for a "{section_type}" block:
   {schema}

Use only facts grounded in the source material. Keep text tight and concrete. Do not write any spoken narration — only the on-screen content.

Return ONLY valid JSON:
{{
  "data": {schema}
}}"""
