"""Prompts for Canvas generation (v0.4.2 — unstructured node-tree page).

The page is composed as a free-form tree of generic *presentation* primitives
(heading / text / list / quote / stat / columns / grid / card / …) — NOT topic-semantic
section types. There is no hero, no takeaways spine, no fixed order or length: the AI
designs the page from scratch for the topic. Narration is NOT produced here — the Mentor
authors a separate Walkthrough Plan after reading the finished page (PRD v0.4 §3, v0.4.2).
"""

# The presentation primitives the AI may compose. Generic layout/typography — no topic roles.
NODE_KINDS = {
    "heading", "text", "list", "quote", "stat", "key_value", "callout",
    "figure", "divider", "group", "columns", "grid", "card",
}
CONTAINER_KINDS = {"group", "columns", "grid", "card"}


def build_document_prompt(
    muse_name: str,
    muse_description: str,
    level_note: str,
    synthesis: str,
    glossary_terms: str,
    gaps: list[str],
    resource_titles: list[str],
) -> str:
    gaps_text = "; ".join(gaps[:10]) or "none recorded"
    resources_text = "; ".join(resource_titles[:20]) or "none"

    return f"""You are the author and designer of a one-of-a-kind web page that teaches someone about "{muse_name}". Design it FROM SCRATCH for this exact topic. There is NO template, NO required title banner, NO fixed section types, and NO prescribed order or length. Two different topics must produce visibly different pages — different entry points, hierarchy, rhythm, and layout.

Learning goal: {muse_description}
Student level: {level_note}

Knowledge to draw from (use ONLY this — do not invent facts or sources):
{synthesis[:3_000]}

Key concepts: {glossary_terms or "none"}
Open questions / gaps: {gaps_text}
Sources gathered: {resources_text}

Compose the page as an ordered list of presentation "nodes". These are GENERIC layout & typography primitives, not topic sections. Use them freely and creatively to give this topic its own shape.

NODE KINDS:
- "heading": {{ "level": 1|2|3, "text": "...", "style": {{ "size": "display|xl|lg|base" }} }} — a title/subtitle. "display" is the biggest. Use deliberately, not as a mandatory top banner.
- "text": {{ "richtext": "a paragraph; inline **bold**, *italic*, [links](url) only — no headings or lists inside" }}
- "list": {{ "ordered": true|false, "items": ["...", "..."] }}
- "quote": {{ "text": "a striking line worth pulling out", "cite": "who/where, or null" }}
- "stat": {{ "value": "1959", "label": "what it measures" }}
- "key_value": {{ "pairs": [ {{ "key": "...", "value": "..." }} ] }}
- "callout": {{ "tone": "info|tip|warning", "richtext": "an aside worth emphasising" }}
- "figure": {{ "emoji": "🎷", "caption": "..." }}
- "divider": {{}}
- CONTAINERS hold a "children" array of more nodes:
  - "group": {{ "children": [...] }} — a plain vertical stack
  - "columns": {{ "style": {{ "cols": 2|3 }}, "children": [...] }} — side-by-side
  - "grid": {{ "style": {{ "cols": 2|3 }}, "children": [...] }} — a tile grid
  - "card": {{ "children": [...] }} — a bordered panel

RULES:
- DESIGN, don't fill a template. Choose the entry point, the hierarchy, where to use columns / grids / cards / quotes / stats, and the overall rhythm based on what THIS topic wants. Avoid the formulaic "big title → intro paragraph → uniform sections" skeleton.
- Vary the opening: a bold statement, a question, a striking stat, a short scene, or straight into substance — whatever fits. Asymmetry and surprise are good.
- Ground every claim in the knowledge above. Keep text tight and concrete.
- Inside "text"/"callout" richtext use inline emphasis only — never headings or bullet lists (use "heading"/"list" nodes for those).
- Do NOT include "id" fields — ids are assigned automatically.
- Also pick a page "theme": {{ "motif": one emoji for the topic, "density": "airy|balanced|dense", "accent_treatment": "wash|rule|none" }}.

Return your result as {{ "theme": {{...}}, "nodes": [ ... ] }}."""


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

THE PAGE YOU BUILT — an indented tree of nodes; each line is "[node-id] kind: content":
{page_block}

Produce an ordered list of "stops" — the steps of your spoken walkthrough. For each stop:
- "anchors": the node id(s) to highlight on screen while you speak this stop. Use ONLY ids that appear in the page above. Prefer the SMALLEST node that matches what you're saying; use a container's id only when you're introducing or summing up that whole group.
- "narration": what you SAY at this stop — 2 to 5 warm, flowing sentences, in the FIRST PERSON as the author of this page ("I pulled this together because…", "Notice here…"). Plain spoken language: NO markdown, NO bullet points, NO lists. Explain and connect; don't just read what's on screen.
- "intent": a few words naming the purpose of this stop.

How to plan the walkthrough:
- Generally move top to bottom through the page, but the pacing is your call.
- Break a dense area into several stops (each highlighting a different node) when it deserves unpacking.
- You may fold a few small, closely-related nodes into a single stop.
- A short spoken orientation already greets the student before this, so don't re-introduce the whole topic — ease straight in.
- Aim for a natural lecture rhythm: not one stop per tiny element, and not the whole page in one breath.

Return your result as {{ "stops": [ {{ "anchors": ["n0"], "narration": "...", "intent": "..." }} ] }}."""
