import json
from services.research_agent._json import complete_json

_LEVEL_NOTE = {
    "beginner":  "Reject sources that are too technical or academic without clear explanations.",
    "some":      "Accept a mix of accessible and intermediate-level sources.",
    "familiar":  "Prefer in-depth, analytical, and expert sources over introductory ones.",
}

_BATCH_SIZE = 12


async def _evaluate_batch(
    batch: list[dict],
    muse_name: str,
    muse_description: str,
    level_note: str,
) -> list[dict]:
    sources_json = json.dumps(
        [{"url": r["url"], "title": r["title"], "snippet": r["content"][:400]} for r in batch],
        indent=2,
    )

    prompt = f"""You are evaluating web sources for a curated learning knowledge base.

Topic: {muse_name}
Learning goal: {muse_description}
Level note: {level_note}

Score each source. Return ONLY valid JSON — no markdown, no surrounding text:

{{
  "evaluations": [
    {{
      "url": "exact url from input",
      "relevance": 8,
      "depth": 7,
      "quality": 9,
      "accept": true,
      "reason": "One sentence explaining accept or reject decision"
    }}
  ]
}}

Scoring (0-10):
- relevance: How directly relevant to the learning goal
- depth: How substantive vs surface-level
- quality: Authoritative, well-written, trustworthy

Accept if average score >= 6.5.
Always reject: paywalled content, Reddit/social media, forums, empty pages.

Sources:
{sources_json}"""

    result = await complete_json(prompt, max_tokens=4096)
    return result.get("evaluations", []) if isinstance(result, dict) else []


async def evaluate_sources(
    results: list[dict],
    muse_name: str,
    muse_description: str,
    knowledge_level: str,
) -> list[dict]:
    """Score each result with Claude in batches. Returns only accepted results."""
    if not results:
        return []

    level_note = _LEVEL_NOTE.get(knowledge_level, _LEVEL_NOTE["beginner"])

    # Process in batches so the JSON output never exceeds max_tokens
    all_evaluations: list[dict] = []
    for i in range(0, len(results), _BATCH_SIZE):
        batch = results[i : i + _BATCH_SIZE]
        evals = await _evaluate_batch(batch, muse_name, muse_description, level_note)
        all_evaluations.extend(evals)

    eval_map = {e["url"]: e for e in all_evaluations}

    return [
        {**r, "evaluation": eval_map[r["url"]]}
        for r in results
        if eval_map.get(r["url"], {}).get("accept")
    ]
