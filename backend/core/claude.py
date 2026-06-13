import anthropic
from core.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
async_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
