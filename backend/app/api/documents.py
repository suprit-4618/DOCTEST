import hashlib
import json
import logging
import shutil
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from models.db import DocumentDB, QuestionDB, TestSessionDB, AnswerDB
from models.enums import AnswerSource, DocumentStatus, FileType, SessionMode
from models.schemas import (
    DocumentResponse,
    DocumentLibraryItem,
    DocumentRename,
    DocumentImportRequest,
    AttemptHistoryItem,
    WeakQuestionItem,
    QuestionDetail,
    QuestionCreate,
    QuestionOption,
    ApplyAnswerKeyRequest,
    TestSessionResponse,
    TestQuestion,
)
from services.ingestion import (
    IngestionError,
    get_document_storage_dir,
    process_document_background,
    validate_file_content_and_type,
    sanitize_filename,
)
from services.extraction import (
    ExtractionPipeline,
    suggest_answers_for_document,
    parse_inline_answer_key,
)
from services.export_service import generate_printable_exam_pdf, export_document_to_json
from services.scoring import grade_session_answers, evaluate_question

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=List[DocumentLibraryItem])
async def list_documents(db: Session = Depends(get_db)):
    """
    Retrieve all documents in 'My Library' with question counts, creation timestamps,
    and historical performance indicators (best score, last score, attempt count).
    """
    docs = db.query(DocumentDB).order_by(DocumentDB.created_at.desc()).all()
    library_items: List[DocumentLibraryItem] = []

    for doc in docs:
        q_count = len(doc.questions)
        submitted_sessions = [s for s in doc.sessions if s.submitted_at is not None]
        attempt_count = len(submitted_sessions)

        best_score: Optional[float] = None
        last_score: Optional[float] = None

        if submitted_sessions:
            # Sort chronologically by submitted_at
            submitted_sessions.sort(key=lambda s: s.submitted_at or s.started_at)
            scores: List[float] = []
            
            # Map questions for fast lookup
            q_map = {q.id: q for q in doc.questions}
            
            for s in submitted_sessions:
                user_answers = db.query(AnswerDB).filter(AnswerDB.session_id == s.id).all()
                ans_map = {a.question_id: a for a in user_answers}
                
                _, stats = grade_session_answers(
                    questions_map=q_map,
                    answers_map=ans_map,
                    question_order=s.question_order,
                    negative_marking=s.negative_marking,
                    partial_credit=s.partial_credit,
                    target_score_percentage=s.target_score_percentage,
                    started_at=s.started_at,
                    submitted_at=s.submitted_at,
                )
                scores.append(stats["score_percentage"])

            if scores:
                best_score = max(scores)
                last_score = scores[-1]

        library_items.append(
            DocumentLibraryItem(
                id=doc.id,
                filename=doc.filename,
                file_type=FileType(doc.file_type) if doc.file_type in [e.value for e in FileType] else FileType.OTHER,
                page_count=doc.page_count,
                pages_processed=doc.pages_processed,
                status=DocumentStatus(doc.status),
                error_message=doc.error_message,
                created_at=doc.created_at,
                question_count=q_count,
                best_score=best_score,
                last_score=last_score,
                attempt_count=attempt_count,
            )
        )

    return library_items


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    pasted_text: Optional[str] = Form(None),
    filename: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload a document (PDF, image, docx, or pasted text) for ingestion and MCQ extraction.
    Caches extraction results by file hash so re-uploading the same file skips AI calls.
    """
    if not file and not pasted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a file upload or pasted text must be provided."
        )

    file_bytes: Optional[bytes] = None
    file_type: FileType = FileType.TEXT
    determined_filename: str = ""
    file_hash: Optional[str] = None

    if file:
        raw_name = filename or file.filename or "Uploaded_Document"
        determined_filename = sanitize_filename(raw_name)
        try:
            file_bytes = await file.read()
            file_hash = hashlib.sha256(file_bytes).hexdigest()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read uploaded file: {str(e)}"
            )

        try:
            file_type, _ = validate_file_content_and_type(file_bytes, determined_filename)
        except IngestionError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    else:
        assert pasted_text is not None
        raw_name = filename or "Pasted_Questions.txt"
        determined_filename = sanitize_filename(raw_name)
        file_type = FileType.TEXT
        file_hash = hashlib.sha256(pasted_text.encode("utf-8")).hexdigest()

    # --- File Hash Caching Check ---
    cached_doc = (
        db.query(DocumentDB)
        .filter(
            DocumentDB.file_hash == file_hash,
            DocumentDB.status == DocumentStatus.EXTRACTED.value
        )
        .first()
    )

    if cached_doc and cached_doc.questions:
        logger.info(f"Cache hit for hash {file_hash}: Reusing questions from document {cached_doc.id}")
        
        # Create cloned document immediately with EXTRACTED status
        new_doc = DocumentDB(
            filename=determined_filename,
            file_type=file_type.value,
            file_hash=file_hash,
            page_count=cached_doc.page_count,
            pages_processed=cached_doc.pages_processed,
            status=DocumentStatus.EXTRACTED.value,
            extracted_text=cached_doc.extracted_text,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)

        # Clone questions
        for cq in cached_doc.questions:
            cloned_q = QuestionDB(
                document_id=new_doc.id,
                number=cq.number,
                text=cq.text,
                options=cq.options,
                correct_options=cq.correct_options,
                answer_source=cq.answer_source,
                confidence=cq.confidence,
                source_page=cq.source_page,
                explanation=cq.explanation,
                needs_review=cq.needs_review,
            )
            db.add(cloned_q)

        # Copy rendered storage files if present
        cached_storage = get_document_storage_dir(cached_doc.id)
        new_storage = get_document_storage_dir(new_doc.id)
        if cached_storage.exists():
            try:
                shutil.copytree(cached_storage, new_storage, dirs_exist_ok=True)
            except Exception as e:
                logger.warning(f"Could not copy cached storage pages: {e}")

        db.commit()
        return DocumentResponse(
            id=new_doc.id,
            filename=new_doc.filename,
            file_type=FileType(new_doc.file_type),
            page_count=new_doc.page_count,
            pages_processed=new_doc.pages_processed,
            status=DocumentStatus.EXTRACTED,
            created_at=new_doc.created_at,
            question_count=len(cached_doc.questions)
        )

    # If no cache hit: standard ingestion and background extraction
    doc = DocumentDB(
        filename=determined_filename,
        file_type=file_type.value,
        file_hash=file_hash,
        page_count=1,
        pages_processed=0,
        status=DocumentStatus.PROCESSING.value
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(
        process_document_background,
        document_id=doc.id,
        file_bytes=file_bytes,
        file_type=file_type,
        original_filename=determined_filename,
        pasted_text=pasted_text
    )

    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=FileType(doc.file_type),
        page_count=doc.page_count,
        pages_processed=doc.pages_processed,
        status=DocumentStatus(doc.status),
        error_message=doc.error_message,
        created_at=doc.created_at,
        question_count=0
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Retrieve document processing status, page counts, and real-time progress."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    q_count = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).count()
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=FileType(doc.file_type),
        page_count=doc.page_count,
        pages_processed=doc.pages_processed,
        status=DocumentStatus(doc.status),
        error_message=doc.error_message,
        created_at=doc.created_at,
        question_count=q_count
    )


@router.patch("/{document_id}", response_model=DocumentResponse)
async def rename_document(
    document_id: str,
    payload: DocumentRename,
    db: Session = Depends(get_db)
):
    """Rename an existing document title in My Library."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.filename = payload.filename.strip()
    db.commit()
    db.refresh(doc)

    q_count = len(doc.questions)
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=FileType(doc.file_type),
        page_count=doc.page_count,
        pages_processed=doc.pages_processed,
        status=DocumentStatus(doc.status),
        error_message=doc.error_message,
        created_at=doc.created_at,
        question_count=q_count
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """
    Delete a document from My Library.
    Cascades to delete questions, test sessions, and wipes stored files from disk.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # 1. Remove storage folder on disk
    doc_storage_dir = get_document_storage_dir(document_id)
    if doc_storage_dir.exists():
        try:
            shutil.rmtree(doc_storage_dir, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Failed to delete storage directory {doc_storage_dir}: {e}")

    # 2. Delete database record
    db.delete(doc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{document_id}/attempts", response_model=List[AttemptHistoryItem])
async def get_document_attempts(document_id: str, db: Session = Depends(get_db)):
    """
    Retrieve attempt history for this document with scores, timing, and pass/fail status
    ordered chronologically for progress charting.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    sessions = (
        db.query(TestSessionDB)
        .filter(TestSessionDB.document_id == document_id, TestSessionDB.submitted_at != None)
        .order_by(TestSessionDB.submitted_at.asc())
        .all()
    )

    q_map = {q.id: q for q in doc.questions}
    attempt_items: List[AttemptHistoryItem] = []

    for s in sessions:
        user_answers = db.query(AnswerDB).filter(AnswerDB.session_id == s.id).all()
        ans_map = {a.question_id: a for a in user_answers}

        _, stats = grade_session_answers(
            questions_map=q_map,
            answers_map=ans_map,
            question_order=s.question_order,
            negative_marking=s.negative_marking,
            partial_credit=s.partial_credit,
            target_score_percentage=s.target_score_percentage,
            started_at=s.started_at,
            submitted_at=s.submitted_at,
        )

        attempt_items.append(
            AttemptHistoryItem(
                session_id=s.id,
                mode=SessionMode(s.mode),
                started_at=s.started_at,
                submitted_at=s.submitted_at,
                score_percentage=stats["score_percentage"],
                score_earned=stats["score_earned"],
                total_questions=stats["total_questions"],
                correct_count=stats["correct_count"],
                wrong_count=stats["wrong_count"],
                unanswered_count=stats["unanswered_count"],
                time_taken_seconds=stats["time_taken_seconds"],
                passed=stats["passed"],
                target_score_percentage=stats["target_score_percentage"],
            )
        )

    return attempt_items


@router.get("/{document_id}/weak-questions", response_model=List[WeakQuestionItem])
async def get_document_weak_questions(document_id: str, db: Session = Depends(get_db)):
    """
    Identifies questions the user has answered incorrectly most often across all attempts.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    sessions = (
        db.query(TestSessionDB)
        .filter(TestSessionDB.document_id == document_id, TestSessionDB.submitted_at != None)
        .all()
    )

    if not sessions:
        return []

    # Map question tracking
    stats_by_qid = {q.id: {"mistakes": 0, "attempts": 0} for q in doc.questions}
    
    for s in sessions:
        user_answers = db.query(AnswerDB).filter(AnswerDB.session_id == s.id).all()
        ans_map = {a.question_id: a for a in user_answers}

        for q in doc.questions:
            if q.id in s.question_order:
                ans = ans_map.get(q.id)
                selected = ans.selected_options if ans else []
                correct = q.correct_options or []
                
                is_correct, is_graded, _, _ = evaluate_question(
                    selected_options=selected,
                    correct_options=correct,
                    answer_source=q.answer_source,
                    partial_credit=s.partial_credit,
                )

                if is_graded:
                    stats_by_qid[q.id]["attempts"] += 1
                    if not is_correct or len(selected) == 0:
                        stats_by_qid[q.id]["mistakes"] += 1

    weak_items: List[WeakQuestionItem] = []
    for q in doc.questions:
        st = stats_by_qid.get(q.id, {"mistakes": 0, "attempts": 0})
        attempts = st["attempts"]
        mistakes = st["mistakes"]
        error_rate = round(mistakes / attempts, 2) if attempts > 0 else 0.0

        if mistakes > 0:
            opts = [QuestionOption(label=opt["label"], text=opt["text"]) for opt in (q.options or [])]
            weak_items.append(
                WeakQuestionItem(
                    question_id=q.id,
                    number=q.number,
                    text=q.text,
                    options=opts,
                    correct_options=q.correct_options or [],
                    answer_source=AnswerSource(q.answer_source) if q.answer_source in [e.value for e in AnswerSource] else AnswerSource.NONE,
                    explanation=q.explanation,
                    mistake_count=mistakes,
                    attempt_count=attempts,
                    error_rate=error_rate
                )
            )

    # Sort by mistake_count descending, then error_rate descending
    weak_items.sort(key=lambda x: (x.mistake_count, x.error_rate), reverse=True)
    return weak_items


@router.post("/{document_id}/practice-weak", response_model=TestSessionResponse, status_code=status.HTTP_201_CREATED)
async def practice_weak_questions(document_id: str, db: Session = Depends(get_db)):
    """
    One-click launch of a tailored practice test containing only the user's weak questions.
    """
    weak_list = await get_document_weak_questions(document_id, db)
    if not weak_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No weak or missed questions found for this document. Take a test first!"
        )

    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    weak_q_ids = [w.question_id for w in weak_list]
    session = TestSessionDB(
        document_id=doc.id,
        mode=SessionMode.PRACTICE.value,
        time_limit_seconds=None,
        negative_marking=0.0,
        partial_credit=True,
        question_order=weak_q_ids,
        started_at=datetime.now(timezone.utc)
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    q_map = {q.id: q for q in doc.questions}
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

    return TestSessionResponse(
        id=session.id,
        document_id=session.document_id,
        mode=SessionMode.PRACTICE,
        time_limit_seconds=None,
        negative_marking=0.0,
        started_at=session.started_at,
        question_order=session.question_order,
        questions=test_questions,
        answers=[]
    )


@router.get("/{document_id}/export/json")
async def export_document_json(document_id: str, db: Session = Depends(get_db)):
    """Export cleaned questions as a JSON file."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    questions = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).order_by(QuestionDB.number).all()
    data = export_document_to_json(doc, questions)
    
    clean_name = "".join(c for c in doc.filename if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"{clean_name}_questions.json"
    
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{document_id}/export/pdf")
async def export_document_pdf(
    document_id: str,
    include_answer_key: bool = False,
    db: Session = Depends(get_db)
):
    """
    Export cleaned question set as a clean printable PDF test paper with NO answers,
    and an optional separate answer key and explanations page at the end.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    questions = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).order_by(QuestionDB.number).all()
    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions found to export.")

    pdf_bytes = generate_printable_exam_pdf(doc, questions, include_answer_key=include_answer_key)
    
    clean_name = "".join(c for c in doc.filename if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"{clean_name}_exam_paper.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/import", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def import_document_json_file(
    payload: DocumentImportRequest,
    db: Session = Depends(get_db)
):
    """
    Import a pre-exported or structured JSON question set directly into My Library.
    Populates all questions immediately without invoking AI extraction.
    """
    if not payload.questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions provided in import payload."
        )

    doc_title = payload.filename or f"Imported_Questions_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    raw_json_str = json.dumps([q.model_dump() for q in payload.questions])
    file_hash = hashlib.sha256(raw_json_str.encode("utf-8")).hexdigest()

    new_doc = DocumentDB(
        filename=doc_title,
        file_type=FileType.TEXT.value,
        file_hash=file_hash,
        page_count=1,
        pages_processed=1,
        status=DocumentStatus.EXTRACTED.value,
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    for idx, q in enumerate(payload.questions):
        new_q = QuestionDB(
            document_id=new_doc.id,
            number=q.number or (idx + 1),
            text=q.text,
            options=[opt.model_dump() for opt in q.options],
            correct_options=q.correct_options or [],
            answer_source=q.answer_source.value if q.correct_options else AnswerSource.NONE.value,
            confidence=q.confidence if q.confidence is not None else 1.0,
            source_page=q.source_page,
            explanation=q.explanation,
            needs_review=q.needs_review,
        )
        db.add(new_q)

    db.commit()

    return DocumentResponse(
        id=new_doc.id,
        filename=new_doc.filename,
        file_type=FileType.TEXT,
        page_count=1,
        pages_processed=1,
        status=DocumentStatus.EXTRACTED,
        created_at=new_doc.created_at,
        question_count=len(payload.questions)
    )


@router.get("/{document_id}/pages")
async def get_document_pages(document_id: str, db: Session = Depends(get_db)):
    """Retrieve metadata of rendered page images."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc_dir = get_document_storage_dir(document_id)
    manifest_file = doc_dir / "manifest.json"
    if manifest_file.exists():
        try:
            return json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    return {
        "document_id": document_id,
        "total_pages": doc.page_count,
        "pages_processed": doc.pages_processed,
        "status": doc.status
    }


@router.get("/{document_id}/pages/{page_number}")
async def get_document_page_image(document_id: str, page_number: int):
    """Retrieve a specific rendered page image PNG."""
    doc_dir = get_document_storage_dir(document_id)
    page_path = doc_dir / f"page_{page_number}.png"
    if not page_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Page {page_number} image not found")
    return FileResponse(str(page_path), media_type="image/png")


@router.get("/{document_id}/questions", response_model=List[QuestionDetail])
async def get_document_questions(document_id: str, db: Session = Depends(get_db)):
    """Retrieve FULL question data including correct answers, provenance sources, and explanations."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    questions = (
        db.query(QuestionDB)
        .filter(QuestionDB.document_id == document_id)
        .order_by(QuestionDB.number)
        .all()
    )
    return questions


@router.post("/{document_id}/questions", response_model=QuestionDetail, status_code=status.HTTP_201_CREATED)
async def add_document_question(
    document_id: str,
    payload: QuestionCreate,
    db: Session = Depends(get_db)
):
    """Manually add a new question to the document."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if payload.number is None:
        max_num = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).count()
        assigned_number = max_num + 1
    else:
        assigned_number = payload.number

    new_q = QuestionDB(
        document_id=document_id,
        number=assigned_number,
        text=payload.text,
        options=[opt.model_dump() for opt in payload.options],
        correct_options=payload.correct_options,
        answer_source=payload.answer_source.value if payload.correct_options else AnswerSource.NONE.value,
        confidence=payload.confidence,
        source_page=payload.source_page,
        explanation=payload.explanation,
        needs_review=payload.needs_review,
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return new_q


@router.post("/{document_id}/apply-answer-key", response_model=List[QuestionDetail])
async def apply_answer_key(
    document_id: str,
    payload: ApplyAnswerKeyRequest,
    db: Session = Depends(get_db)
):
    """Bulk apply an answer key string (e.g. '1-B, 2-D, 3-A') or mapping dictionary."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    mappings = payload.key_mappings or {}
    if payload.key_text:
        parsed = parse_inline_answer_key(payload.key_text)
        mappings.update(parsed)

    if not mappings:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid answer key patterns found in the provided text (e.g. '1-B, 2-D')."
        )

    questions = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).all()
    for q in questions:
        if q.number in mappings:
            q.correct_options = mappings[q.number]
            q.answer_source = AnswerSource.MANUAL.value
            q.needs_review = False

    db.commit()
    for q in questions:
        db.refresh(q)

    return sorted(questions, key=lambda x: x.number or 9999)


@router.post("/{document_id}/suggest-answers", response_model=List[QuestionDetail])
async def suggest_answers(document_id: str, db: Session = Depends(get_db)):
    """User-triggered endpoint to request AI-suggested answers and explanations."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        updated_questions = await suggest_answers_for_document(document_id)
        return updated_questions
    except Exception as e:
        logger.error(f"Suggest answers failed for document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI answer suggestions: {str(e)}"
        )


@router.post("/{document_id}/cancel", response_model=DocumentResponse)
async def cancel_document_processing(document_id: str, db: Session = Depends(get_db)):
    """
    Cancel an ongoing document ingestion or extraction background task.
    Marks document status as FAILED / CANCELLED.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.is_cancelled = True
    doc.status = DocumentStatus.FAILED.value
    doc.error_message = "Processing was cancelled by the user."
    db.commit()
    db.refresh(doc)

    q_count = len(doc.questions)
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        file_type=FileType(doc.file_type),
        page_count=doc.page_count,
        pages_processed=doc.pages_processed,
        status=DocumentStatus(doc.status),
        error_message=doc.error_message,
        created_at=doc.created_at,
        question_count=q_count
    )


@router.post("/{document_id}/extract")
async def trigger_ai_extraction(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger the AI Vision extraction pipeline in background on the ingested document."""
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.is_cancelled = False
    doc.status = DocumentStatus.PROCESSING.value
    doc.error_message = None
    db.commit()

    pipeline = ExtractionPipeline()
    background_tasks.add_task(pipeline.run_extraction, document_id)

    return {"status": "processing", "message": "Extraction started in background"}


@router.post("/{document_id}/retry-failed", response_model=List[QuestionDetail])
async def retry_failed_extraction(
    document_id: str,
    target_pages: Optional[List[int]] = None,
    db: Session = Depends(get_db)
):
    """
    Retry extraction on failed pages or the entire document without re-uploading.
    """
    doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.is_cancelled = False
    doc.status = DocumentStatus.PROCESSING.value
    doc.error_message = None
    db.commit()

    pipeline = ExtractionPipeline()
    try:
        await pipeline.run_extraction(document_id, target_pages=target_pages)
        questions = (
            db.query(QuestionDB)
            .filter(QuestionDB.document_id == document_id)
            .order_by(QuestionDB.number)
            .all()
        )
        return questions
    except Exception as e:
        logger.error(f"Extraction failed for document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )
