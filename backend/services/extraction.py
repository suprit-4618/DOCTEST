import asyncio
import difflib
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from app.core.config import settings
from app.core.database import SessionLocal
from models.db import DocumentDB, QuestionDB
from models.enums import AnswerSource, DocumentStatus
from providers.base import BaseLLMProvider, ExtractionBatchResult, ExtractedQuestionItem, ExtractedOptionItem
from providers.factory import get_llm_provider
from services.ingestion import get_document_storage_dir

logger = logging.getLogger(__name__)


def normalize_option_label(raw_label: str, fallback_index: int = 0) -> str:
    """
    Normalizes diverse option labeling styles into standardized uppercase letters (A, B, C, D, E, F):
    - Letters: A., (a), a), [A] -> A
    - Digits: 1., (1), 1) -> A, B, C, D...
    - Roman numerals: (i), ii., III., iv), (v), VI. -> A, B, C, D, E, F...
    - Fallback: converts zero-based index to letter (0 -> A, 1 -> B, etc.)
    """
    if not raw_label:
        return chr(65 + (fallback_index % 26))

    clean = raw_label.strip(" .):;[](){}—-\t\n\r")
    if not clean:
        return chr(65 + (fallback_index % 26))

    # Roman numerals mapping
    roman_map = {
        "I": "A", "II": "B", "III": "C", "IV": "D", "V": "E", "VI": "F",
        "VII": "G", "VIII": "H", "IX": "I", "X": "J"
    }
    
    # Handle roman numeral patterns (e.g. ii, iii, iv, vi, vii or lowercase i, v)
    upper = clean.upper()
    if upper in ["II", "III", "IV", "VI", "VII", "VIII", "IX", "X"] or clean.lower() in ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"]:
        return roman_map.get(upper, "A")

    # Digits (1 -> A, 2 -> B, 3 -> C, 4 -> D, 5 -> E, 6 -> F)
    if clean.isdigit():
        val = int(clean)
        if 1 <= val <= 26:
            return chr(64 + val)

    # Standard uppercase letter (A, B, C, D, E, F)
    if len(clean) == 1 and clean.isalpha():
        return clean.upper()

    if upper in roman_map:
        return roman_map[upper]

    # Fallback to index-based letter
    return chr(65 + (fallback_index % 26))


def text_similarity(a: str, b: str) -> float:
    """Computes normalized string similarity ratio between 0.0 and 1.0."""
    clean_a = re.sub(r"\s+", " ", a.strip().lower())
    clean_b = re.sub(r"\s+", " ", b.strip().lower())
    return difflib.SequenceMatcher(None, clean_a, clean_b).ratio()


def parse_inline_answer_key(text: str) -> Dict[int, List[str]]:
    """
    Regex parser to extract question-number to answer mappings from key text.
    Handles standard formats (1. B, 1-B, 1: B) and OCR noise (e.g. 1.8 -> 1.B, Z.A -> 7.A).
    """
    mappings: Dict[int, List[str]] = {}
    if not text:
        return mappings

    # Normalize known OCR misrecognitions on question numbers
    clean_text = re.sub(r"(?m)^\s*[Zz]\s*[\.:\-]", "7.", text)
    clean_text = re.sub(r"\b[Zz]\s*[\.:\-]\s*([A-Za-z])", r"7.\1", clean_text)

    # Pattern matches 1. B, 1-B, 1.B, 1: B, 1.8 (OCR for B)
    pattern = re.compile(r"(?:Q|Question\s*)?(\b\d{1,3}\b)\s*[:\.\-\)]\s*\(?([A-Fa-f1-68])\)?(?!\w)")
    for match in pattern.finditer(clean_text):
        q_num = int(match.group(1))
        ans_raw = match.group(2).upper()
        if ans_raw == "8":
            ans_raw = "B"
        ans_opt = normalize_option_label(ans_raw)
        if q_num not in mappings:
            mappings[q_num] = [ans_opt]
        elif ans_opt not in mappings[q_num]:
            mappings[q_num].append(ans_opt)
    return mappings


def parse_text_questions(raw_text: str) -> List[ExtractedQuestionItem]:
    """
    Direct parser for structured plain text or pasted questions.
    Extracts question stems, options, and any inline answer markers (e.g., '(Correct)', 'Ans: B').
    """
    questions: List[ExtractedQuestionItem] = []
    lines = [line.rstrip() for line in raw_text.splitlines()]

    current_q_num: Optional[int] = None
    current_stem_lines: List[str] = []
    current_options: List[ExtractedOptionItem] = []
    current_correct: List[str] = []
    current_explanation: Optional[str] = None

    q_start_re = re.compile(r"^(?:Q|Question\s*)?(\d{1,4})[\.\)\:\-]\s*(.*)$", re.IGNORECASE)
    opt_re = re.compile(r"^\s*([A-Fa-f0-9ivIV]{1,3})[\.\)\:\-\]]\s*(.*)$")
    ans_mark_re = re.compile(r"(?:\(correct\)|\[correct\]|✓|\(ans\)|\*|\(true\))", re.IGNORECASE)
    expl_re = re.compile(r"^(?:Explanation|Exp|Rationale)[\:\-]\s*(.*)$", re.IGNORECASE)

    def save_current():
        nonlocal current_q_num, current_stem_lines, current_options, current_correct, current_explanation
        stem = "\n".join(current_stem_lines).strip()
        if stem and len(current_options) >= 2:
            questions.append(
                ExtractedQuestionItem(
                    question_number=current_q_num or len(questions) + 1,
                    question_text=stem,
                    options=current_options,
                    correct_options=current_correct,
                    answer_source="marked_in_document" if current_correct else "none",
                    confidence=1.0,
                    source_page=1,
                    explanation=current_explanation
                )
            )
        current_q_num = None
        current_stem_lines = []
        current_options = []
        current_correct = []
        current_explanation = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        q_match = q_start_re.match(stripped)
        opt_match = opt_re.match(stripped)
        expl_match = expl_re.match(stripped)

        if q_match and (len(current_options) >= 2 or not current_stem_lines):
            save_current()
            current_q_num = int(q_match.group(1))
            current_stem_lines = [q_match.group(2).strip()]
        elif expl_match:
            current_explanation = expl_match.group(1).strip()
        elif opt_match and current_stem_lines:
            raw_lbl = opt_match.group(1)
            raw_text = opt_match.group(2).strip()
            norm_lbl = normalize_option_label(raw_lbl, len(current_options))
            
            # Check for answer marking in option
            if ans_mark_re.search(raw_text):
                current_correct.append(norm_lbl)
                raw_text = ans_mark_re.sub("", raw_text).strip(" ()[]*")
            
            current_options.append(ExtractedOptionItem(label=norm_lbl, text=raw_text))
        else:
            if not current_options:
                current_stem_lines.append(stripped)
            else:
                if current_options:
                    current_options[-1].text += " " + stripped

    save_current()
    return questions


def fix_ocr_personalization_tokens(text: str) -> str:
    """
    Fixes common OCR character corruptions in exam questions and options:
    - Personalization strings / variables enclosed in percent signs %% that were misread
      as ss...ss, sf...ss, st...ss, s4...ss (e.g. sssubscriberidss -> %%subscriberid%%).
    """
    if not text:
        return text

    tokens_map = {
        "subscriberid": "%%subscriberid%%",
        "memberid": "%%memberid%%",
        "menberid": "%%memberid%%",
        "contactkey": "%%contactkey%%",
        "contaotkey": "%%contactkey%%",
        "emailaddr": "%%emailaddr%%",
        "jobid": "%%jobid%%",
        "listid": "%%listid%%",
        "batchid": "%%batchid%%",
    }
    pattern = re.compile(r"\b(?:ss|sf|st|s4)([a-zA-Z0-9_]+)(?:ss|sf|st|es)\b", re.IGNORECASE)

    def _sub(match):
        inner = match.group(1).lower()
        for key, val in tokens_map.items():
            if key in inner or inner in key:
                return val
        return f"%%{match.group(1)}%%"

    res = pattern.sub(_sub, text)
    for key, val in tokens_map.items():
        if key in res.lower() and "%%" not in res:
            res = re.sub(rf"\b[a-zA-Z0-9_]*{key}[a-zA-Z0-9_]*\b", val, res, flags=re.IGNORECASE)
    return res


def stitch_and_merge_questions(
    batch_questions_list: List[List[ExtractedQuestionItem]],
) -> List[ExtractedQuestionItem]:
    """
    Merges and deduplicates questions across overlapping page batches.
    Handles stitching for questions that span across page boundaries,
    normalizes option labels (2 to 6 options), flags low-confidence items,
    prevents option cross-contamination, repairs OCR tokens, and guarantees
    unique sequential question numbering.
    """
    merged: List[ExtractedQuestionItem] = []

    for batch in batch_questions_list:
        for new_q in batch:
            # 1. Clean question text and repair OCR tokens
            new_q.question_text = fix_ocr_personalization_tokens(new_q.question_text.strip())

            # 2. Normalize option labels and repair token corruptions
            for idx, opt in enumerate(new_q.options):
                opt.label = normalize_option_label(opt.label, idx)
                # Strip leading label redundant text if present (e.g. "A. Content" -> "Content")
                cleaned_text = re.sub(r"^[A-Fa-f0-9ivIV]{1,3}[\.\)\:\-\s]+\s*", "", opt.text.strip())
                opt.text = fix_ocr_personalization_tokens(cleaned_text if cleaned_text else opt.text.strip())

            if new_q.confidence < 0.8:
                new_q.needs_review = True

            matched_idx = -1

            # Match criteria: Two items are the SAME question ONLY if:
            # - They have very high text similarity (sim >= 0.70), OR
            # - One is a clean substring / page-split continuation of the other, OR
            # - They have the SAME explicit question_number AND reasonable text similarity (sim >= 0.40).
            # We NEVER match questions purely on question_number if their text is completely different!
            for idx, existing_q in enumerate(merged):
                sim = text_similarity(new_q.question_text, existing_q.question_text)
                clean_new = re.sub(r"\s+", " ", new_q.question_text.lower()).strip()
                clean_ext = re.sub(r"\s+", " ", existing_q.question_text.lower()).strip()
                is_substring = len(clean_new) >= 20 and len(clean_ext) >= 20 and (clean_new in clean_ext or clean_ext in clean_new)

                if sim >= 0.70 or is_substring:
                    matched_idx = idx
                    break

                if (
                    new_q.question_number is not None
                    and existing_q.question_number is not None
                    and new_q.question_number == existing_q.question_number
                    and sim >= 0.40
                ):
                    matched_idx = idx
                    break

            if matched_idx == -1:
                # No duplicate found, append as new question
                merged.append(new_q)
            else:
                # Merge / stitch truly identical questions (e.g., from overlapping batches or split pages)
                existing_q = merged[matched_idx]

                # Choose more complete question text (stitching split questions)
                if len(new_q.question_text) > len(existing_q.question_text):
                    existing_q.question_text = new_q.question_text

                # If the new question has more options, replace options (since it was more completely captured)
                if len(new_q.options) > len(existing_q.options):
                    existing_q.options = new_q.options

                # Merge correct answers and source
                if not existing_q.correct_options and new_q.correct_options:
                    existing_q.correct_options = new_q.correct_options
                    existing_q.answer_source = new_q.answer_source
                elif existing_q.answer_source == "none" and new_q.answer_source != "none":
                    existing_q.correct_options = new_q.correct_options
                    existing_q.answer_source = new_q.answer_source

                # Preserve explanation, context & figure
                if not existing_q.explanation and new_q.explanation:
                    existing_q.explanation = new_q.explanation
                if not existing_q.shared_passage and new_q.shared_passage:
                    existing_q.shared_passage = new_q.shared_passage
                if not existing_q.context and new_q.context:
                    existing_q.context = new_q.context
                if not existing_q.figure_image_url and new_q.figure_image_url:
                    existing_q.figure_image_url = new_q.figure_image_url

                existing_q.confidence = max(existing_q.confidence, new_q.confidence)
                if new_q.needs_review:
                    existing_q.needs_review = True

    # Ensure all question numbers in merged are unique
    used_numbers = set()
    for q in merged:
        if q.question_number is not None and q.question_number not in used_numbers:
            used_numbers.add(q.question_number)
        else:
            next_num = 1
            while next_num in used_numbers:
                next_num += 1
            q.question_number = next_num
            used_numbers.add(next_num)

    # Sort questions by question number (or original document order)
    merged.sort(key=lambda q: q.question_number if q.question_number is not None else 999999)
    return merged


class ExtractionPipeline:
    """
    Multi-page vision LLM extraction orchestrator with overlapping batches,
    concurrency throttling, deduplication, answer-key reconciliation, token tracking,
    cancellation support, and partial progress persistence.
    """

    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        batch_size: int = 2,
        overlap: int = 0,
        max_concurrency: int = 1,
    ):
        self.provider = provider or get_llm_provider()
        self.batch_size = batch_size
        self.overlap = overlap
        self.semaphore = asyncio.Semaphore(max_concurrency)

    def _generate_page_batches(self, total_pages: int) -> List[List[int]]:
        """Generates list of 1-indexed page batches with overlap."""
        if total_pages <= 0:
            return []
        if total_pages <= self.batch_size:
            return [list(range(1, total_pages + 1))]

        batches: List[List[int]] = []
        start = 1
        step = max(1, self.batch_size - self.overlap)

        while start <= total_pages:
            end = min(start + self.batch_size - 1, total_pages)
            batch = list(range(start, end + 1))
            batches.append(batch)
            if end >= total_pages:
                break
            start += step

        return batches

    async def _process_single_batch(
        self,
        document_id: str,
        page_numbers: List[int],
    ) -> ExtractionBatchResult:
        """Processes a single batch of page images through the vision LLM."""
        doc_dir = get_document_storage_dir(document_id)
        page_images: List[bytes] = []

        for p_num in page_numbers:
            p_path = doc_dir / f"page_{p_num}.png"
            if p_path.exists():
                page_images.append(p_path.read_bytes())
            else:
                logger.warning(f"Page image {p_path} not found for document {document_id}")

        if not page_images:
            return ExtractionBatchResult()

        async with self.semaphore:
            context = {"page_numbers": page_numbers, "document_id": document_id}
            return await self.provider.extract_questions(page_images=page_images, context=context)

    async def run_extraction(
        self,
        document_id: str,
        target_pages: Optional[List[int]] = None
    ) -> List[ExtractedQuestionItem]:
        """
        Executes complete or partial extraction pipeline for a document.
        Saves partial results incrementally and supports cancellation.
        """
        db = SessionLocal()
        try:
            doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
            if not doc:
                raise ValueError(f"Document {document_id} not found.")

            if doc.is_cancelled:
                logger.info(f"Document {document_id} extraction cancelled before starting.")
                return []

            total_pages = doc.page_count
            if target_pages:
                # Custom page batches for retry
                batches = [target_pages[i:i + self.batch_size] for i in range(0, len(target_pages), self.batch_size)]
            else:
                batches = self._generate_page_batches(total_pages)

            logger.info(f"Starting extraction for document {document_id} across {len(batches)} batches.")

            batch_results: List[ExtractionBatchResult] = []
            for batch_idx, batch in enumerate(batches):
                # Check cancellation between batches
                db.refresh(doc)
                if doc.is_cancelled:
                    logger.info(f"Extraction for document {document_id} cancelled by user during batch {batch_idx + 1}.")
                    break

                batch_res = await self._process_single_batch(document_id, batch)
                batch_results.append(batch_res)

                # Persist batch questions incrementally
                if batch_res.questions:
                    for item in batch_res.questions:
                        existing = None
                        if item.question_number is not None:
                            existing = db.query(QuestionDB).filter(
                                QuestionDB.document_id == document_id,
                                QuestionDB.number == item.question_number
                            ).first()
                        if not existing:
                            current_total = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).count()
                            db_q = QuestionDB(
                                document_id=document_id,
                                number=item.question_number or (current_total + 1),
                                text=item.question_text,
                                options=[opt.model_dump() for opt in item.options],
                                correct_options=item.correct_options,
                                answer_source=item.answer_source,
                                confidence=item.confidence,
                                source_page=item.source_page or (batch[0] if batch else 1),
                                explanation=item.explanation,
                                needs_review=item.needs_review,
                            )
                            db.add(db_q)
                    db.commit()

                # Update progress in real-time
                max_page_in_batch = max(batch) if batch else 0
                doc.pages_processed = min(doc.page_count, max(doc.pages_processed, max_page_in_batch))
                db.commit()

            # Check if cancelled mid-run
            if doc.is_cancelled:
                return []

            # Aggregate token usage & costs
            total_prompt_tokens = sum(r.prompt_tokens for r in batch_results)
            total_completion_tokens = sum(r.completion_tokens for r in batch_results)
            total_cost = sum(r.estimated_cost_usd for r in batch_results)

            logger.info(
                f"Document {document_id} extraction token usage: "
                f"{total_prompt_tokens} in / {total_completion_tokens} out (Total: {total_prompt_tokens + total_completion_tokens}), "
                f"Estimated Cost: ${total_cost:.5f}"
            )

            # Extract list of questions from each batch
            all_batches_questions = [r.questions for r in batch_results]

            # Merge and deduplicate
            merged_questions = stitch_and_merge_questions(all_batches_questions)

            # Final Pass: Check for Answer Key in any detected sections
            answer_key_mappings: Dict[int, List[str]] = {}
            for r in batch_results:
                if r.detected_answer_key_section:
                    parsed_mappings = parse_inline_answer_key(r.detected_answer_key_section)
                    answer_key_mappings.update(parsed_mappings)

            # If document has raw text (e.g. pasted text or docx), scan it for answer key as well
            if doc.extracted_text:
                text_key_mappings = parse_inline_answer_key(doc.extracted_text)
                answer_key_mappings.update(text_key_mappings)

            # Also scan candidate answer-key pages (first 2 and last 2 pages) directly
            try:
                from services.ocr_service import ocr_image
                from services.ingestion import get_or_extract_page_text
                doc_dir = get_document_storage_dir(document_id)
                candidate_pages = set()
                if total_pages >= 1:
                    candidate_pages.update([1, 2, max(1, total_pages - 1), total_pages])
                for p_num in sorted(candidate_pages):
                    page_text = ""
                    # 1. Native digital text first (from PDF stream or on-demand cache)
                    if doc_dir:
                        page_text = get_or_extract_page_text(doc_dir, p_num)

                    # 2. OCR fallback for scans
                    if not page_text:
                        p_img = doc_dir / f"page_{p_num}.png"
                        if p_img.exists():
                            page_text = ocr_image(p_img)

                    if page_text and "answer" in page_text.lower():
                        page_mappings = parse_inline_answer_key(page_text)
                        if len(page_mappings) >= 3:
                            logger.info(f"Detected {len(page_mappings)} answer key entries on page {p_num}")
                            answer_key_mappings.update(page_mappings)
            except Exception as e:
                logger.warning(f"Error scanning candidate pages for answer key: {e}")

            # Apply Answer Key mappings to questions lacking answers or marked in key
            if answer_key_mappings:
                logger.info(f"Applying answer key mappings to document {document_id}: {answer_key_mappings}")
                for q in merged_questions:
                    if q.question_number in answer_key_mappings:
                        if not q.correct_options or q.answer_source in ("none", "answer_key_in_document"):
                            q.correct_options = answer_key_mappings[q.question_number]
                            q.answer_source = AnswerSource.ANSWER_KEY_IN_DOCUMENT.value

            # Persist finalized merged questions in database
            if merged_questions:
                db.query(QuestionDB).filter(QuestionDB.document_id == document_id).delete()

                db_questions: List[QuestionDB] = []
                for idx, item in enumerate(merged_questions):
                    context_val = item.context or item.shared_passage
                    figure_val = item.figure_image_url
                    if not figure_val and item.has_figure and item.source_page:
                        figure_val = f"/api/documents/{document_id}/pages/{item.source_page}"

                    db_q = QuestionDB(
                        document_id=document_id,
                        number=item.question_number or (idx + 1),
                        text=item.question_text,
                        options=[opt.model_dump() for opt in item.options],
                        correct_options=item.correct_options,
                        answer_source=item.answer_source,
                        confidence=item.confidence,
                        source_page=item.source_page,
                        explanation=item.explanation,
                        context=context_val,
                        figure_image_url=figure_val,
                        needs_review=item.needs_review,
                    )
                    db_questions.append(db_q)

                db.add_all(db_questions)

            doc.status = DocumentStatus.EXTRACTED.value
            doc.pages_processed = doc.page_count
            db.commit()

            return merged_questions

        except Exception as e:
            logger.error(f"Extraction pipeline failed for document {document_id}: {e}", exc_info=True)
            doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
            if doc and not doc.is_cancelled:
                q_count = db.query(QuestionDB).filter(QuestionDB.document_id == document_id).count()
                if q_count > 0:
                    doc.status = DocumentStatus.EXTRACTED.value
                    doc.error_message = f"Partially extracted {q_count} questions. ({str(e)})"
                else:
                    doc.status = DocumentStatus.FAILED.value
                    doc.error_message = f"AI extraction error: {str(e)}"
                db.commit()
            raise
        finally:
            db.close()


async def suggest_answers_for_document(
    document_id: str,
    provider: Optional[BaseLLMProvider] = None,
) -> List[QuestionDB]:
    """
    Generates AI-suggested answers and explanations for questions in a document.
    Only called when explicitly triggered by the user.
    """
    llm = provider or get_llm_provider()
    db = SessionLocal()

    try:
        doc = db.query(DocumentDB).filter(DocumentDB.id == document_id).first()
        if not doc:
            raise ValueError(f"Document {document_id} not found.")

        questions = (
            db.query(QuestionDB)
            .filter(QuestionDB.document_id == document_id)
            .order_by(QuestionDB.number)
            .all()
        )

        if not questions:
            raise ValueError("No questions found to suggest answers for.")

        # Prepare payload for AI solver
        questions_payload = []
        for q in questions:
            questions_payload.append({
                "question_id": q.id,
                "question_number": q.number,
                "question_text": q.text,
                "options": q.options,
            })

        suggestion_result = await llm.suggest_answers(questions_payload)

        # Map suggestions back to DB questions
        sugg_map = {s.question_id: s for s in suggestion_result.suggestions}
        for q in questions:
            sugg = sugg_map.get(q.id)
            if sugg and sugg.correct_options:
                q.correct_options = sugg.correct_options
                q.answer_source = AnswerSource.AI_SUGGESTED.value
                q.explanation = sugg.explanation or "AI-generated explanation."

        db.commit()
        for q in questions:
            db.refresh(q)

        logger.info(
            f"AI suggested answers for document {document_id}: "
            f"{suggestion_result.total_tokens} tokens (Cost: ${suggestion_result.estimated_cost_usd:.5f})"
        )
        return questions

    finally:
        db.close()
