@echo off
echo Starting DOCTEST application...

echo Starting Backend API on http://127.0.0.1:8000 ...
start "DOCTEST Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend on http://localhost:5173 ...
start "DOCTEST Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo DOCTEST is launching:
echo - Frontend: http://localhost:5173
echo - Backend:  http://127.0.0.1:8000
echo.

