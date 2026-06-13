from dataclasses import dataclass
from core.claude import async_client

_TOOL = {
    "name": "interpret_muse",
    "description": "Return the interpreted Muse name and research focus.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "2–5 word title-cased noun phrase, no trailing punctuation.",
            },
            "research_focus": {
                "type": "string",
                "description": "One sentence learning goal, specific enough to brief a researcher.",
            },
        },
        "required": ["name", "research_focus"],
    },
}

_PROMPT = """The user wants to create a personal learning space. They described it as:

"{description}"

Your job:
1. Identify what they actually want to *learn about* — even if they described a problem, a goal,
   or a situation rather than a topic. Think: "someone studying this would be studying ___."
2. Return two fields:
   - name: a 2–5 word noun phrase, title-cased, no trailing punctuation. Should name the
     domain or subject of study, not re-state the user's problem.
   - research_focus: one sentence framing what this Muse should help the user understand,
     specific enough to guide a researcher (not "learn about X" but "understand the mechanisms
     behind X and how practitioners approach Y").

If the description is already a clear topic, reflect it directly.
If it describes a problem or goal, abstract to the underlying domain of knowledge."""


@dataclass
class InterpretedMuse:
    name: str
    research_focus: str


async def interpret_description(description: str) -> InterpretedMuse:
    response = await async_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        tools=[_TOOL],
        tool_choice={"type": "tool", "name": "interpret_muse"},
        messages=[{"role": "user", "content": _PROMPT.format(description=description)}],
    )
    for block in response.content:
        if getattr(block, "type", None) == "tool_use":
            return InterpretedMuse(
                name=block.input["name"],
                research_focus=block.input["research_focus"],
            )
    raise ValueError("interpreter returned no tool_use block")
