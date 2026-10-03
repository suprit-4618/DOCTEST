import asyncio
import base64
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from pydantic import ValidationError

from providers.base import (
    BaseLLMProvider,
    ExtractionBatchResult,
    ExtractedQuestionItem,
    AnswerSuggestionBatchResult,
    AnswerSuggestionItem,
)
from services.prompts import (
    EXTRACTION_SYSTEM_PROMPT,
    SUGGEST_ANSWERS_PROMPT,
)

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    """
    Concrete Google Gemini Vision LLM Provider using the REST API with structured JSON output.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = "gemini-1.5-flash",
        pricing_per_million_input: float = 0.075,
        pricing_per_million_output: float = 0.30,
    ):
        super().__init__(
            api_key=api_key,
            model_name=model_name,
            pricing_per_million_input=pricing_per_million_input,
            pricing_per_million_output=pricing_per_million_output,
        )
        self.endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent"

    async def _call_gemini_api(
        self,
        contents: List[Dict[str, Any]],
        system_instruction: Optional[str] = None,
        max_retries: int = 5,
    ) -> Dict[str, Any]:
        """Calls Gemini generateContent endpoint with exponential backoff on rate limits."""
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        url = f"{self.endpoint}?key={self.api_key}"
        
        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        }

        if system_instruction:
            payload["system_instruction"] = {
                "parts": [{"text": system_instruction}]
            }

        headers = {"Content-Type": "application/json"}

        delay = 2.0
        async with httpx.AsyncClient(timeout=120.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await client.post(url, headers=headers, json=payload)
                    
                    # Rate limit or server error retry
                    if response.status_code in [429, 500, 502, 503, 504]:
                        logger.warning(
                            f"Gemini API returned {response.status_code}, attempt {attempt + 1}/{max_retries}. Retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                        delay *= 2
                        continue

                    if not response.is_success:
                        error_detail = response.text
                        try:
                            err_json = response.json()
                            error_detail = err_json.get("error", {}).get("message", error_detail)
                        except Exception:
                            pass
                        raise RuntimeError(f"Gemini API error ({response.status_code}): {error_detail}")

                    return response.json()

                except (httpx.RequestError, httpx.TimeoutException) as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Network error calling Gemini: {e}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        delay *= 2
                    else:
                        raise RuntimeError(f"Failed to connect to Gemini API after {max_retries} attempts: {e}")

        raise RuntimeError("Gemini API call failed after exhausting all retry attempts.")

    async def extract_questions(
        self,
        page_images: List[bytes],
        mime_types: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExtractionBatchResult:
        """
        Extracts questions from batch page images with structured JSON validation
        and one retry with validation error feedback if parsing fails.
        """
        parts: List[Dict[str, Any]] = []

        # Add image parts
        for i, img_bytes in enumerate(page_images):
            mime = mime_types[i] if mime_types and i < len(mime_types) else "image/png"
            b64_img = base64.b64encode(img_bytes).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": mime,
                    "data": b64_img
                }
            })

        # Add text prompt instruction
        instruction_text = "Please analyze the attached page image(s) and extract all multiple-choice questions according to the extraction specification."
        if context and context.get("page_numbers"):
            instruction_text += f" These images correspond to source pages: {context['page_numbers']}."

        parts.append({"text": instruction_text})
        contents = [{"parts": parts}]

        # First attempt
        raw_response = await self._call_gemini_api(
            contents=contents,
            system_instruction=EXTRACTION_SYSTEM_PROMPT
        )

        candidates = raw_response.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned no candidates in response.")

        text_content = ""
        try:
            text_content = candidates[0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(text_content)
            result = ExtractionBatchResult.model_validate(parsed_json)
        except (json.JSONDecodeError, ValidationError, KeyError, IndexError) as err:
            logger.warning(f"Validation failed on first attempt: {err}. Retrying with error in prompt...")
            # Retry once with validation error feedback
            retry_parts = parts.copy()
            retry_parts.append({
                "text": (
                    f"Your previous response failed validation with the following error:\n{str(err)}\n"
                    f"Previous raw output was:\n{text_content[:500]}\n"
                    "Please re-generate and output strictly valid JSON conforming to the ExtractionBatchResult schema."
                )
            })
            retry_response = await self._call_gemini_api(
                contents=[{"parts": retry_parts}],
                system_instruction=EXTRACTION_SYSTEM_PROMPT
            )
            retry_text = retry_response.get("candidates", [])[0]["content"]["parts"][0]["text"]
            parsed_json = json.loads(retry_text)
            result = ExtractionBatchResult.model_validate(parsed_json)
            raw_response = retry_response

        # Extract token usage metadata
        usage = raw_response.get("usageMetadata", {})
        prompt_tokens = usage.get("promptTokenCount", 0)
        completion_tokens = usage.get("candidatesTokenCount", 0)
        total_tokens = usage.get("totalTokenCount", prompt_tokens + completion_tokens)

        result.prompt_tokens = prompt_tokens
        result.completion_tokens = completion_tokens
        result.total_tokens = total_tokens
        result.estimated_cost_usd = self.calculate_cost(prompt_tokens, completion_tokens)

        logger.info(
            f"Extraction batch completed: {len(result.questions)} questions, "
            f"{total_tokens} tokens (Cost: ${result.estimated_cost_usd:.5f})"
        )
        return result

    async def suggest_answers(
        self,
        questions: List[Dict[str, Any]],
    ) -> AnswerSuggestionBatchResult:
        """
        Generates AI-suggested answers and explanations for provided questions.
        """
        prompt_input = json.dumps(questions, indent=2)
        system_prompt = SUGGEST_ANSWERS_PROMPT.format(questions_json=prompt_input)

        contents = [{"parts": [{"text": "Generate answers and explanations for the provided multiple-choice questions."}]}]

        raw_response = await self._call_gemini_api(
            contents=contents,
            system_instruction=system_prompt
        )

        candidates = raw_response.get("candidates", [])
        if not candidates:
            raise RuntimeError("Gemini returned no response candidates.")

        text_content = candidates[0]["content"]["parts"][0]["text"]
        parsed_json = json.loads(text_content)
        result = AnswerSuggestionBatchResult.model_validate(parsed_json)

        usage = raw_response.get("usageMetadata", {})
        prompt_tokens = usage.get("promptTokenCount", 0)
        completion_tokens = usage.get("candidatesTokenCount", 0)
        total_tokens = usage.get("totalTokenCount", prompt_tokens + completion_tokens)

        result.prompt_tokens = prompt_tokens
        result.completion_tokens = completion_tokens
        result.total_tokens = total_tokens
        result.estimated_cost_usd = self.calculate_cost(prompt_tokens, completion_tokens)

        return result
