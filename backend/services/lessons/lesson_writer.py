from core.claude import async_client

_LEVEL_STYLE = {
    "beginner":  "Use plain language. Define every term before using it. Use concrete analogies. No assumed prior knowledge.",
    "some":      "Use some technical vocabulary but explain it. Connect new concepts to what the reader likely already knows.",
    "familiar":  "Use precise technical language. Focus on depth and nuance. Challenge the reader's assumptions.",
}


async def write_lesson(
    stub: dict,
    muse_name: str,
    knowledge_level: str,
    synthesis: str,
) -> str:
    """Return full markdown lesson content (600–1200 words)."""
    level_style = _LEVEL_STYLE.get(knowledge_level, _LEVEL_STYLE["beginner"])
    concepts = ", ".join(stub.get("key_concepts", []))

    prompt = f"""Write a lesson titled "{stub['title']}" for a learning module about "{muse_name}".

Learning objective: {stub['objective']}
Key concepts to cover: {concepts}
Lesson focus: {stub.get('focus', '')}
Writing style: {level_style}

Background context (draw on this, don't cite it directly):
{synthesis[:2_000]}

Write the complete lesson in markdown. Follow this structure EXACTLY:

# {stub['title']}

[Opening paragraph: start with a surprising fact, provocative question, or compelling observation that hooks the reader]

## [Section heading]
[Explain the first key idea clearly and substantively]

> **Reflect:** [A thought-provoking question that asks the reader to connect this idea to their own experience or prior knowledge]

## [Section heading]
[Build on the previous section]

[Continue with 1-3 more sections as needed]

> **Reflect:** [Another reflection prompt at a natural pause — different from the first]

## Key Concepts

- **[Term]**: [One-sentence definition in context of {muse_name}]
- **[Term]**: [One-sentence definition]
[List all key concepts for this lesson]

[Closing paragraph: synthesize the lesson's central insight and hint at what comes next]

Rules:
- 600–1200 words total
- Engaging, educational tone — clear but never dry
- Explain every concept, don't just name it
- Reflection prompts must be genuinely thought-provoking
- Do NOT add any commentary about the lesson structure itself"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
