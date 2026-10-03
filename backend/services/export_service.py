import io
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)

from models.db import DocumentDB, QuestionDB
from models.enums import AnswerSource, DocumentStatus, FileType


def generate_printable_exam_pdf(
    document: DocumentDB,
    questions: List[QuestionDB],
    include_answer_key: bool = False
) -> bytes:
    """
    Generates a clean, professional, printable exam paper.
    - Test body contains strictly NO answers or markings.
    - If include_answer_key is True, appends a dedicated Answer Key & Solutions page.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'ExamTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
        alignment=1  # Centered
    )
    
    subtitle_style = ParagraphStyle(
        'ExamSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
        spaceAfter=12
    )

    info_box_style = ParagraphStyle(
        'ExamInfo',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    question_title_style = ParagraphStyle(
        'QuestionTitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4
    )

    option_style = ParagraphStyle(
        'OptionText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b")
    )

    key_heading_style = ParagraphStyle(
        'KeyHeading',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#4338ca"),
        spaceAfter=6,
        alignment=1
    )

    key_text_style = ParagraphStyle(
        'KeyText',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b")
    )

    story = []

    # 1. Header & Student Info Box
    story.append(Paragraph(f"<b>{document.filename}</b>", title_style))
    story.append(Paragraph(f"Multiple Choice Exam &bull; Total Questions: {len(questions)}", subtitle_style))

    info_data = [
        [
            Paragraph("<b>Name:</b> ___________________________", info_box_style),
            Paragraph("<b>Date:</b> ______________", info_box_style),
            Paragraph("<b>Score:</b> _____ / " + str(len(questions)), info_box_style),
        ]
    ]
    info_table = Table(info_data, colWidths=[240, 150, 140])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))

    # Instructions
    story.append(Paragraph(
        "<i>Instructions: Read each question carefully and fill in the circle/box for the correct answer. "
        "Questions may contain single or multiple correct choices.</i>",
        ParagraphStyle('Instructions', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor("#475569"))
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceBefore=8, spaceAfter=14))

    # 2. Questions List (Strictly NO answers)
    for idx, q in enumerate(questions):
        q_elements = []
        q_num = q.number or (idx + 1)
        q_elements.append(Paragraph(f"<b>Q{q_num}.</b> {q.text}", question_title_style))

        # Format Options in 2 columns if 4 options, or 1 column
        raw_options = q.options if isinstance(q.options, list) else []
        options_rows = []
        
        for opt in raw_options:
            label = opt.get("label", "")
            text = opt.get("text", "")
            opt_p = Paragraph(f"<b>[ &nbsp; ] {label}.</b> {text}", option_style)
            options_rows.append([opt_p])

        if options_rows:
            opt_table = Table(options_rows, colWidths=[530])
            opt_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('PADDING', (0, 0), (-1, -1), 3),
            ]))
            q_elements.append(opt_table)

        q_elements.append(Spacer(1, 10))
        story.append(KeepTogether(q_elements))

    # 3. Optional Answer Key Page
    if include_answer_key:
        story.append(PageBreak())
        story.append(Paragraph("<b>ANSWER KEY &amp; EXPLANATIONS</b>", key_heading_style))
        story.append(Paragraph(f"Reference Document: {document.filename}", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#c7d2fe"), spaceBefore=4, spaceAfter=14))

        key_table_data = [
            [
                Paragraph("<b>Q#</b>", key_text_style),
                Paragraph("<b>Correct Option(s)</b>", key_text_style),
                Paragraph("<b>Source / Explanation</b>", key_text_style),
            ]
        ]

        for idx, q in enumerate(questions):
            q_num = q.number or (idx + 1)
            correct_str = ", ".join(q.correct_options) if q.correct_options else "No answer key"
            
            src_text = f"[{q.answer_source}]" if q.answer_source else ""
            if q.explanation:
                explanation_str = f"{src_text} {q.explanation}"
            else:
                explanation_str = src_text or "-"

            key_table_data.append([
                Paragraph(f"<b>Q{q_num}</b>", key_text_style),
                Paragraph(f"<b>{correct_str}</b>", key_text_style),
                Paragraph(explanation_str, key_text_style),
            ])

        key_table = Table(key_table_data, colWidths=[40, 110, 380])
        key_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(key_table)

    doc.build(story)
    return buffer.getvalue()


def export_document_to_json(document: DocumentDB, questions: List[QuestionDB]) -> Dict[str, Any]:
    """
    Serializes a document and its cleaned question set to standard export JSON format.
    """
    return {
        "version": "1.0",
        "app": "MCQ Self-Test",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "document": {
            "title": document.filename,
            "file_type": document.file_type,
            "question_count": len(questions)
        },
        "questions": [
            {
                "number": q.number,
                "text": q.text,
                "options": q.options,
                "correct_options": q.correct_options or [],
                "answer_source": q.answer_source or AnswerSource.NONE.value,
                "explanation": q.explanation,
                "source_page": q.source_page
            }
            for q in questions
        ]
    }
