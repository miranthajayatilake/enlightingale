async def scrape_url(url: str) -> dict:
    """Returns {title, content}. Raises RuntimeError on failure."""
    from crawl4ai import AsyncWebCrawler

    async with AsyncWebCrawler(verbose=False) as crawler:
        result = await crawler.arun(url=url)

    if not result.success:
        raise RuntimeError(
            f"Could not scrape {url}: {getattr(result, 'error_message', 'unknown error')}"
        )

    # Extract markdown content — API shape varies across crawl4ai minor versions
    content = ""
    md = getattr(result, "markdown", None)
    if md:
        if isinstance(md, str):
            content = md
        elif hasattr(md, "raw_markdown"):
            content = md.raw_markdown or ""
        elif hasattr(md, "fit_markdown"):
            content = md.fit_markdown or ""
    if not content:
        content = getattr(result, "cleaned_html", "") or ""

    # Extract title
    meta = getattr(result, "metadata", {}) or {}
    title = (
        meta.get("title")
        or meta.get("og:title")
        or getattr(result, "title", "")
        or url
    )

    return {"title": title.strip(), "content": content[:50_000]}
