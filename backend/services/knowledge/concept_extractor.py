import json
from core.claude import async_client


async def extract_concepts(title: str, content: str) -> list[str]:
    """Extract 5-8 key concepts from a single resource."""
    prompt = f"""Extract the 5-8 most important concepts, terms, or ideas from this resource.

Title: {title}

Content:
{content[:5_000]}

Return ONLY a JSON array of short concept strings, no other text:
["concept 1", "concept 2", ...]"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)
