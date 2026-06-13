"""Prompts and per-type data schemas for Canvas generation.

The planner picks the ordered set of section types for a topic; the per-section
generator fills each section's title, data, and narration. Keeping a controlled
vocabulary with an explicit `data` schema per type keeps generation reliable and
frontend rendering total.
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

    return f"""You are designing the structure of a visual presentation ("Canvas") that teaches someone about "{muse_name}".

Learning goal: {muse_description}
Student level: {level_note}

Knowledge base overview:
{synthesis[:2_500]}

Key concepts available: {glossary_terms or "none"}
Known knowledge gaps: {gaps_text}
Resources available: {resources_text}
Existing lessons: {lessons_text}

Design an ordered sequence of 5 to 9 sections that takes the learner on a satisfying journey through this topic. Choose the section TYPES that best fit THIS topic — do not force types that do not fit.

Allowed section types: {allowed}

Rules:
- The FIRST section must be "hero".
- The LAST section must be "takeaways".
- Include "key_concepts" only if key concepts are available.
- Include "gaps" only if knowledge gaps are recorded.
- Include "resource_spotlight" only if resources are available.
- Include "timeline" only if the topic has a meaningful chronological dimension.
- Include "comparison" only if there is a natural contrast between two ideas, schools, or approaches.
- Use "prose" for narrative synthesis and "stat_band" sparingly for at-a-glance numbers.
- Do not repeat a type more than twice.

Return ONLY valid JSON:
{{
  "sections": [
    {{"type": "hero", "title": "Section heading shown on screen", "intent": "one line on what this section should convey"}}
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

    return f"""You are writing one section of a visual presentation ("Canvas") teaching someone about "{muse_name}".

Student level: {level_note}

This section's type: {section_type}
Heading: {title}
What it should convey: {intent}

Source material to draw from:
{context_block[:6_000]}

Produce TWO things for this section:
1. "data" — the visual content, matching EXACTLY this JSON shape for a "{section_type}" section:
   {schema}
2. "narration" — what the Mentor says aloud when presenting this section: 2 to 5 warm, flowing sentences in plain spoken language. NO markdown, NO bullet points, NO lists — it will be spoken, not read. Do not just read the data; explain and connect it.

Use only facts grounded in the source material. Keep text tight and concrete.

Return ONLY valid JSON:
{{
  "data": {schema},
  "narration": "..."
}}"""
