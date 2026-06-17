import json

from core.claude import async_client
from services.canvas.prompts import SECTION_SCHEMAS, build_planner_prompt

_WIDTHS = {"full", "wide", "half"}
_EMPHASES = {"lead", "normal", "aside"}
_HERO_STYLES = {"bold", "quiet", "editorial"}
_DENSITIES = {"airy", "balanced", "dense"}
_ACCENT_TREATMENTS = {"wash", "rule", "none"}


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)


def _normalize_layout(raw: object) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    width = raw.get("width") if raw.get("width") in _WIDTHS else "full"
    emphasis = raw.get("emphasis") if raw.get("emphasis") in _EMPHASES else "normal"
    columns = raw.get("columns") if raw.get("columns") in (1, 2) else 1
    return {"width": width, "emphasis": emphasis, "columns": columns}


def _normalize_theme(raw: object) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    motif = raw.get("motif")
    return {
        "motif": motif if isinstance(motif, str) and motif.strip() else "✦",
        "hero_style": raw.get("hero_style") if raw.get("hero_style") in _HERO_STYLES else "bold",
        "density": raw.get("density") if raw.get("density") in _DENSITIES else "balanced",
        "accent_treatment": raw.get("accent_treatment") if raw.get("accent_treatment") in _ACCENT_TREATMENTS else "wash",
    }


async def plan_canvas(
    muse_name: str,
    muse_description: str,
    level_note: str,
    synthesis: str,
    glossary_terms: str,
    gaps: list[str],
    resource_titles: list[str],
    lesson_titles: list[str],
) -> tuple[dict, list[dict]]:
    """Compose a free-form, topic-tailored Canvas. Returns (theme, blocks) where each
    block is {type, title, layout, intent}. No mandatory spine and no fixed length —
    the AI chooses the mix, order, and length. Unknown types are dropped (the per-type
    `data` schema is required to generate the block)."""
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
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = _parse_json(response.content[0].text)
    theme = _normalize_theme(parsed.get("theme"))

    blocks = [
        {
            "type": s["type"],
            "title": s["title"],
            "intent": s.get("intent", ""),
            "layout": _normalize_layout(s.get("layout")),
        }
        for s in parsed.get("sections", [])
        if isinstance(s, dict) and s.get("type") in SECTION_SCHEMAS and s.get("title")
    ]

    return theme, blocks
