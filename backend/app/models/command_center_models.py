from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.models.resume_models import Resume


class CommandCenterBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TargetedResumeRequest(CommandCenterBaseModel):
    resume: Resume
    target_role: str = Field(default="", max_length=120)
    target_company: str = Field(default="", max_length=120)


class AnalyzeResumeRequest(TargetedResumeRequest):
    pass


class AnalyzeJobDescriptionRequest(TargetedResumeRequest):
    job_description: str = Field(..., min_length=1, max_length=20000)


class KeywordMatch(CommandCenterBaseModel):
    keyword: str
    present: bool
    sources: list[str] = Field(default_factory=list)


class KeywordEvidence(CommandCenterBaseModel):
    keyword: str
    found: bool
    locations: list[str] = Field(default_factory=list)
    matched_text: list[str] = Field(default_factory=list)
    confidence: str = Field(default="low")


class MissingKeywordSuggestion(CommandCenterBaseModel):
    keyword: str
    safe_to_add: bool
    suggested_locations: list[str] = Field(default_factory=list)
    requires_real_knowledge: bool
    reason: str


class BulletFinding(CommandCenterBaseModel):
    section: str
    item_index: int
    bullet_index: int
    label: str
    original: str
    reasons: list[str] = Field(default_factory=list)


class BulletQuality(CommandCenterBaseModel):
    section: str
    item_index: int
    bullet_index: int
    label: str
    original: str
    score: int
    weakness_types: list[str] = Field(default_factory=list)
    reason: str


class SectionQualityIssue(CommandCenterBaseModel):
    section: str
    severity: str
    message: str


class ImprovementChecklistItem(CommandCenterBaseModel):
    text: str
    priority: str
    completed: bool = False


class SectionScoreBreakdown(CommandCenterBaseModel):
    section: str
    score: int
    reason: str


class AnalyzeResumeResponse(CommandCenterBaseModel):
    ats_score: int
    recruiter_readability_score: int
    role_fit_score: int
    company_fit_score: int
    missing_keywords: list[str] = Field(default_factory=list)
    matched_keywords: list[str] = Field(default_factory=list)
    keyword_matches: list[KeywordMatch] = Field(default_factory=list)
    weak_bullets: list[BulletFinding] = Field(default_factory=list)
    missing_metrics: list[BulletFinding] = Field(default_factory=list)
    section_quality_issues: list[SectionQualityIssue] = Field(default_factory=list)
    keyword_evidence: list[KeywordEvidence] = Field(default_factory=list)
    missing_keyword_suggestions: list[MissingKeywordSuggestion] = Field(default_factory=list)
    bullet_quality: list[BulletQuality] = Field(default_factory=list)
    improvement_checklist: list[ImprovementChecklistItem] = Field(default_factory=list)
    section_score_breakdown: list[SectionScoreBreakdown] = Field(default_factory=list)


class JobDescriptionKeywordMatch(CommandCenterBaseModel):
    keyword: str
    present: bool
    resume_locations: list[str] = Field(default_factory=list)
    matched_text: list[str] = Field(default_factory=list)


class AnalyzeJobDescriptionResponse(CommandCenterBaseModel):
    jd_keywords: list[str] = Field(default_factory=list)
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    keyword_match_percentage: int
    role_alignment_score: int
    keyword_details: list[JobDescriptionKeywordMatch] = Field(default_factory=list)
    safe_suggestions: list[MissingKeywordSuggestion] = Field(default_factory=list)


class RewriteBulletsRequest(TargetedResumeRequest):
    enable_ai: bool = False


class BulletRewrite(CommandCenterBaseModel):
    section: str
    item_index: int
    bullet_index: int
    label: str
    original: str
    rewritten: str
    weak_terms: list[str] = Field(default_factory=list)
    rewrite_source: str
    changed: bool
    metric_suggestion: str | None = None
    notes: list[str] = Field(default_factory=list)


class RewriteBulletsResponse(CommandCenterBaseModel):
    rewrites: list[BulletRewrite] = Field(default_factory=list)
    provider: str
    ai_enabled: bool
    safety_rules: list[str] = Field(default_factory=list)


class RenderTexResponse(CommandCenterBaseModel):
    latex: str
    filename: str
