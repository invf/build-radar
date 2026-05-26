"""Unified AI client supporting OpenAI and Anthropic Claude."""
from __future__ import annotations
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)


class AIClient:
    """Unified async AI client with OpenAI and Claude support."""

    def __init__(self, provider: str = "openai"):
        self.provider = provider
        self.model_name = ""
        self._openai_client = None
        self._anthropic_client = None

    def _get_openai(self):
        if not self._openai_client:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
        return self._openai_client

    def _get_anthropic(self):
        if not self._anthropic_client:
            import anthropic
            self._anthropic_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        return self._anthropic_client

    async def complete(self, prompt: str, max_tokens: int = 1000) -> str:
        """Get AI completion. Falls back to alternate provider if one fails."""
        # Try OpenAI first if configured
        if settings.openai_api_key:
            try:
                return await self._openai_complete(prompt, max_tokens)
            except Exception as e:
                logger.warning(f"OpenAI error, falling back to Claude: {e}")

        # Fall back to Claude
        if settings.anthropic_api_key:
            try:
                return await self._claude_complete(prompt, max_tokens)
            except Exception as e:
                logger.error(f"Claude error: {e}")
                raise

        raise RuntimeError("No AI API keys configured")

    async def _openai_complete(self, prompt: str, max_tokens: int) -> str:
        client = self._get_openai()
        self.model_name = settings.openai_model

        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": "Ти AI-аналітик будівельної галузі. Відповідай лише у форматі JSON.",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        return response.choices[0].message.content

    async def _claude_complete(self, prompt: str, max_tokens: int) -> str:
        client = self._get_anthropic()
        self.model_name = settings.anthropic_model

        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            system="Ти AI-аналітик будівельної галузі. Відповідай лише у форматі JSON.",
            messages=[{"role": "user", "content": prompt}],
        )

        return response.content[0].text


_client: AIClient | None = None


def get_ai_client() -> AIClient:
    global _client
    if _client is None:
        # Prefer Claude if configured, fall back to OpenAI
        provider = "claude" if settings.anthropic_api_key else "openai"
        _client = AIClient(provider=provider)
    return _client
