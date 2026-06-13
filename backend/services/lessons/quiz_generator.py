import json
from core.claude import async_client


async def generate_quiz(
    lesson_title: str,
    lesson_content: str,
    knowledge_level: str,
) -> list[dict]:
    """Return 4 quiz questions: 2 multiple choice, 1 true/false, 1 short answer."""
    prompt = f"""Create 4 quiz questions for a lesson titled "{lesson_title}".

Lesson content:
{lesson_content[:4_000]}

Generate exactly:
- 2 multiple-choice questions (3 options each)
- 1 true/false question
- 1 short-answer question

Return ONLY valid JSON — no markdown, no other text:
[
  {{
    "question": "...",
    "type": "multiple_choice",
    "options": ["Option A", "Option B", "Option C"],
    "correct_answer": "Option A",
    "explanation": "Why this is correct"
  }},
  {{
    "question": "...",
    "type": "true_false",
    "options": ["True", "False"],
    "correct_answer": "True",
    "explanation": "Why this is true/false"
  }},
  {{
    "question": "...",
    "type": "short_answer",
    "options": [],
    "correct_answer": "Key points a good answer would include",
    "explanation": "What a complete answer looks like"
  }}
]"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
    return json.loads(text)
