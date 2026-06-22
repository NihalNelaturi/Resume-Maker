from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ResumeBaseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SectionName(str, Enum):
    PROFESSIONAL_SUMMARY = "professional_summary"
    SKILLS = "skills"
    EXPERIENCE = "experience"
    PROJECTS = "projects"
    EDUCATION = "education"
    CERTIFICATIONS = "certifications"
    ACHIEVEMENTS = "achievements"


DEFAULT_SECTION_ORDER: list[SectionName] = [
    SectionName.PROFESSIONAL_SUMMARY,
    SectionName.SKILLS,
    SectionName.EXPERIENCE,
    SectionName.PROJECTS,
    SectionName.EDUCATION,
    SectionName.CERTIFICATIONS,
    SectionName.ACHIEVEMENTS,
]


def _empty_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _clean_string_list(values: list[str]) -> list[str]:
    return [value.strip() for value in values if isinstance(value, str) and value.strip()]


class Header(ResumeBaseModel):
    full_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    location: str | None = Field(default=None, max_length=120)
    linkedin: str | None = Field(default=None, max_length=200)
    github: str | None = Field(default=None, max_length=200)
    portfolio: str | None = Field(default=None, max_length=200)

    @field_validator("phone", "location", "linkedin", "github", "portfolio", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)


class Education(ResumeBaseModel):
    institution: str = Field(default="", max_length=160)
    degree: str = Field(default="", max_length=160)
    location: str | None = Field(default=None, max_length=120)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    score: str | None = Field(default=None, max_length=80)
    coursework: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("location", "start_date", "end_date", "score", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("coursework")
    @classmethod
    def clean_coursework(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)


class Project(ResumeBaseModel):
    name: str = Field(default="", max_length=140)
    role: str | None = Field(default=None, max_length=120)
    link: str | None = Field(default=None, max_length=220)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    technologies: list[str] = Field(default_factory=list, max_length=20)
    bullets: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("role", "link", "start_date", "end_date", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("technologies")
    @classmethod
    def clean_technologies(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)

    @field_validator("bullets")
    @classmethod
    def clean_bullets(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)


class Experience(ResumeBaseModel):
    title: str = Field(default="", max_length=140)
    company: str = Field(default="", max_length=160)
    location: str | None = Field(default=None, max_length=120)
    start_date: str | None = Field(default=None, max_length=40)
    end_date: str | None = Field(default=None, max_length=40)
    bullets: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("location", "start_date", "end_date", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("bullets")
    @classmethod
    def clean_bullets(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)


class Skill(ResumeBaseModel):
    category: str = Field(default="", max_length=80)
    items: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("items")
    @classmethod
    def clean_items(cls, values: list[str]) -> list[str]:
        return _clean_string_list(values)


class Certification(ResumeBaseModel):
    title: str = Field(default="", max_length=160)
    issuer: str | None = Field(default=None, max_length=120)
    date: str | None = Field(default=None, max_length=40)
    link: str | None = Field(default=None, max_length=220)

    @field_validator("issuer", "date", "link", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)


class Achievement(ResumeBaseModel):
    title: str = Field(default="", max_length=160)
    description: str | None = Field(default=None, max_length=400)
    date: str | None = Field(default=None, max_length=40)

    @field_validator("description", "date", mode="before")
    @classmethod
    def blank_optional_fields_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)


class Resume(ResumeBaseModel):
    header: Header
    professional_summary: str | None = Field(default=None, max_length=900)
    skills: list[Skill] = Field(default_factory=list, max_length=12)
    experience: list[Experience] = Field(default_factory=list, max_length=6)
    projects: list[Project] = Field(default_factory=list, max_length=8)
    education: list[Education] = Field(default_factory=list, max_length=6)
    certifications: list[Certification] = Field(default_factory=list, max_length=8)
    achievements: list[Achievement] = Field(default_factory=list, max_length=8)
    section_order: list[SectionName] = Field(
        default_factory=lambda: DEFAULT_SECTION_ORDER.copy(),
        min_length=1,
        max_length=len(DEFAULT_SECTION_ORDER),
    )

    @field_validator("professional_summary", mode="before")
    @classmethod
    def blank_summary_to_none(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("section_order")
    @classmethod
    def normalize_section_order(cls, order: list[SectionName]) -> list[SectionName]:
        seen: list[SectionName] = []
        for section in order:
            if section not in seen:
                seen.append(section)
        return seen or DEFAULT_SECTION_ORDER.copy()


class ResumeSaveRequest(ResumeBaseModel):
    title: str = Field(default="Untitled Resume", min_length=1, max_length=120)
    resume: Resume


class ResumeRecordResponse(ResumeBaseModel):
    id: str
    title: str
    resume: Resume
    created_at: datetime
    updated_at: datetime


class DeleteResumeResponse(ResumeBaseModel):
    id: str
    deleted: bool
