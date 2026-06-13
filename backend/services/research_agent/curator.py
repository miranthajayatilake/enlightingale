import json
from core.claude import async_client


def _avg_score(result: dict) -> float:
    ev = result.get("evaluation", {})
    return (ev.get("relevance", 0) + ev.get("depth", 0) + ev.get("quality", 0)) / 3


async def curate_and_report(
    accepted: list[dict],
    plan: dict,
    muse_name: str,
    muse_description: str,
    max_resources: int = 15,
) -> dict:
    """
    Select final set of sources and generate a coverage report.
    Returns {"selected": list[dict], "report": {"coverage_summary": str, "gaps": list[str]}}
    """
    if not accepted:
        return {
            "selected": [],
            "report": {
                "coverage_summary": "No sources passed the quality threshold.",
                "gaps": ["All subtopics — try broadening the search."],
            },
        }

    selected = sorted(accepted, key=_avg_score, reverse=True)[:max_resources]
    subtopic_names = [s["name"] for s in plan.get("subtopics", [])]
    source_list = "\n".join(
        f"- {r['title']} ({r['url']}): {r['content'][:250]}" for r in selected
    )

    prompt = f"""You built a research collection for: {muse_name}
Goal: {muse_description}
Subtopics aimed to cover: {", ".join(subtopic_names)}

Selected sources ({len(selected)} total):
{source_list}

Write a short coverage report. Return ONLY valid JSON:

{{
  "coverage_summary": "2-3 sentences on what the collection covers well and its overall quality",
  "gaps": ["1-3 important aspects of the topic not well covered by these sources"]
}}"""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    report = json.loads(text)
    return {"selected": selected, "report": report}
