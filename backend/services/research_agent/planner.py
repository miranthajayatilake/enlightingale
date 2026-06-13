from services.research_agent._json import complete_json

_LEVEL_CONTEXT = {
    "beginner":  "The learner is completely new to this. Prioritise clear, accessible sources that build intuition before diving into detail.",
    "some":      "The learner has some background. Mix foundational and intermediate sources.",
    "familiar":  "The learner knows the basics and wants to go deeper. Prioritise analytical, expert-level sources over introductory ones.",
}


async def generate_research_plan(
    name: str, description: str, knowledge_level: str, focus: str | None = None
) -> dict:
    """
    Returns {"subtopics": [{"name": str, "focus": str, "queries": list[str]}]}
    """
    level_note = _LEVEL_CONTEXT.get(knowledge_level, _LEVEL_CONTEXT["beginner"])

    if focus:
        focus_block = f"""
FOCUSED PASS: The learner specifically wants to explore this question or gap:
"{focus}"
Generate 3-5 subtopics tightly scoped to address this focus directly. All search queries should target sources that best answer it."""
        subtopic_count = "3-5 subtopics tightly scoped to the focus above"
    else:
        focus_block = ""
        subtopic_count = "5-7 subtopics giving comprehensive coverage"

    prompt = f"""You are a research planning expert helping build a curated learning knowledge base.

Topic: {name}
Learning goal: {description}
Learner context: {level_note}{focus_block}

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
- {subtopic_count}
- Each subtopic: 2-3 varied search queries (mix factual, analytical, and expert/primary source angles)
- Queries must be concrete and specific, not generic
- Cover breadth (key events, concepts, figures) AND depth (causes, effects, analysis, legacy)"""

    return await complete_json(prompt, max_tokens=2048)
