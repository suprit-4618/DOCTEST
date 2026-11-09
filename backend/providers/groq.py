import asyncio
import json
import logging
import re
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


def _clean_and_parse_json(content_str: str) -> Dict[str, Any]:
    """
    Robustly parses JSON from LLM completions, stripping markdown code blocks,
    preamble, thinking commentary, and handling minor syntax anomalies.
    """
    if not content_str:
        return {}

    content_str = content_str.strip()

    # 1. Direct JSON parse
    try:
        return json.loads(content_str)
    except Exception:
        pass

    # 2. Strip standard markdown code fences
    clean = content_str
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()
    try:
        return json.loads(clean)
    except Exception:
        pass

    # 3. Locate outermost JSON object { ... }
    first_brace = content_str.find("{")
    last_brace = content_str.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = content_str[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except Exception:
            # Clean trailing commas before closing braces/brackets
            fixed = re.sub(r",\s*([\]}])", r"\1", candidate)
            try:
                return json.loads(fixed)
            except Exception:
                pass

    # 4. Locate outermost JSON array [ ... ] if root was an array
    first_bracket = content_str.find("[")
    last_bracket = content_str.rfind("]")
    if first_bracket != -1 and last_bracket > first_bracket:
        candidate = content_str[first_bracket : last_bracket + 1]
        try:
            return {"questions": json.loads(candidate)}
        except Exception:
            fixed = re.sub(r",\s*([\]}])", r"\1", candidate)
            try:
                return {"questions": json.loads(fixed)}
            except Exception:
                pass

    raise ValueError(f"Failed to parse valid JSON from text: {content_str[:300]}")


class GroqProvider(BaseLLMProvider):
    """
    High-performance Groq Cloud LLM Provider (Llama 3.3 70B / GPT-OSS / Qwen).
    Optimized for high-speed text exam parsing and AI answer suggestions.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = "qwen/qwen3.8-27b",
        pricing_per_million_input: float = 0.0,
        pricing_per_million_output: float = 0.0,
    ):
        actual_key = api_key or settings.GROQ_API_KEY
        actual_model = model_name or settings.GROQ_MODEL or "qwen/qwen3.8-27b"
        super().__init__(
            api_key=actual_key,
            model_name=actual_model,
            pricing_per_million_input=pricing_per_million_input,
            pricing_per_million_output=pricing_per_million_output,
        )
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def _call_groq_api(
        self,
        messages: List[Dict[str, str]],
        json_mode: bool = True,
        max_retries: int = 8,
    ) -> Dict[str, Any]:
        """Calls Groq chat completion API with smart retry, JSON recovery, and rate-limit backoff."""
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
            "max_tokens": 1800,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        delay = 2.0
        async with httpx.AsyncClient(timeout=90.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await client.post(self.endpoint, headers=headers, json=payload)

                    if response.status_code == 413:
                        logger.warning("Groq API returned 413 (token limit). Lowering max_tokens and retrying...")
                        payload["max_tokens"] = min(payload.get("max_tokens", 2500), 1600)
                        await asyncio.sleep(6.0)
                        continue

                    if response.status_code in [429, 500, 502, 503, 504]:
                        wait_seconds = delay
                        retry_after = response.headers.get("retry-after")
                        reset_tokens = response.headers.get("x-ratelimit-reset-tokens")
                        if retry_after:
                            try:
                                wait_seconds = max(wait_seconds, float(retry_after) + 2.0)
                            except Exception:
                                pass
                        elif reset_tokens:
                            try:
                                clean_reset = reset_tokens.strip().rstrip("s")
                                wait_seconds = max(wait_seconds, float(clean_reset) + 2.0)
                            except Exception:
                                pass

                        logger.warning(
                            f"Groq API returned {response.status_code}, attempt {attempt + 1}/{max_retries}. Waiting {wait_seconds:.2f}s..."
                        )
                        await asyncio.sleep(wait_seconds)
                        delay = max(delay * 1.5, 4.0)
                        continue

                    if not response.is_success:
                        error_detail = response.text
                        err_obj: Dict[str, Any] = {}
                        err_data: Dict[str, Any] = {}
                        try:
                            err_data = response.json()
                            err_obj = err_data.get("error", {})
                            error_detail = err_obj.get("message", error_detail)
                        except Exception:
                            pass

                        # Detect Groq server-side JSON schema validation rejection
                        is_json_validation_err = (
                            response.status_code == 400
                            and (
                                "failed to generate json" in error_detail.lower()
                                or "failed to validate json" in error_detail.lower()
                                or err_obj.get("code") == "json_validate_failed"
                            )
                        )

                        if is_json_validation_err:
                            # 1. Attempt recovery from failed_generation payload if provided by Groq
                            failed_gen = err_obj.get("failed_generation")
                            if failed_gen:
                                try:
                                    logger.warning("Groq returned 400 json_validate_failed; attempting recovery from failed_generation payload...")
                                    parsed = _clean_and_parse_json(failed_gen)
                                    if parsed:
                                        logger.info("Successfully recovered JSON from Groq failed_generation payload.")
                                        return {
                                            "choices": [{"message": {"role": "assistant", "content": json.dumps(parsed)}}],
                                            "usage": err_data.get("usage", {}),
                                        }
                                except Exception as salvage_err:
                                    logger.warning(f"Could not parse failed_generation: {salvage_err}")

                            # 2. If json_mode was enabled, retry without json_object constraint to avoid Groq validation 400
                            if json_mode:
                                logger.warning("Retrying Groq API request without response_format json_object...")
                                return await self._call_groq_api(messages, json_mode=False, max_retries=3)

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
You are an expert exam ingestion engine. Analyze the following OCR exam text and extract ALL multiple choice questions and answer keys into structured JSON.

CRITICAL EXTRACTION RULES:
1. QUESTION NUMBERS:
   - Identify the TRUE global question number from headers or stems (e.g. '47.', '114.', 'Question 14').
   - Keep the exact global question number from the exam.
2. SOURCE PAGE:
   - Each page is marked with '--- PAGE N ---'. Set 'source_page' to that exact integer page number N for every question on that page.
3. NEVER LEAVE OPTIONS EMPTY (CRITICAL):
   - EVERY option MUST contain meaningful, complete text. NEVER output an option with empty text "" or just whitespace.
4. SPOTTING ERRORS / SENTENCE PARTS QUESTIONS:
   - When a sentence is divided into underlined/marked parts (a), (b), (c) with (d) as 'No error':
     * Option A MUST contain the text of part (a).
     * Option B MUST contain the text of part (b).
     * Option C MUST contain the text of part (c).
     * Option D MUST contain 'No error' (or part (d)).
     * Question text MUST be the full sentence.
     * NEVER leave Options A, B, C empty!
5. SENTENCE ORDERING / PARAJUMBLES (S1, P, Q, R, S, S6):
   - Include the full context (S1, P, Q, R, S, S6 sentences) in the question stem.
   - The options are the sequence choices (e.g. A: PQRS, B: RSPQ, C: QPSR, D: SRPQ).
6. MATCHING LISTS (List I and List II):
   - Include all List I and List II items in the question stem or context.
   - The options are the code combinations (e.g. A: A-2, B-4, C-1, D-3).
7. READING COMPREHENSION PASSAGES:
   - If questions relate to a passage (e.g. 'PASSAGE I'), capture the passage text in 'context' or 'shared_passage'.
8. CHECK FOR ANSWER MARKINGS & KEYS:
   - Check if an option has a tick, mark, asterisk, or '(correct)'. Include that label in 'correct_options' and set answer_source to 'marked_in_document'.
   - If a dedicated Answer Key section appears on any page, extract it in 'detected_answer_key_section'.
9. CRITICAL FORMATTING:
   - Return ONLY a raw JSON object.
   - Do NOT wrap the JSON in markdown fences (like ```json ... ```).
   - Start directly with {{ and end with }}.

Output strictly conforming to this schema:
{{
  "questions": [
    {{
      "question_number": 47,
      "question_text": "Clean complete question text",
      "options": [
        {{"label": "A", "text": "First option text"}},
        {{"label": "B", "text": "Second option text"}},
        {{"label": "C", "text": "Third option text"}},
        {{"label": "D", "text": "Fourth option text"}}
      ],
      "correct_options": [],
      "answer_source": "none",
      "confidence": 0.95,
      "source_page": 12,
      "explanation": null,
      "needs_review": false,
      "has_figure": false,
      "shared_passage": null,
      "context": null,
      "figure_image_url": null
    }}
  ],
  "detected_answer_key_section": null
}}

EXAM TEXT TO PARSE:
{text_content}
"""
        messages = [
            {"role": "system", "content": "You are a specialized exam parser. You always output valid, parseable JSON conforming strictly to the requested schema. Return ONLY valid raw JSON starting with { and ending with } without markdown backticks."},
            {"role": "user", "content": user_prompt},
        ]

        raw = await self._call_groq_api(messages, json_mode=True)
        content_str = raw["choices"][0]["message"]["content"]
        parsed_data = _clean_and_parse_json(content_str)

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

            # Guardrail: Never allow blank option texts
            options = q.get("options", [])
            for opt_idx, opt in enumerate(options):
                if not opt.get("label"):
                    opt["label"] = chr(65 + (opt_idx % 26))
                opt_text = str(opt.get("text") or "").strip()
                if not opt_text:
                    q_text = str(q.get("question_text") or "")
                    has_no_error = any("no error" in str(o.get("text", "")).lower() for o in options)
                    if has_no_error:
                        parts = [p.strip() for p in re.split(r"[/|•\n]|\([a-d]\)|\b[a-d]\)", q_text, flags=re.IGNORECASE) if p.strip()]
                        if len(parts) >= len(options) - 1 and opt_idx < len(parts):
                            opt["text"] = parts[opt_idx]
                        else:
                            opt["text"] = f"Part ({opt['label']})"
                    else:
                        opt["text"] = f"Option {opt['label']}"
                else:
                    opt["text"] = opt_text

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
        Extracts page text (using native digital PDF text when available, falling back to RapidOCR for scans),
        then parses via Groq.
        """
        from services.ocr_service import ocr_image
        from services.ingestion import get_document_storage_dir, get_or_extract_page_text

        page_numbers = (context or {}).get("page_numbers", [])
        doc_id = (context or {}).get("document_id")
        doc_dir = get_document_storage_dir(doc_id) if doc_id else None

        combined_text_lines = []
        for idx, img_bytes in enumerate(page_images):
            p_num = page_numbers[idx] if idx < len(page_numbers) else (idx + 1)
            
            page_text = ""
            # 1. Use native digital text if available (or extract from original.pdf on the fly)
            if doc_dir:
                page_text = get_or_extract_page_text(doc_dir, p_num)

            # 2. Fall back to RapidOCR for scanned images or photos
            if not page_text or len(page_text) < 30:
                page_text = ocr_image(img_bytes)

            # Ignore blank / rough work pages
            clean_check = page_text.strip().lower()
            if len(clean_check) < 80 and ("space for rough work" in clean_check or "rough work" in clean_check):
                logger.info(f"Page {p_num} is a rough work page. Skipping LLM call.")
                continue

            combined_text_lines.append(f"--- PAGE {p_num} ---\n{page_text}")

        if not combined_text_lines:
            return ExtractionBatchResult()

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
        data = _clean_and_parse_json(content_str)

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
