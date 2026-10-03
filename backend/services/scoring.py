from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from models.enums import AnswerSource
from models.schemas import QuestionOption, QuestionResult


def evaluate_question(
    selected_options: List[str],
    correct_options: List[str],
    answer_source: str,
    negative_marking: float = 0.0,
    partial_credit: bool = False,
) -> Tuple[bool, bool, bool, float]:
    """
    Evaluates a single question answer.

    Returns:
        (is_correct, is_graded, is_partial, score_earned)
    """
    # Questions without an answer key are excluded from scoring / labeled Not Graded
    if not correct_options or answer_source == AnswerSource.NONE.value or answer_source == "none":
        return (False, False, False, 0.0)

    sel_set = set(selected_options or [])
    cor_set = set(correct_options or [])

    # Unattempted / unanswered questions earn 0 points (no negative penalty)
    if not sel_set:
        return (False, True, False, 0.0)

    # Multi-answer question with partial credit enabled
    if len(cor_set) > 1 and partial_credit:
        if sel_set == cor_set:
            return (True, True, False, 1.0)
        
        correct_picks = len(sel_set & cor_set)
        wrong_picks = len(sel_set - cor_set)
        net_ratio = (correct_picks - wrong_picks) / len(cor_set)

        if net_ratio > 0.0:
            return (False, True, True, round(net_ratio, 3))
        else:
            return (False, True, False, -abs(negative_marking))

    # Standard evaluation (single-choice or strict multi-choice match required)
    if sel_set == cor_set:
        return (True, True, False, 1.0)
    else:
        return (False, True, False, -abs(negative_marking))


def grade_session_answers(
    questions_map: Dict[str, Any],
    answers_map: Dict[str, Any],
    question_order: List[str],
    negative_marking: float = 0.0,
    partial_credit: bool = False,
    target_score_percentage: Optional[float] = None,
    started_at: Optional[datetime] = None,
    submitted_at: Optional[datetime] = None,
) -> Tuple[List[QuestionResult], Dict[str, Any]]:
    """
    Grading engine for full test sessions.
    """
    results: List[QuestionResult] = []
    correct_count = 0
    wrong_count = 0
    unanswered_count = 0
    ungraded_count = 0
    attempted_count = 0
    total_raw_score = 0.0
    total_time_spent = 0

    for q_id in question_order:
        q = questions_map.get(q_id)
        if not q:
            continue

        ans = answers_map.get(q_id)
        selected = ans.selected_options if ans else []
        flagged = bool(ans.flagged) if ans else False
        time_spent = ans.time_spent_seconds if ans else 0
        total_time_spent += time_spent

        is_attempted = len(selected) > 0
        if is_attempted:
            attempted_count += 1

        correct_options = q.correct_options if isinstance(q.correct_options, list) else []
        ans_source = q.answer_source if hasattr(q, "answer_source") else "none"

        is_correct, is_graded, is_partial, score_earned = evaluate_question(
            selected_options=selected,
            correct_options=correct_options,
            answer_source=ans_source,
            negative_marking=negative_marking,
            partial_credit=partial_credit,
        )

        if not is_graded:
            ungraded_count += 1
        else:
            total_raw_score += score_earned
            if is_correct:
                correct_count += 1
            elif not is_attempted:
                unanswered_count += 1
            elif not is_partial:
                wrong_count += 1

        # Format options
        opts = [
            QuestionOption(label=opt["label"], text=opt["text"])
            for opt in (q.options if isinstance(q.options, list) else [])
        ]

        results.append(
            QuestionResult(
                question_id=q.id,
                number=q.number,
                text=q.text,
                options=opts,
                selected_options=selected,
                correct_options=correct_options,
                is_correct=is_correct,
                is_graded=is_graded,
                is_partial=is_partial,
                score_earned=score_earned,
                answer_source=AnswerSource(ans_source) if ans_source in [e.value for e in AnswerSource] else AnswerSource.NONE,
                explanation=q.explanation,
                time_spent_seconds=time_spent,
                flagged=flagged,
            )
        )

    total_questions = len(question_order)
    total_graded = total_questions - ungraded_count

    # Normalized score calculation
    score_earned_clean = max(0.0, round(total_raw_score, 2))
    if total_graded > 0:
        score_percentage = max(0.0, min(100.0, round((score_earned_clean / total_graded) * 100, 2)))
    else:
        score_percentage = 0.0

    passed = (score_percentage >= target_score_percentage) if target_score_percentage is not None else None

    time_taken = (
        int((submitted_at - started_at).total_seconds())
        if submitted_at and started_at
        else total_time_spent
    )
    time_taken = max(time_taken, 0)
    avg_time = round(time_taken / total_questions, 1) if total_questions > 0 else 0.0

    stats: Dict[str, Any] = {
        "total_questions": total_questions,
        "total_graded": total_graded,
        "attempted_count": attempted_count,
        "correct_count": correct_count,
        "wrong_count": wrong_count,
        "unanswered_count": unanswered_count,
        "ungraded_count": ungraded_count,
        "score_earned": score_earned_clean,
        "score_percentage": score_percentage,
        "target_score_percentage": target_score_percentage,
        "passed": passed,
        "time_taken_seconds": time_taken,
        "avg_time_per_question_seconds": avg_time,
        "partial_credit": partial_credit,
        "negative_marking": negative_marking,
    }

    return results, stats
