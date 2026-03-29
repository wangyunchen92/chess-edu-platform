"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.middleware.logging_middleware import LoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import router as api_router
from app.schemas.common import APIResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("chess_edu")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    logger.info("Starting Chess Education Platform API (%s)", settings.APP_ENV)
    # Import all models so Base.metadata knows about them, then create tables
    import app.models  # noqa: F401
    init_db()
    logger.info("Database tables created / verified")

    # Import content data from JSON files if DB is empty
    from app.database import SessionLocal
    from scripts.import_content import import_all
    db = SessionLocal()
    try:
        results = import_all(db)
        db.commit()
        if any(v > 0 for v in results.values()):
            logger.info("Content import results: %s", results)
        else:
            logger.info("Content already imported, no new data.")
    except Exception:
        db.rollback()
        logger.exception("Content import failed")
    finally:
        db.close()

    yield
    # Shutdown
    logger.info("Shutting down Chess Education Platform API")


app = FastAPI(
    title="Chess Education Platform API",
    description="Online chess education platform backend API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_DEBUG else None,
    redoc_url="/redoc" if settings.APP_DEBUG else None,
)


# ── Global Exception Handlers ─────────────────────────────────────


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTPException and return unified APIResponse format."""
    return JSONResponse(
        status_code=exc.status_code,
        content=APIResponse.error(
            code=exc.status_code,
            message=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
        ).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors and return unified APIResponse format."""
    errors = exc.errors()
    # Build a human-readable summary of validation errors
    details = "; ".join(
        f"{'.'.join(str(loc) for loc in e.get('loc', []))}: {e.get('msg', '')}"
        for e in errors
    )
    return JSONResponse(
        status_code=422,
        content=APIResponse.error(
            code=422,
            message=f"Validation error: {details}",
            data=errors,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle all unhandled exceptions and return unified APIResponse format."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    message = "Internal server error"
    if settings.APP_DEBUG:
        message = f"Internal server error: {type(exc).__name__}: {exc}"
    return JSONResponse(
        status_code=500,
        content=APIResponse.error(code=500, message=message).model_dump(),
    )


# ── Middleware ─────────────────────────────────────────────────────

# Request logging middleware (added first so it wraps everything)
app.add_middleware(LoggingMiddleware)

# Rate limiting middleware (100 req/min general, 10 req/min for auth)
app.add_middleware(RateLimitMiddleware, default_rpm=100, auth_rpm=10)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────

# Mount API routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "env": settings.APP_ENV}
