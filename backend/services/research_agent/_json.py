"""Resilient structured-JSON completion for the Research Agent.

Asking Claude to hand-write JSON as text is fragile: it occasionally emits an unescaped
quote inside a string value (`Expecting ':' delimiter`) or otherwise-invalid JSON, and
because the malformation is driven by the input content it can repeat deterministically
across retries.

So instead of parsing text, we use Claude **tool use**: the model returns its answer as a
tool input, which the SDK hands back as an already-parsed Python dict. The API constrains
the tool input to valid JSON, eliminating the escaping/parse-failure class entirely. A
small retry covers transient API errors.
"""

from core.claude import async_client
from core.logging import logger

_TOOL = {
    "name": "emit_json",
    "description": (
        "Return your result as a single structured JSON object, using exactly the keys "
        "and shape described in the instructions."
    ),
    "input_schema": {"type": "object", "additionalProperties": True},
}


async def complete_json(prompt: str, max_tokens: int, retries: int = 1):
    """Return the model's structured answer as a dict (via tool use). Retries on API error."""
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await async_client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                tools=[_TOOL],
                tool_choice={"type": "tool", "name": "emit_json"},
                messages=[{"role": "user", "content": prompt}],
            )
            for block in response.content:
                if getattr(block, "type", None) == "tool_use":
                    return block.input
            last_err = ValueError("response contained no tool_use block")
        except Exception as exc:
            last_err = exc
            logger.warning(f"Research Agent JSON tool call failed (attempt {attempt + 1}): {exc}")
    raise ValueError(f"Model did not return structured JSON after {retries + 1} attempts: {last_err}")
