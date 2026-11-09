# DOCTEST One-Click Runner for Windows PowerShell
Write-Host "Starting DOCTEST application..." -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\frontend'; npm run dev"

Write-Host "Both servers launched in dedicated windows:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Backend:  http://127.0.0.1:8000" -ForegroundColor Yellow

