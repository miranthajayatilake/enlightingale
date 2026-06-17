"""Resilient structured-JSON completion for the Research Agent.

The implementation now lives in `core.llm_json` (shared with the Canvas pipeline).
Re-exported here to keep the existing import path stable.
"""

from core.llm_json import complete_json  # noqa: F401
