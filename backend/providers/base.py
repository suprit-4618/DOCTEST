import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ExtractedOptionItem(BaseModel):
    label: str = Field(..., description="Normalized option label, e.g. 'A', 'B', 'C', 'D'")
    text: str = Field(..., description="Option textual content")


class ExtractedQuestionItem(BaseModel):
    question_number: Optional[int] = None
    question_text: str
    options: List[ExtractedOptionItem]
    correct_options: List[str] = Field(default_factory=list)
    answer_source: Optional[str] = "none"  # marked_in_document, answer_key_in_document, ai_suggested, manual, none
    confidence: float = 1.0
    source_page: Optional[int] = None
    explanation: Optional[str] = None
    needs_review: bool = False
    has_figure: bool = False
    shared_passage: Optional[str] = None
    context: Optional[str] = None
    figure_image_url: Optional[str] = None


class ExtractionBatchResult(BaseModel):
    questions: List[ExtractedQuestionItem] = Field(default_factory=list)
    detected_answer_key_section: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class AnswerSuggestionItem(BaseModel):
    question_id: str
    correct_options: List[str]
    explanation: Optional[str] = None


class AnswerSuggestionBatchResult(BaseModel):
    suggestions: List[AnswerSuggestionItem] = Field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class BaseLLMProvider(ABC):
    """
    Abstract Base Class for Vision-capable LLM Providers.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        pricing_per_million_input: float = 0.075,
        pricing_per_million_output: float = 0.30,
    ):
        self.api_key = api_key
        self.model_name = model_name
        self.pricing_input = pricing_per_million_input
        self.pricing_output = pricing_per_million_output

    def calculate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate estimated cost in USD based on token counts."""
        cost = (prompt_tokens / 1_000_000 * self.pricing_input) + (
            completion_tokens / 1_000_000 * self.pricing_output
        )
        return round(cost, 6)

    @abstractmethod
    async def extract_questions(
        self,
        page_images: List[bytes],
        mime_types: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ExtractionBatchResult:
        """
        Extract MCQs and option markings from a batch of page images.
        Must enforce structured JSON output and validate via Pydantic.
        If validation fails, retry once with the validation error included in prompt.
        """
        pass

    @abstractmethod
    async def suggest_answers(
        self,
        questions: List[Dict[str, Any]],
    ) -> AnswerSuggestionBatchResult:
        """
        Generate AI-suggested answers and explanations for questions.
        """
        pass
