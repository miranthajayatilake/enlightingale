from core.llm_json import complete_json
from services.canvas.prompts import build_document_prompt

_DENSITIES = {"airy", "balanced", "dense"}
_ACCENT_TREATMENTS = {"wash", "rule", "none"}

# Enforced tool-use shape — a recursive tree of presentation nodes (v0.4.2). The model
# emits {theme, nodes:[node]}; each node has a `kind` and may nest `children`. ids are
# NOT emitted by the model — the generator assigns them. The schema guarantees a valid
# tree shape (no truncation/escaping crashes — see v0.4.1).
_DOCUMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "theme": {
            "type": "object",
            "properties": {
                "motif": {"type": "string"},
                "density": {"type": "string"},
                "accent_treatment": {"type": "string"},
            },
        },
        "nodes": {"type": "array", "items": {"$ref": "#/$defs/node"}},
    },
    "required": ["nodes"],
    "$defs": {
        "node": {
            "type": "object",
            "properties": {
                "kind": {"type": "string"},
                "text": {"type": "string"},
                "richtext": {"type": "string"},
                "level": {"type": "integer"},
                "ordered": {"type": "boolean"},
                "items": {"type": "array", "items": {"type": "string"}},
                "value": {"type": "string"},
                "label": {"type": "string"},
                "cite": {"type": "string"},
                "tone": {"type": "string"},
                "emoji": {"type": "string"},
                "caption": {"type": "string"},
                "pairs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
                    },
                },
                "style": {"type": "object"},
                "children": {"type": "array", "items": {"$ref": "#/$defs/node"}},
            },
            "required": ["kind"],
        },
    },
}


def _normalize_theme(raw: object) -> dict:
    raw = raw if isinstance(raw, dict) else {}
    motif = raw.get("motif")
    return {
        "motif": motif if isinstance(motif, str) and motif.strip() else "✦",
        "density": raw.get("density") if raw.get("density") in _DENSITIES else "balanced",
        "accent_treatment": raw.get("accent_treatment") if raw.get("accent_treatment") in _ACCENT_TREATMENTS else "wash",
    }


async def generate_document(
    muse_name: str,
    muse_description: str,
    level_note: str,
    synthesis: str,
    glossary_terms: str,
    gaps: list[str],
    resource_titles: list[str],
) -> tuple[dict, list[dict]]:
    """Compose the unstructured page in one structured pass. Returns (theme, raw_nodes)
    where raw_nodes is the model's node tree WITHOUT ids (the generator assigns them)."""
    prompt = build_document_prompt(
        muse_name=muse_name,
        muse_description=muse_description,
        level_note=level_note,
        synthesis=synthesis,
        glossary_terms=glossary_terms,
        gaps=gaps,
        resource_titles=resource_titles,
    )
    parsed = await complete_json(prompt, max_tokens=8192, input_schema=_DOCUMENT_SCHEMA)
    theme = _normalize_theme(parsed.get("theme"))
    raw_nodes = parsed.get("nodes")
    return theme, raw_nodes if isinstance(raw_nodes, list) else []
