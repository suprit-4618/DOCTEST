import random
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from models.db import DocumentDB, QuestionDB, TestSessionDB, AnswerDB
from models.enums import SessionMode, AnswerSource
from services.scoring import grade_session_answers, evaluate_question
from models.schemas import (
    SessionCreate,
    RetakeRequest,
    TestSessionResponse,
    TestQuestion,
    QuestionOption,
    AnswerSaveItem,
    AnswerProgressUpdate,
    AnswerProgressResponse,
    SubmissionResponse,
    QuestionResult,
    PracticeCheckRequest,
    PracticeFeedbackResponse,
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("", response_model=TestSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_test_session(
    payload: SessionCreate,
    db: Session = Depends(get_db)
):
    """
    Start a test session.
    CRITICAL SECURITY CONTRACT:
    Returns questions converted to TestQuestion instances which structurally
    OMIT correct_options, answer_source, confidence, and explanation.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == payload.document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {payload.document_id} not found."
        )

    db_questions = (
        db.query(QuestionDB)
        .filter(QuestionDB.document_id == payload.document_id)
        .order_by(QuestionDB.number)
        .all()
    )

    if not db_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has no extracted questions to test."
        )

    # Question subsetting
    all_q_ids = [q.id for q in db_questions]
    if payload.shuffle_questions:
        random.shuffle(all_q_ids)

    if payload.question_count and 0 < payload.question_count < len(all_q_ids):
        selected_q_ids = all_q_ids[:payload.question_count]
    else:
        selected_q_ids = all_q_ids

    session = TestSessionDB(
        document_id=doc.id,
        mode=payload.mode.value,
        time_limit_seconds=payload.time_limit_seconds,
        negative_marking=payload.negative_marking,
        shuffle_options=payload.shuffle_options,
        target_score_percentage=payload.target_score_percentage,
        partial_credit=payload.partial_credit,
        question_order=selected_q_ids,
        started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Map database questions by ID to maintain ordered list
    q_map = {q.id: q for q in db_questions}
    test_questions: List[TestQuestion] = []
    for q_id in session.question_order:
        q = q_map.get(q_id)
        if q:
            opts = [QuestionOption(label=opt["label"], text=opt["text"]) for opt in q.options]
            if payload.shuffle_options:
                random.shuffle(opts)
                opts = [
                    QuestionOption(label=chr(65 + i), text=opt.text)
                    for i, opt in enumerate(opts)
                ]

            test_questions.append(
                TestQuestion(
                    id=q.id,
                    document_id=q.document_id,
                    number=q.number,
                    text=q.text,
                    options=opts,
                    source_page=q.source_page
                )
            )

    return TestSessionResponse(
        id=session.id,
        document_id=session.document_id,
        mode=SessionMode(session.mode),
        time_limit_seconds=session.time_limit_seconds,
        negative_marking=session.negative_marking,
        target_score_percentage=session.target_score_percentage,
        partial_credit=session.partial_credit,
        started_at=session.started_at,
        question_order=session.question_order,
        questions=test_questions,
        answers=[]
    )


@router.get("/{session_id}", response_model=TestSessionResponse)
async def get_test_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve active session state for browser refresh / resumption.
    Returns sanitized TestQuestion items and saved answers with ZERO answer leakage.
    """
    session = db.query(TestSessionDB).filter(TestSessionDB.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found.")

    db_questions = db.query(QuestionDB).filter(QuestionDB.document_id == session.document_id).all()
    q_map = {q.id: q for q in db_questions}

    test_questions: List[TestQuestion] = []
    for q_id in session.question_order:
        q = q_map.get(q_id)
        if q:
            opts = [QuestionOption(label=opt["label"], text=opt["text"]) for opt in q.options]
            test_questions.append(
                TestQuestion(
                    id=q.id,
                    document_id=q.document_id,
                    number=q.number,
                    text=q.text,
                    options=opts,
                    source_page=q.source_page
                )
            )

    saved_answers = (
        db.query(AnswerDB)
        .filter(AnswerDB.session_id == session_id)
        .all()
    )
    answer_items = [
        AnswerSaveItem(
            question_id=a.question_id,
            selected_options=a.selected_options,
            flagged=a.flagged,
            time_spent_seconds=a.time_spent_seconds
        )
        for a in saved_answers
    ]

    return TestSessionResponse(
        id=session.id,
        document_id=session.document_id,
        mode=SessionMode(session.mode),
        time_limit_seconds=session.time_limit_seconds,
        negative_marking=session.negative_marking,
        target_score_percentage=session.target_score_percentage,
        partial_credit=session.partial_credit,
        started_at=session.started_at,
        question_order=session.question_order,
        questions=test_questions,
        answers=answer_items
    )


@router.put("/{session_id}/answers", response_model=AnswerProgressResponse)
async def save_session_answers(
    session_id: str,
    payload: AnswerProgressUpdate,
    db: Session = Depends(get_db)
):
    """
    Save test-taker answers / progress intermittently during a test session.
    """
    session = db.query(TestSessionDB).filter(TestSessionDB.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session {session_id} not found."
        )

    if session.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has already been submitted and cannot be modified."
        )

    saved_count = 0
    for item in payload.answers:
        answer_rec = (
            db.query(AnswerDB)
            .filter(AnswerDB.session_id == session_id, AnswerDB.question_id == item.question_id)
            .first()
        )
        if answer_rec:
            answer_rec.selected_options = item.selected_options
            answer_rec.flagged = item.flagged
            answer_rec.time_spent_seconds = item.time_spent_seconds
        else:
            answer_rec = AnswerDB(
                session_id=session_id,
                question_id=item.question_id,
                selected_options=item.selected_options,
                flagged=item.flagged,
                time_spent_seconds=item.time_spent_seconds
            )
            db.add(answer_rec)
        saved_count += 1

    db.commit()

    return AnswerProgressResponse(
        session_id=session_id,
        saved_count=saved_count,
        updated_at=datetime.now(timezone.utc)
    )


@router.post("/{session_id}/questions/{question_id}/check", response_model=PracticeFeedbackResponse)
async def check_practice_question(
    session_id: str,
    question_id: str,
    payload: PracticeCheckRequest,
    db: Session = Depends(get_db)
):
    """
    PRACTICE MODE ONLY: Returns instant feedback for a SINGLE question
    only AFTER the user has selected their answer.
    """
    session = db.query(TestSessionDB).filter(TestSessionDB.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    if session.mode != SessionMode.PRACTICE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Instant feedback is only accessible in Practice mode."
        )

    question = db.query(QuestionDB).filter(QuestionDB.id == question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")

    # Save user answer
    answer_rec = (
        db.query(AnswerDB)
        .filter(AnswerDB.session_id == session_id, AnswerDB.question_id == question_id)
        .first()
    )
    if answer_rec:
        answer_rec.selected_options = payload.selected_options
        answer_rec.time_spent_seconds = payload.time_spent_seconds
    else:
        answer_rec = AnswerDB(
            session_id=session_id,
            question_id=question_id,
            selected_options=payload.selected_options,
            time_spent_seconds=payload.time_spent_seconds
        )
        db.add(answer_rec)
    db.commit()

    correct_options = question.correct_options or []
    is_correct, _, _, _ = evaluate_question(
        selected_options=payload.selected_options,
        correct_options=correct_options,
        answer_source=question.answer_source,
        partial_credit=session.partial_credit,
    )

    return PracticeFeedbackResponse(
        question_id=question.id,
        is_correct=is_correct,
        correct_options=correct_options,
        explanation=question.explanation,
        answer_source=AnswerSource(question.answer_source)
    )


@router.post("/{session_id}/submit", response_model=SubmissionResponse)
async def submit_test_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Submit test session for grading.
    Evaluates submitted answers on the server and returns full performance metrics,
    correct answers, source provenance, explanations, and pass/fail indicators.
    """
    session = db.query(TestSessionDB).filter(TestSessionDB.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test session {session_id} not found."
        )

    now = datetime.now(timezone.utc)
    if session.submitted_at is None:
        session.submitted_at = now
        db.commit()

    db_questions = db.query(QuestionDB).filter(QuestionDB.document_id == session.document_id).all()
    q_map: Dict[str, QuestionDB] = {q.id: q for q in db_questions}

    user_answers = db.query(AnswerDB).filter(AnswerDB.session_id == session_id).all()
    ans_map: Dict[str, AnswerDB] = {a.question_id: a for a in user_answers}

    results, stats = grade_session_answers(
        questions_map=q_map,
        answers_map=ans_map,
        question_order=session.question_order,
        negative_marking=session.negative_marking,
        partial_credit=session.partial_credit,
        target_score_percentage=session.target_score_percentage,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
    )

    return SubmissionResponse(
        session_id=session.id,
        document_id=session.document_id,
        mode=SessionMode(session.mode),
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        total_questions=stats["total_questions"],
        total_graded=stats["total_graded"],
        attempted_count=stats["attempted_count"],
        correct_count=stats["correct_count"],
        wrong_count=stats["wrong_count"],
        unanswered_count=stats["unanswered_count"],
        ungraded_count=stats["ungraded_count"],
        score_earned=stats["score_earned"],
        score_percentage=stats["score_percentage"],
        target_score_percentage=stats["target_score_percentage"],
        passed=stats["passed"],
        time_taken_seconds=stats["time_taken_seconds"],
        avg_time_per_question_seconds=stats["avg_time_per_question_seconds"],
        partial_credit=stats["partial_credit"],
        negative_marking=stats["negative_marking"],
        results=results
    )


@router.post("/{session_id}/retake", response_model=TestSessionResponse, status_code=status.HTTP_201_CREATED)
async def retake_test_session(
    session_id: str,
    payload: RetakeRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new test session based on a previously submitted session.
    - mode == 'same': Retakes the exact same test questions.
    - mode == 'wrong_and_unanswered': Retakes only the questions that were missed or unanswered.
    """
    session = db.query(TestSessionDB).filter(TestSessionDB.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Original test session {session_id} not found."
        )

    db_questions = db.query(QuestionDB).filter(QuestionDB.document_id == session.document_id).all()
    q_map = {q.id: q for q in db_questions}

    if payload.mode == "wrong_and_unanswered":
        user_answers = db.query(AnswerDB).filter(AnswerDB.session_id == session_id).all()
        ans_map = {a.question_id: a for a in user_answers}

        subset_q_ids: List[str] = []
        for q_id in session.question_order:
            q = q_map.get(q_id)
            if not q:
                continue
            ans = ans_map.get(q_id)
            selected = ans.selected_options if ans else []
            correct_options = q.correct_options or []
            
            is_correct, is_graded, _, _ = evaluate_question(
                selected_options=selected,
                correct_options=correct_options,
                answer_source=q.answer_source,
                partial_credit=session.partial_credit,
            )
            # Include if question was incorrect or unattempted
            if not is_correct or len(selected) == 0:
                subset_q_ids.append(q_id)

        if not subset_q_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All questions were answered correctly! No mistakes or unanswered questions to retake."
            )
        new_question_order = subset_q_ids
    else:
        new_question_order = list(session.question_order)

    new_session = TestSessionDB(
        document_id=session.document_id,
        mode=session.mode,
        time_limit_seconds=session.time_limit_seconds,
        negative_marking=session.negative_marking,
        shuffle_options=session.shuffle_options,
        target_score_percentage=session.target_score_percentage,
        partial_credit=session.partial_credit,
        question_order=new_question_order,
        started_at=datetime.now(timezone.utc)
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    test_questions: List[TestQuestion] = []
    for q_id in new_session.question_order:
        q = q_map.get(q_id)
        if q:
            opts = [QuestionOption(label=opt["label"], text=opt["text"]) for opt in q.options]
            test_questions.append(
                TestQuestion(
                    id=q.id,
                    document_id=q.document_id,
                    number=q.number,
                    text=q.text,
                    options=opts,
                    source_page=q.source_page
                )
            )

    return TestSessionResponse(
        id=new_session.id,
        document_id=new_session.document_id,
        mode=SessionMode(new_session.mode),
        time_limit_seconds=new_session.time_limit_seconds,
        negative_marking=new_session.negative_marking,
        target_score_percentage=new_session.target_score_percentage,
        partial_credit=new_session.partial_credit,
        started_at=new_session.started_at,
        question_order=new_session.question_order,
        questions=test_questions,
        answers=[]
    )

