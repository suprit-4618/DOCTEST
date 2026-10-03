import logging
from typing import Optional
from app.core.config import settings
from providers.base import BaseLLMProvider
from providers.gemini import GeminiProvider
from providers.groq import GroqProvider

logger = logging.getLogger(__name__)


def get_llm_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> BaseLLMProvider:
    """
    Factory function to initialize and return the configured LLM provider.
    """
    name = (provider_name or settings.DEFAULT_LLM_PROVIDER or "groq").lower()

    if name == "groq":
        key = api_key or settings.GROQ_API_KEY
        model = model_name or settings.GROQ_MODEL or "openai/gpt-oss-120b"
        return GroqProvider(api_key=key, model_name=model)

    if name == "gemini":
        key = api_key or settings.GEMINI_API_KEY
        model = model_name or settings.GEMINI_MODEL or "gemini-3-flash-preview"
        return GeminiProvider(api_key=key, model_name=model)

    # Fallback to Groq
    logger.warning(f"Unknown provider '{name}', defaulting to Groq provider.")
    return GroqProvider(api_key=api_key or settings.GROQ_API_KEY, model_name=model_name or settings.GROQ_MODEL)
