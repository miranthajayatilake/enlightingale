from core.claude import async_client


async def synthesize(
    muse_name: str,
    muse_description: str,
    resource_summaries: list[dict],
) -> str:
    """Generate a cross-resource synthesis narrative."""
    summaries_text = "\n\n".join(
        f"**{s['title']}**\n{s['summary']}"
        for s in resource_summaries[:15]
    )

    prompt = f"""You are synthesizing knowledge from multiple sources into a coherent overview.

Topic: {muse_name}
Learning goal: {muse_description}

Sources and summaries:
{summaries_text}

Write a 3-4 paragraph synthesis that:
- Identifies the key themes and patterns across these sources
- Connects related ideas and shows how they build on each other
- Highlights what is collectively understood about this topic
- Notes any tensions, debates, or open questions

Write in a clear, educational tone. Do not cite sources by name."""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
