import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from models.enums import DocumentStatus, AnswerSource, SessionMode, FileType


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentDB(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False, default=FileType.PDF.value)
    file_hash = Column(String(64), nullable=True, index=True)
    page_count = Column(Integer, default=1, nullable=False)
    pages_processed = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default=DocumentStatus.UPLOADED.value, nullable=False)
    error_message = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    questions = relationship("QuestionDB", back_populates="document", cascade="all, delete-orphan", order_by="QuestionDB.number")
    sessions = relationship("TestSessionDB", back_populates="document", cascade="all, delete-orphan")


class QuestionDB(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    options = Column(JSON, nullable=False, default=list)  # [{"label": "A", "text": "..."}]
    correct_options = Column(JSON, nullable=False, default=list)  # ["A", "B"]
    answer_source = Column(String(50), default=AnswerSource.NONE.value, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    source_page = Column(Integer, nullable=True)
    explanation = Column(Text, nullable=True)
    context = Column(Text, nullable=True)  # Shared reading passage or background context
    figure_image_url = Column(String(500), nullable=True)  # URL / path to figure diagram
    needs_review = Column(Boolean, default=False, nullable=False)

    # Relationships
    document = relationship("DocumentDB", back_populates="questions")


class TestSessionDB(Base):
    __tablename__ = "test_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String(50), default=SessionMode.EXAM.value, nullable=False)
    time_limit_seconds = Column(Integer, nullable=True)
    negative_marking = Column(Float, default=0.0, nullable=False)
    shuffle_options = Column(Boolean, default=False, nullable=False)
    target_score_percentage = Column(Float, nullable=True)
    partial_credit = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    question_order = Column(JSON, nullable=False, default=list)  # ["q1_id", "q2_id", ...]

    # Relationships
    document = relationship("DocumentDB", back_populates="sessions")
    answers = relationship("AnswerDB", back_populates="session", cascade="all, delete-orphan")


class AnswerDB(Base):
    __tablename__ = "session_answers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    selected_options = Column(JSON, nullable=False, default=list)  # ["A"]
    flagged = Column(Boolean, default=False, nullable=False)
    time_spent_seconds = Column(Integer, default=0, nullable=False)

    # Relationships
    session = relationship("TestSessionDB", back_populates="answers")
    question = relationship("QuestionDB")
