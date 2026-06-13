import asyncio
import os
import tempfile


async def parse_pdf(file_bytes: bytes, filename: str) -> dict:
    """Returns {title, content}. Runs pymupdf4llm in a thread executor."""

    def _sync_parse(path: str) -> str:
        import pymupdf4llm
        return pymupdf4llm.to_markdown(path)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        loop = asyncio.get_event_loop()
        content = await loop.run_in_executor(None, _sync_parse, tmp_path)
    finally:
        os.unlink(tmp_path)

    title = filename
    if title.lower().endswith(".pdf"):
        title = title[:-4]
    title = title.replace("_", " ").replace("-", " ").strip()

    return {"title": title or filename, "content": content[:100_000]}
