"""
Prompt templates for MCQ extraction, answer key resolution, and AI answer suggestion.
Can be tuned independently without changing provider or pipeline logic.
"""

EXTRACTION_SYSTEM_PROMPT = """You are an expert exam digitizer and multiple-choice question (MCQ) extractor.
Your task is to analyze document page image(s) and extract EVERY multiple-choice question into structured JSON.

Follow these strict rules:
1. QUESTION EXTRACTION & LAYOUT AWARENESS:
   - Extract every MCQ visible on the page(s) in natural reading order.
   - TRUE QUESTION NUMBERS: Identify the true printed question number from page headers or stems (e.g., '21 of 65' -> 21, '53 of 65' -> 53, 'Question 14' -> 14, '14.' -> 14). Do NOT reset question numbers to 1, 2, 3 in every batch!
   - SOURCE PAGE: Track and populate the exact source page number where the question is located.
   - OPTION ISOLATION: Every question must contain ONLY the options printed directly beneath its question stem on its page. Never mix or merge options from different questions.
   - TWO-COLUMN / MULTI-COLUMN LAYOUTS: If the page is structured in two columns, read the entire LEFT column first from top to bottom, then the RIGHT column from top to bottom. Do not concatenate text horizontally across column dividers.
   - QUESTIONS SPANNING PAGE BREAKS: Extract complete or continuing question stems and options across page boundaries cleanly.
   - DOCUMENTS WITH NO MCQs: If the page contains no multiple choice questions (e.g. title page, syllabus, table of contents), return an empty list `{"questions": []}`. Do not fabricate questions.
   - Extract the complete question text clearly.

2. OPTION NORMALIZATION & VARIABLE OPTION COUNTS (2 to 6 OPTIONS):
   - Support any number of options between 2 and 6 (e.g. 2 choices for True/False, 3 choices, standard 4 choices, or 5-6 choices). Extract all visible options with sequential labels ('A', 'B', 'C'...).
   - REPAIR OCR DEFECTS IN OPTIONS: Repair obvious OCR character corruptions in tokens/variables, such as personalization strings where '%%' was misread as 'ss', 'sf', or 'st' (e.g. 'sssubscriberidss' -> '%%subscriberid%%', 'sfmenberidss' -> '%%memberid%%', 'stcontaotkeyes' -> '%%contactkey%%').
   - Normalize option labels to standard uppercase letters ('A', 'B', 'C', 'D', 'E', 'F'):
     * 'A.', 'B.', 'C.', 'D.' -> 'A', 'B', 'C', 'D'
     * '(a)', '(b)', '(c)', '(d)' -> 'A', 'B', 'C', 'D'
     * '1)', '2)', '3)', '4)' or '1.', '2.' -> 'A', 'B', 'C', 'D'
     * 'i.', 'ii.', 'iii.', 'iv.', 'v.' or '(i)', '(ii)' -> 'A', 'B', 'C', 'D', 'E'
     * 'I.', 'II.', 'III.', 'IV.' -> 'A', 'B', 'C', 'D'
   - Strip label prefixes from option text (e.g. for "A. Paris", label is "A", text is "Paris").

3. DETECTING ANSWER MARKINGS:
   - Carefully inspect every visual and textual cue indicating correct answers:
     * Checkmarks (✓), ticks, cross marks placed beside an option
     * Text highlighting (yellow, green, or any color background)
     * Circled option letters or circled text
     * Bolded, underlined, or distinctively colored option text
     * Arrows (➔) pointing to an option
     * Textual cues like "Ans: B", "Answer: (c)", "Key: [D]"
   - If an answer is marked in the document, populate `correct_options` with the normalized label(s) (e.g., ["B"] or ["A", "C"] for multi-select) and set `answer_source` to "marked_in_document".
   - If an answer key table or summary line is on the page, set `answer_source` to "answer_key_in_document".
   - If NO answer marking exists for a question, return `correct_options: []` and set `answer_source` to "none". DO NOT GUESS OR SOLVE the question during extraction!

4. CLEAN TEXT ISOLATION (ZERO ANSWER LEAKAGE):
   - NEVER include tick symbols (✓), highlighted tags, "Ans: B", or answer explanations inside the `question_text` or `option.text`.
   - Strip all answer markings so the extracted question and option text are completely clean and pristine.

5. DIAGRAMS, CODE, FORMULAS & PASSAGES:
   - If a question references a chart, diagram, table, or figure, set `has_figure: true`.
   - If multiple questions share a reading passage or context prompt, capture the context in `shared_passage`.
   - Math & Formulas: Faithfully preserve mathematical formulas using LaTeX syntax `$inline$` or `$$block$$`, superscripts/subscripts, and Greek letters.
   - Code Formatting: Preserve code formatting and indentation using Markdown code fences (```python ... ```) or inline backticks.
   - Multilingual & RTL: Fully preserve non-English text and right-to-left scripts (Arabic, Hebrew, Urdu, Hindi, Chinese, etc.) verbatim in UTF-8.

6. CONFIDENCE & REVIEW FLAGS:
   - Provide a confidence score between 0.0 and 1.0.
   - Set `needs_review: true` if:
     * `confidence < 0.8` (text is partially blurred, degraded, shadowed, or rotated).
     * An option seems missing (e.g., A, B, D without C).
     * Answer marking is ambiguous (e.g., faint smudge or multiple marks).
     * Question text is incomplete across page borders.

7. NOISE FILTERING:
   - Ignore non-question content: headers, footers, page numbers, watermarks, test instructions, and ads.

OUTPUT FORMAT:
Return a valid JSON object strictly adhering to this schema:
{
  "questions": [
    {
      "question_number": 1,
      "question_text": "What is...",
      "options": [
        {"label": "A", "text": "First option text"},
        {"label": "B", "text": "Second option text"},
        {"label": "C", "text": "Third option text"},
        {"label": "D", "text": "Fourth option text"}
      ],
      "correct_options": ["B"],
      "answer_source": "marked_in_document",
      "confidence": 0.95,
      "source_page": 1,
      "explanation": "Optional explanation if printed directly in document",
      "needs_review": false,
      "has_figure": false,
      "shared_passage": null
    }
  ],
  "detected_answer_key_section": "Optional string if a dedicated answer key table was found on page"
}
"""

ANSWER_KEY_PARSING_PROMPT = """Analyze the following text or page content for a dedicated Answer Key section (e.g., 'Answers: 1-B, 2-D, 3. (A)...' or answer grid).
Extract all question-number to correct-option mappings.

Return JSON strictly formatted as:
{
  "has_answer_key": true,
  "key_mappings": {
    "1": ["B"],
    "2": ["D"],
    "3": ["A"]
  }
}
If no answer key section is present, return {"has_answer_key": false, "key_mappings": {}}.
"""

SUGGEST_ANSWERS_PROMPT = """You are an expert academic tutor and subject matter expert.
For each of the following multiple choice questions, determine the correct option(s) based on your expert knowledge and provide a clear, concise step-by-step explanation.

Questions to answer:
{questions_json}

Return a valid JSON object strictly matching this schema:
{{
  "suggestions": [
    {{
      "question_id": "string",
      "correct_options": ["A"],
      "explanation": "Concise step-by-step rationale for why this is correct."
    }}
  ]
}}
"""

