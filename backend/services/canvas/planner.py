import json

from core.claude import async_client
from services.canvas.prompts import SECTION_SCHEMAS, build_planner_prompt


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)


async def plan_canvas(
    muse_name: str,
    muse_description: str,
    level_note: str,
    synthesis: str,
    glossary_terms: str,
    gaps: list[str],
    resource_titles: list[str],
    lesson_titles: list[str],
) -> list[dict]:
    """Return an ordered outline: [{type, title, intent}], constrained to the
    controlled vocabulary and to a hero-first / takeaways-last shape."""
    prompt = build_planner_prompt(
        muse_name=muse_name,
        muse_description=muse_description,
        level_note=level_note,
        synthesis=synthesis,
        glossary_terms=glossary_terms,
        gaps=gaps,
        resource_titles=resource_titles,
        lesson_titles=lesson_titles,
    )

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1536,
        messages=[{"role": "user", "content": prompt}],
    )
    outline = _parse_json(response.content[0].text).get("sections", [])

    # Keep only known types with the required fields.
    valid = [
        s for s in outline
        if isinstance(s, dict) and s.get("type") in SECTION_SCHEMAS and s.get("title")
    ]

    # Guarantee the spine: hero first, takeaways last.
    middle = [s for s in valid if s["type"] not in ("hero", "takeaways")]
    hero = next((s for s in valid if s["type"] == "hero"), None)
    takeaways = next((s for s in valid if s["type"] == "takeaways"), None)

    hero = hero or {"type": "hero", "title": muse_name, "intent": "Introduce the topic in one vivid line."}
    takeaways = takeaways or {"type": "takeaways", "title": "Takeaways", "intent": "The few things worth remembering."}

    return [hero, *middle, takeaways]
