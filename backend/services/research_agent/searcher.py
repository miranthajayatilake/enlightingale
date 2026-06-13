import logging

from tavily import AsyncTavilyClient
from core.config import settings

logger = logging.getLogger(__name__)


async def search_queries(queries: list[str], max_results_per_query: int = 5) -> list[dict]:
    """
    Run multiple Tavily searches and return a deduplicated list of results.
    Each result: {url, title, content, raw_content, score, query}
    """
    client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
    seen_urls: set[str] = set()
    all_results: list[dict] = []

    for query in queries:
        try:
            response = await client.search(
                query=query,
                max_results=max_results_per_query,
                search_depth="advanced",
                include_raw_content=True,
            )
            for item in response.get("results", []):
                url = item.get("url", "")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                raw = item.get("raw_content") or item.get("content", "")
                all_results.append({
                    "url": url,
                    "title": item.get("title", url),
                    "content": item.get("content", ""),       # short snippet
                    "raw_content": raw[:20_000],               # cap at 20 k chars
                    "score": item.get("score", 0.0),
                    "query": query,
                })
        except Exception as exc:
            logger.error("Tavily search query '%s' failed: %s", query, exc)

    return all_results
