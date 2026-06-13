from core.claude import async_client


async def summarize_resource(title: str, content: str, muse_name: str) -> str:
    prompt = f"""Summarize this resource for a personal learning knowledge base about "{muse_name}".

Resource: {title}

Content:
{content[:8_000]}

Write 2-3 clear paragraphs covering the key ideas and why this is relevant to learning about {muse_name}. Be informative and concise."""

    response = await async_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
