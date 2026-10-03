from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.documents import router as documents_router
from app.api.questions import router as questions_router
from app.api.sessions import router as sessions_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every HTTP response."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for MCQ Self-Test application.",
    lifespan=lifespan
)

# Set up Security Headers Middleware
app.add_middleware(SecurityHeadersMiddleware)

# Set up CORS strictly configured to allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(documents_router, prefix=settings.API_V1_PREFIX)
app.include_router(questions_router, prefix=settings.API_V1_PREFIX)
app.include_router(sessions_router, prefix=settings.API_V1_PREFIX)


# --- Optional Password / Auth Verification for Public Hosting ---

class AuthVerifyRequest(BaseModel):
    password: str


@app.get("/api/auth/status", tags=["Auth"])
async def get_auth_status():
    """Returns whether password protection is enabled on this instance."""
    return {
        "is_protected": bool(settings.APP_PASSWORD and settings.APP_PASSWORD.strip()),
    }


@app.post("/api/auth/verify", tags=["Auth"])
async def verify_auth_password(payload: AuthVerifyRequest):
    """Verifies access password if protected."""
    if not settings.APP_PASSWORD:
        return {"authenticated": True, "message": "No password configured"}
    if payload.password == settings.APP_PASSWORD:
        return {"authenticated": True, "token": "authenticated"}
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid access password"
    )


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint to verify backend service availability."""
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to MCQ Self-Test API. Health check available at /api/health",
        "docs": "/docs"
    }
