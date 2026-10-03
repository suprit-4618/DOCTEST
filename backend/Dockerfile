# Production Dockerfile for MCQ Self-Test Backend with LibreOffice support
FROM python:3.11-slim

# Install system dependencies: headless LibreOffice for DOCX conversion & fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-nogui \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Ensure storage directory exists
RUN mkdir -p /app/storage

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
