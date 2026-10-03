from enum import Enum


class AnswerSource(str, Enum):
    """Source provenance tracking for extracted question correct answers."""
    MARKED_IN_DOCUMENT = "marked_in_document"
    ANSWER_KEY_IN_DOCUMENT = "answer_key_in_document"
    AI_SUGGESTED = "ai_suggested"
    MANUAL = "manual"
    NONE = "none"


class DocumentStatus(str, Enum):
    """Lifecycle status of a document."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    EXTRACTED = "extracted"
    FAILED = "failed"


class SessionMode(str, Enum):
    """Mode for test-taking session."""
    EXAM = "exam"
    PRACTICE = "practice"


class FileType(str, Enum):
    """Type of the uploaded source file."""
    PDF = "pdf"
    IMAGE = "image"
    DOCX = "docx"
    TEXT = "text"
    OTHER = "other"
