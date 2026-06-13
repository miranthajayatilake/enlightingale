import json
from core.claude import async_client

_LEVEL_INSTRUCTION = {
    "beginner":  "Start from the absolute basics. Build from first principles. Define every term before using it.",
    "some":      "Assume familiarity with the basics. Build a coherent framework and go deeper into concepts.",
    "familiar":  "Skip introductory material. Focus on depth, nuance, edge cases, and advanced applications.",
}


async def generate_curriculum(
    muse_name: str,
    muse_description: str,
    knowledge_level: str,
    synthesis: str,
    glossary: list[dict],
) -> list[dict]:
    """Return ordered lesson stubs: [{order, title, objective, key_concepts, focus}]"""
    glossary_terms = ", ".join(g["term"] for g in glossary[:20])
    level_note = _LEVEL_INSTRUCTION.get(knowledge_level, _LEVEL_INSTRUCTION["beginner"])

    prompt = f"""Design a lesson curriculum for someone learning about "{muse_name}".

Learning goal: {muse_description}
Level: {level_note}

Knowledge base overview:
{synthesis[:3_000]}

Key concepts available: {glossary_terms}

Create 5-8 lessons that build on each other progressively. Each lesson should focus on one coherent theme.

Return ONLY valid JSON:
{{
  "lessons": [
    {{
      "order": 1,
      "title": "Lesson title",
      "objective": "By the end of this lesson, the student will understand...",
      "key_concepts": ["concept1", "concept2"],
      "focus": "2-sentence description of what this lesson covers and why it matters"
    }}
  ]
}}"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text).get("lessons", [])
