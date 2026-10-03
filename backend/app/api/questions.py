from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from models.db import QuestionDB
from models.enums import AnswerSource
from models.schemas import QuestionDetail, QuestionUpdate

router = APIRouter(prefix="/questions", tags=["Questions"])


@router.get("/{question_id}", response_model=QuestionDetail)
async def get_question(question_id: str, db: Session = Depends(get_db)):
    """Retrieve single question details."""
    question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question {question_id} not found.")
    return question


@router.put("/{question_id}", response_model=QuestionDetail)
async def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a question's content, options, correct answers, or metadata.
    Used during the pre-test review/edit screen.
    """
    question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question {question_id} not found."
        )

    if payload.text is not None:
        question.text = payload.text
    if payload.number is not None:
        question.number = payload.number
    if payload.options is not None:
        question.options = [opt.model_dump() for opt in payload.options]
    if payload.correct_options is not None:
        question.correct_options = payload.correct_options
        # If correct options were modified without explicit source, mark as manual
        if payload.answer_source is None:
            question.answer_source = AnswerSource.MANUAL.value
    if payload.answer_source is not None:
        question.answer_source = payload.answer_source.value
    if payload.confidence is not None:
        question.confidence = payload.confidence
    if payload.explanation is not None:
        question.explanation = payload.explanation
    if payload.needs_review is not None:
        question.needs_review = payload.needs_review

    db.commit()
    db.refresh(question)
    return question


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(question_id: str, db: Session = Depends(get_db)):
    """Delete a question from the document."""
    question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question {question_id} not found.")

    db.delete(question)
    db.commit()
    return None
