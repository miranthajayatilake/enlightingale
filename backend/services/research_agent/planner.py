import json
from core.claude import async_client

_LEVEL_CONTEXT = {
    "beginner":  "The learner is completely new to this. Prioritise clear, accessible sources that build intuition before diving into detail.",
    "some":      "The learner has some background. Mix foundational and intermediate sources.",
    "familiar":  "The learner knows the basics and wants to go deeper. Prioritise analytical, expert-level sources over introductory ones.",
}


async def generate_research_plan(name: str, description: str, knowledge_level: str) -> dict:
    """
    Returns {"subtopics": [{"name": str, "focus": str, "queries": list[str]}]}
    """
    level_note = _LEVEL_CONTEXT.get(knowledge_level, _LEVEL_CONTEXT["beginner"])

    prompt = f"""You are a research planning expert helping build a curated learning knowledge base.

Topic: {name}
Learning goal: {description}
Learner context: {level_note}

Create a structured research plan. Return ONLY valid JSON with no surrounding text or markdown:

{{
  "subtopics": [
    {{
      "name": "Subtopic name (3-6 words)",
      "focus": "What the learner needs to understand about this subtopic (1-2 sentences)",
      "queries": ["specific web search query 1", "specific web search query 2", "specific web search query 3"]
    }}
  ]
}}

Requirements:
- 5-7 subtopics giving comprehensive coverage
- Each subtopic: 2-3 varied search queries (mix factual, analytical, and expert/primary source angles)
- Queries must be concrete and specific, not generic
- Cover breadth (key events, concepts, figures) AND depth (causes, effects, analysis, legacy)"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)
