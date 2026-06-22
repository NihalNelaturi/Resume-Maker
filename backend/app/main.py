import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import init_db
from app.routes.resume_routes import router as resume_router
from app.services.latex_compiler import LatexCompiler


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def _cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "*")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["*"]


def create_app() -> FastAPI:
    app = FastAPI(
        title="Resume Command Center API",
        version="0.2.0",
        description="Generate, analyze, rewrite, and export ATS-friendly resumes from structured data.",
        lifespan=lifespan,
    )

    origins = _cors_origins()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials="*" not in origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["health"])
    def health_check() -> dict[str, object]:
        compiler = LatexCompiler().available_compiler()
        return {"status": "ok", "latex": bool(compiler), "latex_compiler": compiler}

    app.include_router(resume_router)
    return app


app = create_app()
