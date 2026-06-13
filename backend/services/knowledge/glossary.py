import json
from core.claude import async_client


async def build_glossary(muse_name: str, all_concepts: list[str]) -> list[dict]:
    """Define the most important concepts in context. Returns [{term, definition}]."""
    if not all_concepts:
        return []

    # Deduplicate (case-insensitive), keep first occurrence casing, cap at 20
    seen: set[str] = set()
    unique: list[str] = []
    for c in all_concepts:
        key = c.lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(c.strip())
        if len(unique) >= 20:
            break

    prompt = f"""Define these key concepts in the context of learning about "{muse_name}".

Concepts: {json.dumps(unique)}

Return ONLY a JSON array — no markdown, no surrounding text:
[
  {{"term": "exact concept name", "definition": "1-2 sentence definition in the context of {muse_name}"}},
  ...
]"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)
