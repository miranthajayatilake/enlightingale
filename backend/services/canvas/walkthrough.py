"""Mentor Walkthrough Planner (Canvas build Phase B — PRD v0.4 §6.2, KD2).

After the free-form page is generated (Phase A), the Mentor "reads" its finished page
and authors a Walkthrough Plan: an ordered list of teaching `stops`, each referencing one
or more page anchors and carrying the narration the Mentor will speak at that stop.

This decouples teaching from generation: the page can be any shape, and the highlighted
walkthrough is still deterministic because the Mentor highlights anchor ids it chose here.
Best-effort — falls back to a one-stop-per-block plan if the model output is unusable.
"""

from core.llm_json import complete_json
from core.logging import logger
from services.canvas.prompts import build_walkthrough_prompt

# Enforced tool-use shape — guarantees `stops` is an array of {anchors, narration, …}.
_WALKTHROUGH_SCHEMA = {
    "type": "object",
    "properties": {
        "stops": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "anchors": {"type": "array", "items": {"type": "string"}},
                    "narration": {"type": "string"},
                    "intent": {"type": "string"},
                },
                "required": ["anchors", "narration"],
            },
        },
    },
    "required": ["stops"],
}


def _node_text(node: dict) -> str:
    """A short readable summary of a node's content for the reading-pass prompt."""
    text = node.get("text") or node.get("richtext") or node.get("caption") or ""
    if not text and node.get("label"):
        text = f"{node.get('value', '')} {node['label']}".strip()
    if not text and isinstance(node.get("items"), list):
        text = "; ".join(str(x) for x in node["items"][:6])
    if not text and isinstance(node.get("pairs"), list):
        text = "; ".join(f"{p.get('key')}: {p.get('value')}" for p in node["pairs"][:6] if isinstance(p, dict))
    return text


def _serialize_page(nodes: list[dict], depth: int = 0) -> str:
    """Render the node tree as an indented "[id] kind: content" outline."""
    lines = []
    for n in nodes:
        indent = "  " * depth
        content = _node_text(n)
        if len(content) > 160:
            content = content[:160] + "…"
        lines.append(f'{indent}[{n["id"]}] {n.get("kind")}: {content}'.rstrip())
        if isinstance(n.get("children"), list):
            child_block = _serialize_page(n["children"], depth + 1)
            if child_block:
                lines.append(child_block)
    return "\n".join(lines)


def _valid_anchors(nodes: list[dict]) -> set[str]:
    valid: set[str] = set()
    for n in nodes:
        valid.add(n["id"])
        if isinstance(n.get("children"), list):
            valid |= _valid_anchors(n["children"])
    return valid


def _validate_stops(raw_stops: object, valid: set[str]) -> list[dict]:
    stops: list[dict] = []
    if not isinstance(raw_stops, list):
        return stops
    for s in raw_stops:
        if not isinstance(s, dict):
            continue
        narration = (s.get("narration") or "").strip()
        anchors = [a for a in (s.get("anchors") or []) if isinstance(a, str) and a in valid]
        if not narration or not anchors:
            continue
        stops.append({
            "id": f"stop_{len(stops)}",
            "anchors": anchors,
            "narration": narration,
            "intent": (s.get("intent") or "").strip(),
        })
    return stops


def _fallback_plan(nodes: list[dict]) -> dict:
    """One stop per top-level node when planning fails — degraded but usable."""
    return {
        "stops": [
            {
                "id": f"stop_{i}",
                "anchors": [n["id"]],
                "narration": f"Let's look at {(_node_text(n) or 'this part')[:60]}.",
                "intent": "auto-generated fallback",
            }
            for i, n in enumerate(nodes)
        ]
    }


async def plan_walkthrough(
    muse_name: str,
    level_note: str,
    synthesis: str,
    sections: list[dict],
) -> dict:
    """Return the Walkthrough Plan: {stops: [{id, anchors, narration, intent}]}."""
    if not sections:
        return {"stops": []}

    prompt = build_walkthrough_prompt(
        muse_name=muse_name,
        level_note=level_note,
        synthesis=synthesis,
        page_block=_serialize_page(sections),
    )
    try:
        parsed = await complete_json(prompt, max_tokens=6144, input_schema=_WALKTHROUGH_SCHEMA)
        stops = _validate_stops(parsed.get("stops", []), _valid_anchors(sections))
    except Exception:
        logger.exception("Walkthrough planning failed — using fallback plan")
        return _fallback_plan(sections)

    if not stops:
        logger.warning("Walkthrough planner returned no valid stops — using fallback plan")
        return _fallback_plan(sections)

    return {"stops": stops}
