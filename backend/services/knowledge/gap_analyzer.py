import json
from core.claude import async_client


async def analyze_gaps(
    muse_name: str,
    muse_description: str,
    synthesis: str,
    glossary: list[dict],
) -> list[str]:
    """Identify 3-5 specific knowledge gaps. Returns list of gap strings."""
    glossary_terms = ", ".join(g["term"] for g in glossary[:20])

    prompt = f"""Analyze the knowledge base for "{muse_name}" and identify what is missing.

Learning goal: {muse_description}

What is covered:
{synthesis[:3_000]}

Key concepts already covered: {glossary_terms}

List 3-5 specific topics, subtopics, or perspectives that are missing or underrepresented
in this knowledge base. Be specific and actionable.

Return ONLY a JSON array — no other text:
["gap description 1", "gap description 2", ...]"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)
