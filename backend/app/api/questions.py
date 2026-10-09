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


@router.post("/{question_id}/ai-verify")
async def ai_verify_question(
    question_id: str,
    apply: bool = False,
    db: Session = Depends(get_db)
):
    """Ask AI to analyze the question, determine the true correct answer, and explain why."""
    question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question {question_id} not found.")

    from providers.factory import get_llm_provider
    llm = get_llm_provider()
    payload = [{
        "question_id": question.id,
        "question_number": question.number,
        "question_text": question.text,
        "options": question.options
    }]

    try:
        res = await llm.suggest_answers(payload)
        if not res.suggestions:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="AI could not solve this question.")

        suggestion = res.suggestions[0]
        valid_labels = {opt["label"].upper() for opt in question.options}
        filtered_opts = [o for o in suggestion.correct_options if o.upper() in valid_labels]

        if apply and filtered_opts:
            question.correct_options = filtered_opts
            question.answer_source = AnswerSource.AI_SUGGESTED.value
            question.explanation = suggestion.explanation
            question.needs_review = False
            db.commit()
            db.refresh(question)

        return {
            "question_id": question.id,
            "suggested_options": filtered_opts or suggestion.correct_options,
            "explanation": suggestion.explanation,
            "applied": apply
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI verification failed: {str(e)}"
        )
