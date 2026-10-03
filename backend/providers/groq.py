import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from pydantic import ValidationError

from providers.base import (
    BaseLLMProvider,
    ExtractionBatchResult,
    ExtractedQuestionItem,
    ExtractedOptionItem,
    AnswerSuggestionBatchResult,
    AnswerSuggestionItem,
)
from services.prompts import (
    EXTRACTION_SYSTEM_PROMPT,
    SUGGEST_ANSWERS_PROMPT,
)

logger = logging.getLogger(__name__)


class GroqProvider(BaseLLMProvider):
    """
    High-performance Groq Cloud LLM Provider (Llama 3.3 70B / GPT-OSS / Qwen).
    Optimized for high-speed text exam parsing and AI answer suggestions.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = "openai/gpt-oss-120b",
        pricing_per_million_input: float = 0.0,
        pricing_per_million_output: float = 0.0,
    ):
        super().__init__(
            api_key=api_key,
            model_name=model_name or "openai/gpt-oss-120b",
            pricing_per_million_input=pricing_per_million_input,
            pricing_per_million_output=pricing_per_million_output,
        )
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def _call_groq_api(
        self,
        messages: List[Dict[str, str]],
        json_mode: bool = True,
        max_retries: int = 4,
    ) -> Dict[str, Any]:
        """Calls Groq chat completion API with retry on rate limit."""
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.1,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        delay = 1.0
        async with httpx.AsyncClient(timeout=90.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await client.post(self.endpoint, headers=headers, json=payload)

                    if response.status_code in [429, 500, 502, 503, 504]:
                        logger.warning(
                            f"Groq API returned {response.status_code}, attempt {attempt + 1}/{max_retries}. Retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                        delay *= 2
                        continue

                    if not response.is_success:
                        error_detail = response.text
                        try:
                            error_detail = response.json().get("error", {}).get("message", error_detail)
                        except Exception:
                            pass
                        raise RuntimeError(f"Groq API error ({response.status_code}): {error_detail}")

                    return response.json()

                except (httpx.RequestError, httpx.TimeoutException) as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Network error calling Groq: {e}. Retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        delay *= 2
                    else:
                        raise RuntimeError(f"Failed to connect to Groq API after {max_retries} attempts: {e}")

        raise RuntimeError("Groq API call failed after exhausting all retry attempts.")

    async def extract_questions_from_text(
        self,
        text_content: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExtractionBatchResult:
        """
        Parses OCR text or pasted text into structured questions and answer keys via Groq.
        """
        user_prompt = f"""
You are an expert exam ingestion engine. Analyze the following OCR exam text and extract all multiple choice questions and answer keys into structured JSON.

CRITICAL EXTRACTION RULES:
1. QUESTION NUMBERS:
   - Identify the TRUE global question number from exam headers or stems (e.g., '21 of 65' -> 21, '53 of 65' -> 53, 'Question 14' -> 14, 'Q. 3' -> 3).
   - Do NOT reset numbers to 1, 2, 3 in each batch unless the questions are genuinely numbered 1, 2, 3 in the document.
2. SOURCE PAGE ATTRIBUTION:
   - Each page is marked with '--- PAGE N ---'. You MUST set 'source_page' to that exact integer page number N for every question extracted from that page.
3. ISOLATE OPTIONS PER QUESTION:
   - Every question must contain ONLY the options printed directly beneath its question stem on its page. NEVER mix options across different pages or questions!
   - Support variable option counts (2, 3, 4, 5, or 6 options). If only 3 options (A, B, C) are printed, extract exactly those 3 with sequential labels ('A', 'B', 'C'). Do NOT invent fake missing options.
4. REPAIR OCR ERRORS IN TOKENS & OPTIONS:
   - Fix obvious OCR character corruptions in tokens/variables, especially personalization strings where '%%' was misread as 'ss', 'sf', 'st', or 's4' (e.g. 'sssubscriberidss' -> '%%subscriberid%%', 'sfmenberidss' -> '%%memberid%%', 'stcontaotkeyes' -> '%%contactkey%%').
5. CHECK FOR ANSWER MARKINGS & KEYS:
   - Check if an option has a tick, mark, asterisk, or '(correct)'. Include that label in 'correct_options' and set answer_source to 'marked_in_document'.
   - If a dedicated Answer Key section (e.g. 'Answers 1.B 2.B 3.B...' or '1-B, 2-C') appears on any page, extract it in 'detected_answer_key_section'.
6. Output STRICT JSON conforming to this schema:
{{
  "questions": [
    {{
      "question_number": 21,
      "question_text": "Clean question text here",
      "options": [
        {{"label": "A", "text": "First option text"}},
        {{"label": "B", "text": "Second option text"}},
        {{"label": "C", "text": "Third option text"}}
      ],
      "correct_options": ["A"],
      "answer_source": "marked_in_document",
      "confidence": 0.95,
      "source_page": 47,
      "explanation": null,
      "needs_review": false,
      "has_figure": false,
      "shared_passage": null,
      "context": null,
      "figure_image_url": null
    }}
  ],
  "detected_answer_key_section": "1-B, 2-C..."
}}

EXAM TEXT TO PARSE:
{text_content}
"""
        messages = [
            {"role": "system", "content": "You are a specialized exam parser. You always output valid, parseable JSON conforming strictly to the requested schema."},
            {"role": "user", "content": user_prompt},
        ]

        raw = await self._call_groq_api(messages, json_mode=True)
        content_str = raw["choices"][0]["message"]["content"]

        try:
            parsed_data = json.loads(content_str)
        except Exception:
            clean = content_str.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            parsed_data = json.loads(clean.strip())

        usage = raw.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

        parsed_questions = []
        for q in parsed_data.get("questions", []):
            if not q.get("answer_source"):
                q["answer_source"] = "none"
            elif q.get("answer_source") == "answer_key_section":
                q["answer_source"] = "answer_key_in_document"
            elif q.get("answer_source") not in ["marked_in_document", "answer_key_in_document", "ai_suggested", "manual", "none"]:
                q["answer_source"] = "none"
                
            if q.get("correct_options") is None:
                q["correct_options"] = []
            if q.get("confidence") is None:
                q["confidence"] = 0.95
            parsed_questions.append(ExtractedQuestionItem(**q))

        batch_result = ExtractionBatchResult(
            questions=parsed_questions,
            detected_answer_key_section=parsed_data.get("detected_answer_key_section"),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=0.0,
        )
        return batch_result

    async def extract_questions(
        self,
        page_images: List[bytes],
        mime_types: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExtractionBatchResult:
        """
        Runs local RapidOCR on the page images in memory, then parses via Groq.
        """
        from services.ocr_service import ocr_image

        page_numbers = (context or {}).get("page_numbers", [])
        combined_text_lines = []
        for idx, img_bytes in enumerate(page_images):
            p_num = page_numbers[idx] if idx < len(page_numbers) else (idx + 1)
            page_text = ocr_image(img_bytes)
            combined_text_lines.append(f"--- PAGE {p_num} ---\n{page_text}")

        return await self.extract_questions_from_text("\n\n".join(combined_text_lines), context=context)

    async def suggest_answers(
        self,
        questions: List[Dict[str, Any]],
    ) -> AnswerSuggestionBatchResult:
        """
        Generate AI-suggested answers and explanations using Groq.
        """
        prompt = SUGGEST_ANSWERS_PROMPT.format(questions_json=json.dumps(questions, indent=2))
        messages = [
            {"role": "system", "content": "You are an expert exam solver. You accurately answer multiple-choice questions with step-by-step explanations."},
            {"role": "user", "content": prompt},
        ]

        raw = await self._call_groq_api(messages, json_mode=True)
        content_str = raw["choices"][0]["message"]["content"]
        data = json.loads(content_str)

        suggestions = [
            AnswerSuggestionItem(
                question_id=item["question_id"],
                correct_options=item.get("correct_options", []),
                explanation=item.get("explanation"),
            )
            for item in data.get("suggestions", [])
        ]

        usage = raw.get("usage", {})
        return AnswerSuggestionBatchResult(
            suggestions=suggestions,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            estimated_cost_usd=0.0,
        )
