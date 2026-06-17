"""Resilient structured-JSON completion via Claude tool use.

Asking Claude to hand-write JSON as text is fragile: it occasionally truncates a long
response mid-string (hitting max_tokens) or emits an unescaped quote, and `json.loads`
then raises (`Unterminated string`, `Expecting ',' delimiter`, …). Because the
malformation is driven by the content, it can repeat across plain retries.

Tool use eliminates the whole class: the model returns its answer as a tool input, which
the SDK hands back as an already-parsed dict, and the API constrains it to valid JSON. A
small retry covers transient API errors.
"""

from core.claude import async_client
from core.logging import logger

_GENERIC_SCHEMA = {"type": "object", "additionalProperties": True}


async def complete_json(
    prompt: str, max_tokens: int, retries: int = 1, input_schema: dict | None = None
) -> dict:
    """Return the model's structured answer as a dict (via tool use). Retries on API error.

    Pass `input_schema` (a JSON Schema) to CONSTRAIN the shape — this both eliminates the
    truncation/escaping failures of text JSON and makes the returned keys deterministic.
    Without it the model may emit any object shape (fine for simple, single-key answers).
    """
    tool = {
        "name": "emit_json",
        "description": (
            "Return your result as a single structured JSON object, using exactly the keys "
            "and shape described in the instructions."
        ),
        "input_schema": input_schema or _GENERIC_SCHEMA,
    }
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await async_client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                tools=[tool],
                tool_choice={"type": "tool", "name": "emit_json"},
                messages=[{"role": "user", "content": prompt}],
            )
            for block in response.content:
                if getattr(block, "type", None) == "tool_use":
                    return block.input
            last_err = ValueError("response contained no tool_use block")
        except Exception as exc:
            last_err = exc
            logger.warning(f"Structured JSON tool call failed (attempt {attempt + 1}): {exc}")
    raise ValueError(f"Model did not return structured JSON after {retries + 1} attempts: {last_err}")
