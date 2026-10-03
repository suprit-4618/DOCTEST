# DOCTEST — Document to Interactive Exam Engine 📝

An open-source, full-stack application that transforms any document (PDF, photos/scans, DOCX, pasted text) into a clean, interactive multiple-choice test. The system extracts questions, strips all printed answer markings (ticks, highlights, circled letters, answer keys), and presents a distraction-free exam simulator with server-side grading and zero answer leakage.

---

## Key Features

1. **Multi-Format Ingestion**:
   - **PDF**: High-resolution rendering at 150 DPI via PyMuPDF.
   - **Images & Photos**: Automatic EXIF orientation correction, auto-contrast for shadows/scans, and sharpening (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`).
   - **DOCX**: High-fidelity conversion using headless LibreOffice or direct structure extraction.
   - **Pasted Text**: Immediate plain-text question extraction.
   - **JSON Question Sets**: 1-click import/export of structured exam banks.

2. **AI Vision & LLM Providers**:
   - **Groq**: Ultra-fast inference with `openai/gpt-oss-120b` or Llama 3 models.
   - **Google Gemini**: Vision & multimodal extraction (`gemini-1.5-flash`).
   - **OpenAI**: GPT-4o-mini multimodal extraction.

3. **Intelligent Question Extraction**:
   - Multi-page vision analysis with overlapping batches to prevent boundary cuts.
   - Intelligent cross-page question stitching and semantic deduplication.
   - Option label normalizer supporting diverse styles (`A.`, `(a)`, `1)`, `i.`, `Roman numerals`).
   - Variable option counts: seamless support for 2 to 6 options (True/False to 6 choices).
   - Reading passages & diagram extraction (`context` and `figure_image_url`).
   - Full KaTeX formula rendering (`$x^2$` and `$$\int f(x)dx$$`) and syntax-highlighted code blocks.
   - Multilingual support with `dir="auto"` RTL text alignment.

4. **Pre-Exam Review & Editing**:
   - Inline question and option editor (add/remove options, toggle single/multi answers).
   - One-click bulk answer key tool (`1-B, 2-D, 3-A...`).
   - AI Answer Suggestion with step-by-step explanations on demand.
   - Side-by-side original source page image preview.

5. **Realistic Test-Taking Experience**:
   - **Exam Mode**: Zero feedback during testing; full graded report upon submission.
   - **Practice Mode**: Instant question-by-question verification and AI explanations.
   - Question palette with status indicators (answered, unanswered, flagged).
   - Configurable countdown timer with warnings and auto-submission at zero.
   - Negative marking, question/option shuffling, and partial credit options.
   - Full keyboard navigation (`A`/`B`/`C`/`D` to select, Arrow keys to navigate, `F` to flag).

6. **Graded Analytics & Retention**:
   - Score breakdown, accuracy percentage, time per question, and pass/fail indicators.
   - Question review cards filterable by All, Wrong, Unanswered, and Flagged.
   - **Library**: Document repository with attempt history, score-over-time trend chart, and weak area tracking.
   - **Targeted Practice**: Retake only questions answered incorrectly across past attempts.
   - **Printable PDF Export**: Export clean printable blank test papers (PDF) with optional separate answer keys, or structured JSON.

7. **Zero Answer Leakage Security**:
   - Correct answers, sources, and explanations are strictly omitted from test-taking payloads.
   - Filename sanitization preventing path traversal attacks.
   - File size (25MB) enforcement with magic byte validation.

---

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, Pydantic v2, SQLite via SQLAlchemy, PyMuPDF (fitz), ReportLab, Pillow, python-docx.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, KaTeX.
- **AI Providers**: Groq, Google Gemini, OpenAI.

---

## Quickstart

### Option A: One-Command Docker Compose (Recommended)

Start the entire application (backend, frontend, LibreOffice) with a single command:

```bash
# 1. Clone the repository and configure your .env
cp .env.example .env

# 2. Add your Gemini API key in .env
# GEMINI_API_KEY=your_key_here

# 3. Launch with Docker Compose
docker-compose up --build
```

- **Frontend Application**: `http://localhost:5173` (or `http://localhost`)
- **Backend API Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/health`

---

### Option B: Local Development Setup

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server with auto-reload
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup

```bash
cd frontend

# Install Node modules
npm install

# Start Vite dev server
npm run dev
```

Visit `http://localhost:5173` to access the application.

---

## Environment Variables Configuration

Copy `.env.example` to `.env` in the project root:

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_LLM_PROVIDER` | `gemini` | Primary AI provider (`gemini` or `openai`) |
| `GEMINI_API_KEY` | `""` | Google Gemini API Key |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
| `OPENAI_API_KEY` | `""` | OpenAI API Key (if using OpenAI) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |
| `DATABASE_URL` | `sqlite:///./mcq_selftest.db` | Database connection URL |
| `STORAGE_DIR` | `./storage` | Directory for rendered page images |
| `MAX_FILE_SIZE_BYTES` | `26214400` | Max upload size (25 MB) |
| `MAX_PAGE_COUNT` | `150` | Maximum pages allowed per document |
| `PDF_RENDER_DPI` | `150` | DPI for rendering PDF pages |
| `IMAGE_MAX_DIMENSION` | `2000` | Max width/height when normalizing photos |
| `APP_PASSWORD` | `""` | Optional access password for public deployments |

---

## How to Switch or Add AI Providers

The application uses an extensible provider interface (`backend/providers/base.py`).

1. **Switch between Gemini and OpenAI**:
   Set `DEFAULT_LLM_PROVIDER=openai` in your `.env` and provide your `OPENAI_API_KEY`.
2. **Add a Custom Provider (e.g., Anthropic Claude or Local Ollama)**:
   - Create `backend/providers/custom_provider.py` inheriting from `BaseLLMProvider`.
   - Implement `extract_questions(page_images, context)` and `suggest_answers(questions)`.
   - Register the new provider class in `backend/providers/factory.py`.

---

## Frontend Build Validation

```bash
cd frontend
npm run build
```

---

## Privacy & Security Note

> **Privacy Notice**: When you upload a document for extraction, its rendered page images are sent via secure HTTPS to the configured AI provider (Google Gemini or OpenAI) to extract question stems and identify answer markings. The API keys are securely stored on the server side and are never exposed to the frontend client. Document images and SQLite database records remain stored on your local server.

---

## Known Limitations

- **Scanned Handwriting**: Highly degraded or cursive handwritten annotations may require manual verification on the Review screen.
- **LibreOffice DOCX Support**: Headless LibreOffice is required on the host system (included by default in the Docker container) to preserve highlight annotations in Word documents; otherwise, the system falls back to text extraction.
