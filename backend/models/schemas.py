from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_serializer
from models.enums import DocumentStatus, AnswerSource, SessionMode, FileType


# --- Question & Option Models ---

class QuestionOption(BaseModel):
    """Option for a multiple choice question."""
    label: str = Field(..., description="Option identifier/letter, e.g. 'A', 'B', 'C', 'D'")
    text: str = Field(..., description="Option textual content")

    model_config = ConfigDict(from_attributes=True)


class TestQuestion(BaseModel):
    """
    Test-taking question representation.
    CRITICAL SECURITY CONTRACT: Structurally CANNOT contain answer fields
    (no correct_options, answer_source, explanation, or confidence).
    """
    id: str
    document_id: str
    number: Optional[int] = None
    text: str
    options: List[QuestionOption]
    source_page: Optional[int] = None
    context: Optional[str] = None  # Shared passage / context
    figure_image_url: Optional[str] = None  # Figure / diagram image URL

    model_config = ConfigDict(from_attributes=True)


class QuestionDetail(BaseModel):
    """
    Full Question representation for review/edit screen.
    Includes answer keys, confidence, provenance source, and explanations.
    """
    id: str
    document_id: str
    number: Optional[int] = None
    text: str
    options: List[QuestionOption]
    correct_options: List[str] = Field(default_factory=list, description="List of correct option labels, e.g. ['A']")
    answer_source: AnswerSource = AnswerSource.NONE
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    source_page: Optional[int] = None
    explanation: Optional[str] = None
    context: Optional[str] = None  # Shared passage / context
    figure_image_url: Optional[str] = None  # Figure / diagram image URL
    needs_review: bool = False

    model_config = ConfigDict(from_attributes=True)


class QuestionCreate(BaseModel):
    """Payload schema for manually creating a question."""
    number: Optional[int] = None
    text: str
    options: List[QuestionOption] = Field(default_factory=list)
    correct_options: List[str] = Field(default_factory=list)
    answer_source: AnswerSource = AnswerSource.MANUAL
    confidence: float = 1.0
    source_page: Optional[int] = None
    explanation: Optional[str] = None
    context: Optional[str] = None
    figure_image_url: Optional[str] = None
    needs_review: bool = False


class ApplyAnswerKeyRequest(BaseModel):
    """Payload for bulk applying an answer key text string or mapping."""
    key_text: Optional[str] = None  # e.g. "1-B, 2-D, 3-A"
    key_mappings: Optional[dict[int, List[str]]] = None


class QuestionUpdate(BaseModel):
    """Payload schema for editing an extracted question."""
    text: Optional[str] = None
    number: Optional[int] = None
    options: Optional[List[QuestionOption]] = None
    correct_options: Optional[List[str]] = None
    answer_source: Optional[AnswerSource] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    explanation: Optional[str] = None
    context: Optional[str] = None
    figure_image_url: Optional[str] = None
    needs_review: Optional[bool] = None


# --- Document Models ---

class DocumentBase(BaseModel):
    filename: str
    file_type: FileType = FileType.PDF
    page_count: int = 1
    pages_processed: int = 0


class DocumentCreate(DocumentBase):
    pass


class DocumentRename(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)


class DocumentResponse(DocumentBase):
    id: str
    status: DocumentStatus
    error_message: Optional[str] = None
    created_at: datetime
    question_count: Optional[int] = 0

    @computed_field
    @property
    def progress(self) -> float:
        if self.status == DocumentStatus.EXTRACTED:
            return 1.0
        if self.status == DocumentStatus.FAILED:
            return 0.0
        if self.page_count <= 0:
            return 0.0
        return min(round(self.pages_processed / self.page_count, 2), 1.0)

    model_config = ConfigDict(from_attributes=True)


class DocumentLibraryItem(DocumentResponse):
    """Document metadata augmented with session attempt stats for the Library view."""
    best_score: Optional[float] = None
    last_score: Optional[float] = None
    attempt_count: int = 0


class AttemptHistoryItem(BaseModel):
    """Past exam / practice attempt record."""
    session_id: str
    mode: SessionMode
    started_at: datetime
    submitted_at: datetime
    score_percentage: float
    score_earned: float
    total_questions: int
    correct_count: int
    wrong_count: int
    unanswered_count: int
    time_taken_seconds: int
    passed: Optional[bool] = None
    target_score_percentage: Optional[float] = None

    @field_serializer("started_at", "submitted_at")
    def serialize_history_datetimes(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class WeakQuestionItem(BaseModel):
    """Question item identified as high-error across past attempts."""
    question_id: str
    number: Optional[int] = None
    text: str
    options: List[QuestionOption]
    correct_options: List[str]
    answer_source: AnswerSource
    explanation: Optional[str] = None
    context: Optional[str] = None
    figure_image_url: Optional[str] = None
    mistake_count: int
    attempt_count: int
    error_rate: float  # e.g. 0.75 for 75% error rate


class DocumentImportRequest(BaseModel):
    """Payload for importing a saved JSON question set."""
    filename: Optional[str] = None
    questions: List[QuestionCreate]


# --- Session & Test-Taking Models ---

class SessionCreate(BaseModel):
    document_id: str
    mode: SessionMode = SessionMode.EXAM
    time_limit_seconds: Optional[int] = None
    question_count: Optional[int] = None
    shuffle_questions: bool = False
    shuffle_options: bool = False
    negative_marking: float = 0.0
    target_score_percentage: Optional[float] = None
    partial_credit: bool = False


class RetakeRequest(BaseModel):
    """Payload to initiate a retake session."""
    mode: str = Field(default="same", description="'same' for exact same test, 'wrong_and_unanswered' for mistakes only")


class TestSessionResponse(BaseModel):
    """
    Active test session state returned when starting/taking a test.
    Questions inside this response are strictly typed as TestQuestion.
    """
    id: str
    document_id: str
    mode: SessionMode
    time_limit_seconds: Optional[int] = None
    negative_marking: float = 0.0
    target_score_percentage: Optional[float] = None
    partial_credit: bool = False
    started_at: datetime
    question_order: List[str]
    questions: List[TestQuestion]
    answers: List["AnswerSaveItem"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("started_at")
    def serialize_started_at(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class PracticeCheckRequest(BaseModel):
    selected_options: List[str]
    time_spent_seconds: int = 0


class PracticeFeedbackResponse(BaseModel):
    question_id: str
    is_correct: bool
    correct_options: List[str]
    explanation: Optional[str] = None
    answer_source: AnswerSource


class AnswerSaveItem(BaseModel):
    """A single question's progress state."""
    question_id: str
    selected_options: List[str] = Field(default_factory=list)
    flagged: bool = False
    time_spent_seconds: int = 0


class AnswerProgressUpdate(BaseModel):
    """Batch progress saving payload."""
    answers: List[AnswerSaveItem]


class AnswerProgressResponse(BaseModel):
    session_id: str
    saved_count: int
    updated_at: datetime


# --- Submission & Grading Models ---

class QuestionResult(BaseModel):
    """Graded result for an individual question returned post-submission."""
    question_id: str
    number: Optional[int] = None
    text: str
    options: List[QuestionOption]
    selected_options: List[str]
    correct_options: List[str]
    is_correct: bool
    is_graded: bool = True
    is_partial: bool = False
    score_earned: float = 0.0
    answer_source: AnswerSource
    explanation: Optional[str] = None
    context: Optional[str] = None
    figure_image_url: Optional[str] = None
    time_spent_seconds: int = 0
    flagged: bool = False


class SubmissionResponse(BaseModel):
    """Full graded report returned after submitting a test session."""
    session_id: str
    document_id: str
    mode: SessionMode
    started_at: datetime
    submitted_at: datetime
    total_questions: int
    total_graded: int
    attempted_count: int
    correct_count: int
    wrong_count: int
    unanswered_count: int
    ungraded_count: int
    score_earned: float
    score_percentage: float
    target_score_percentage: Optional[float] = None
    passed: Optional[bool] = None
    time_taken_seconds: int
    avg_time_per_question_seconds: float
    partial_credit: bool = False
    negative_marking: float = 0.0
    results: List[QuestionResult]

    @field_serializer("started_at", "submitted_at")
    def serialize_submission_datetimes(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
