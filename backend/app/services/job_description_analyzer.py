from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from app.models.command_center_models import (
    AnalyzeJobDescriptionResponse,
    JobDescriptionKeywordMatch,
    MissingKeywordSuggestion,
)
from app.models.resume_models import Resume
from app.services.resume_analyzer import ResumeAnalyzer, _bounded_score, _exact_keyword_match, _sentence_snippet


JD_KEYWORD_ALIASES: dict[str, list[str]] = {
    "Python": ["Python"],
    "C++": ["C++", "CPP"],
    "C": ["C"],
    "Java": ["Java"],
    "SQL": ["SQL", "Database Query"],
    "JavaScript": ["JavaScript", "JS"],
    "TypeScript": ["TypeScript", "TS"],
    "React": ["React", "React.js", "ReactJS"],
    "Node.js": ["Node.js", "NodeJS", "Node"],
    "FastAPI": ["FastAPI"],
    "Flask": ["Flask"],
    "Django": ["Django"],
    "REST API": ["REST API", "RESTful API", "RESTful", "API", "APIs", "API endpoint", "API endpoints"],
    "Data Structures": ["Data Structures", "Data Structure", "DSA"],
    "Algorithms": ["Algorithms", "Algorithm", "DSA"],
    "OOP": ["OOP", "Object Oriented", "Object-Oriented", "Object-Oriented Programming"],
    "Problem Solving": ["Problem Solving", "Problem-Solving", "Analytical Skills"],
    "Debugging": ["Debugging", "Troubleshooting"],
    "Software Development": ["Software Development", "Software Engineering", "Application Development"],
    "Testing": ["Testing", "Test Cases", "QA"],
    "Unit Testing": ["Unit Testing", "Unit Tests"],
    "Git": ["Git", "Version Control"],
    "GitHub": ["GitHub"],
    "CI/CD": ["CI/CD", "Continuous Integration", "Continuous Deployment"],
    "Docker": ["Docker", "Containerization"],
    "Kubernetes": ["Kubernetes", "K8s"],
    "Linux": ["Linux", "Unix"],
    "AWS": ["AWS", "Amazon Web Services"],
    "Azure": ["Azure"],
    "GCP": ["GCP", "Google Cloud"],
    "PostgreSQL": ["PostgreSQL", "Postgres"],
    "MySQL": ["MySQL"],
    "MongoDB": ["MongoDB"],
    "Database": ["Database", "Databases", "DBMS"],
    "Agile": ["Agile", "Scrum"],
    "HTML": ["HTML"],
    "CSS": ["CSS"],
    "Tailwind CSS": ["Tailwind CSS", "Tailwind"],
    "Machine Learning": ["Machine Learning", "ML"],
    "Embedded Systems": ["Embedded Systems", "Embedded"],
    "Pydantic": ["Pydantic"],
    "SQLAlchemy": ["SQLAlchemy"],
}

HARD_SKILL_KEYWORDS = {
    "Python",
    "C++",
    "C",
    "Java",
    "SQL",
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "FastAPI",
    "Flask",
    "Django",
    "REST API",
    "Git",
    "GitHub",
    "CI/CD",
    "Docker",
    "Kubernetes",
    "Linux",
    "AWS",
    "Azure",
    "GCP",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Database",
    "Testing",
    "Unit Testing",
    "HTML",
    "CSS",
    "Tailwind CSS",
    "Machine Learning",
    "Embedded Systems",
    "Pydantic",
    "SQLAlchemy",
}

CONCEPTUAL_KEYWORDS = {
    "Data Structures",
    "Algorithms",
    "OOP",
}

PROJECT_CONTEXT_KEYWORDS = {
    "Problem Solving",
    "Debugging",
    "Software Development",
    "Agile",
}


@dataclass(frozen=True)
class ResumeTextSource:
    text: str
    location: str


def _matches_keyword(text: str, keyword: str) -> bool:
    return any(_exact_keyword_match(text, alias) for alias in JD_KEYWORD_ALIASES.get(keyword, [keyword]))


def _extract_jd_keywords(job_description: str) -> list[str]:
    return [keyword for keyword in JD_KEYWORD_ALIASES if _matches_keyword(job_description, keyword)]


def _resume_sources(resume: Resume) -> Iterable[ResumeTextSource]:
    if resume.professional_summary:
        yield ResumeTextSource(resume.professional_summary, "summary")

    for skill in resume.skills:
        yield ResumeTextSource(" ".join([skill.category, *skill.items]), "skills")

    for item in resume.experience:
        yield ResumeTextSource(f"{item.title} {item.company}", "experience title")
        for bullet in item.bullets:
            yield ResumeTextSource(bullet, "experience bullet")

    for project in resume.projects:
        yield ResumeTextSource(" ".join([project.name, project.role or ""]), "project title")
        if project.technologies:
            yield ResumeTextSource(" ".join(project.technologies), "project technologies")
        for bullet in project.bullets:
            yield ResumeTextSource(bullet, "project bullet")

    for education in resume.education:
        yield ResumeTextSource(
            " ".join([education.institution, education.degree, *(education.coursework or [])]),
            "education",
        )

    for certification in resume.certifications:
        yield ResumeTextSource(f"{certification.title} {certification.issuer or ''}", "certification")

    for achievement in resume.achievements:
        yield ResumeTextSource(f"{achievement.title} {achievement.description or ''}", "achievement")


def _keyword_details(jd_keywords: list[str], resume: Resume) -> list[JobDescriptionKeywordMatch]:
    sources = list(_resume_sources(resume))
    details: list[JobDescriptionKeywordMatch] = []

    for keyword in jd_keywords:
        locations: list[str] = []
        snippets: list[str] = []
        for source in sources:
            if not _matches_keyword(source.text, keyword):
                continue
            locations.append(source.location)
            snippets.append(_sentence_snippet(source.text, keyword))

        details.append(
            JobDescriptionKeywordMatch(
                keyword=keyword,
                present=bool(locations),
                resume_locations=locations,
                matched_text=snippets,
            )
        )

    return details


def _has_project_or_experience(resume: Resume) -> bool:
    return bool(resume.projects or resume.experience)


def _has_course_or_project_context(resume: Resume) -> bool:
    searchable = " ".join(
        [
            *(course for education in resume.education for course in education.coursework),
            *(project.name for project in resume.projects),
            *(technology for project in resume.projects for technology in project.technologies),
            *(bullet for project in resume.projects for bullet in project.bullets),
        ]
    )
    return bool(searchable.strip())


def _suggestion_for_keyword(keyword: str, resume: Resume) -> MissingKeywordSuggestion:
    requires_real_knowledge = True
    safe_to_add = False
    suggested_locations = ["skills", "project bullet"]
    reason = "Do not add this JD keyword unless it is truthful and backed by real knowledge or project evidence."

    if keyword in HARD_SKILL_KEYWORDS:
        suggested_locations = ["skills", "project technologies", "project bullet"]
        reason = f"{keyword} is a concrete skill from the JD; keep it missing unless you actually know or used it."
    elif keyword in CONCEPTUAL_KEYWORDS:
        suggested_locations = ["skills", "education coursework", "project bullet"]
        safe_to_add = _has_course_or_project_context(resume)
        reason = (
            "Can be mentioned only where coursework or project work honestly supports it."
            if safe_to_add
            else "Needs real coursework or project evidence before adding."
        )
    elif keyword in PROJECT_CONTEXT_KEYWORDS:
        suggested_locations = ["summary", "project bullet", "experience bullet"]
        safe_to_add = _has_project_or_experience(resume)
        reason = (
            "Can be framed through existing project or experience bullets if the wording stays specific."
            if safe_to_add
            else "Needs project or experience evidence before adding."
        )

    return MissingKeywordSuggestion(
        keyword=keyword,
        safe_to_add=safe_to_add,
        suggested_locations=suggested_locations,
        requires_real_knowledge=requires_real_knowledge,
        reason=reason,
    )


def _role_alignment_score(
    jd_keywords: list[str],
    matched_keywords: list[str],
    target_role: str,
    target_company: str,
    keyword_match_percentage: int,
    job_description: str,
) -> int:
    if not jd_keywords:
        return 0

    target_keywords = ResumeAnalyzer()._target_keywords(target_role, target_company)
    jd_target_keywords = [keyword for keyword in jd_keywords if keyword in target_keywords]

    if jd_target_keywords:
        role_signal = len([keyword for keyword in jd_target_keywords if keyword in matched_keywords]) / len(jd_target_keywords)
    else:
        role_signal = len(matched_keywords) / len(jd_keywords)

    role_words = [word for word in re.findall(r"[a-z0-9+#]+", target_role.lower()) if len(word) >= 4]
    jd_text = job_description.lower()
    target_role_signal = 1 if role_words and all(word in jd_text for word in role_words) else 0.6

    return _bounded_score(keyword_match_percentage * 0.72 + role_signal * 22 + target_role_signal * 6)


class JobDescriptionAnalyzer:
    def analyze(
        self,
        resume: Resume,
        job_description: str,
        target_role: str = "",
        target_company: str = "",
    ) -> AnalyzeJobDescriptionResponse:
        jd_keywords = _extract_jd_keywords(job_description)
        details = _keyword_details(jd_keywords, resume)
        matched_keywords = [detail.keyword for detail in details if detail.present]
        missing_keywords = [detail.keyword for detail in details if not detail.present]
        match_percentage = _bounded_score((len(matched_keywords) / len(jd_keywords)) * 100) if jd_keywords else 0
        role_alignment_score = _role_alignment_score(
            jd_keywords,
            matched_keywords,
            target_role,
            target_company,
            match_percentage,
            job_description,
        )

        return AnalyzeJobDescriptionResponse(
            jd_keywords=jd_keywords,
            matched_keywords=matched_keywords,
            missing_keywords=missing_keywords,
            keyword_match_percentage=match_percentage,
            role_alignment_score=role_alignment_score,
            keyword_details=details,
            safe_suggestions=[_suggestion_for_keyword(keyword, resume) for keyword in missing_keywords],
        )
