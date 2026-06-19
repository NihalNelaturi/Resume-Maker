from __future__ import annotations

import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import ResumeDraft
from app.models.command_center_models import (
    AnalyzeJobDescriptionRequest,
    AnalyzeJobDescriptionResponse,
    AnalyzeResumeRequest,
    AnalyzeResumeResponse,
    RenderTexResponse,
    RewriteBulletsRequest,
    RewriteBulletsResponse,
)
from app.models.resume_models import DeleteResumeResponse, Resume, ResumeRecordResponse, ResumeSaveRequest
from app.services.bullet_rewriter import BulletRewriteEngine
from app.services.job_description_analyzer import JobDescriptionAnalyzer
from app.services.latex_compiler import LaTeXCompilationFailed, LaTeXCompilerError, LaTeXCompilerNotFound
from app.services.resume_analyzer import ResumeAnalyzer
from app.services.resume_builder import ResumeBuilder

router = APIRouter(prefix="/api/resume", tags=["resume"])
resume_builder = ResumeBuilder()
resume_analyzer = ResumeAnalyzer()
job_description_analyzer = JobDescriptionAnalyzer()
bullet_rewriter = BulletRewriteEngine()


def _record_to_response(record: ResumeDraft) -> ResumeRecordResponse:
    resume = Resume.model_validate_json(record.payload)
    return ResumeRecordResponse(
        id=record.id,
        title=record.title,
        resume=resume,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _get_resume_or_404(db: Session, resume_id: str) -> ResumeDraft:
    record = db.get(ResumeDraft, resume_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume draft not found.")
    return record


def _pdf_filename(resume: Resume) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", resume.header.full_name.strip()).strip("-").lower()
    return f"{slug or 'resume'}-resume.pdf"


def _tex_filename(resume: Resume) -> str:
    return _pdf_filename(resume).removesuffix(".pdf") + ".tex"


@router.post("/generate")
def generate_resume(resume: Resume) -> Response:
    try:
        pdf_bytes = resume_builder.generate_pdf(resume)
    except LaTeXCompilerNotFound as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except LaTeXCompilationFailed as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except LaTeXCompilerError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_pdf_filename(resume)}"'},
    )


@router.post("/render-tex", response_model=RenderTexResponse)
def render_resume_tex(resume: Resume) -> RenderTexResponse:
    return RenderTexResponse(latex=resume_builder.render_tex(resume), filename=_tex_filename(resume))


@router.post("/analyze", response_model=AnalyzeResumeResponse)
def analyze_resume(request: AnalyzeResumeRequest) -> AnalyzeResumeResponse:
    return resume_analyzer.analyze(
        request.resume,
        target_role=request.target_role,
        target_company=request.target_company,
    )


@router.post("/analyze-job-description", response_model=AnalyzeJobDescriptionResponse)
def analyze_job_description(request: AnalyzeJobDescriptionRequest) -> AnalyzeJobDescriptionResponse:
    return job_description_analyzer.analyze(
        request.resume,
        job_description=request.job_description,
        target_role=request.target_role,
        target_company=request.target_company,
    )


@router.post("/rewrite-bullets", response_model=RewriteBulletsResponse)
def rewrite_resume_bullets(request: RewriteBulletsRequest) -> RewriteBulletsResponse:
    return bullet_rewriter.rewrite_bullets(
        request.resume,
        target_role=request.target_role,
        target_company=request.target_company,
        enable_ai=request.enable_ai,
    )


@router.post("/save", response_model=ResumeRecordResponse, status_code=status.HTTP_201_CREATED)
def save_resume(request: ResumeSaveRequest, db: Session = Depends(get_db)) -> ResumeRecordResponse:
    record = ResumeDraft(title=request.title, payload=request.resume.model_dump_json())
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_to_response(record)


@router.get("/{resume_id}", response_model=ResumeRecordResponse)
def get_resume(resume_id: str, db: Session = Depends(get_db)) -> ResumeRecordResponse:
    return _record_to_response(_get_resume_or_404(db, resume_id))


@router.put("/{resume_id}", response_model=ResumeRecordResponse)
def update_resume(resume_id: str, request: ResumeSaveRequest, db: Session = Depends(get_db)) -> ResumeRecordResponse:
    record = _get_resume_or_404(db, resume_id)
    record.title = request.title
    record.payload = request.resume.model_dump_json()
    record.updated_at = datetime.now(UTC)

    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_to_response(record)


@router.delete("/{resume_id}", response_model=DeleteResumeResponse)
def delete_resume(resume_id: str, db: Session = Depends(get_db)) -> DeleteResumeResponse:
    record = _get_resume_or_404(db, resume_id)
    db.delete(record)
    db.commit()
    return DeleteResumeResponse(id=resume_id, deleted=True)
