from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.models.resume_models import Education, Header, Project, Resume, Skill
from app.services.job_description_analyzer import JobDescriptionAnalyzer


def make_resume() -> Resume:
    return Resume(
        header=Header(full_name="Nihal Test", email="nihal@example.com"),
        professional_summary="Software engineer building Python APIs and debugging full-stack systems.",
        skills=[
            Skill(category="Languages", items=["Python", "JavaScript"]),
            Skill(category="Tools", items=["Git"]),
        ],
        projects=[
            Project(
                name="Resume Maker",
                technologies=["FastAPI", "React"],
                bullets=[
                    "Developed REST API endpoints for validated resume generation using FastAPI.",
                    "Built recruiter-friendly PDF export workflows with LaTeX rendering.",
                ],
            )
        ],
        education=[
            Education(
                institution="Example University",
                degree="B.Tech Computer Science",
                coursework=["Data Structures", "Operating Systems"],
            )
        ],
    )


def test_job_description_keywords_are_extracted_and_compared() -> None:
    jd = """
    Infosys is hiring a Software Engineer with Python, Java, SQL, REST API,
    Data Structures, Problem Solving, Git, and debugging experience.
    """

    result = JobDescriptionAnalyzer().analyze(
        make_resume(),
        jd,
        target_role="Software Engineer",
        target_company="Infosys",
    )

    assert "Python" in result.jd_keywords
    assert "REST API" in result.jd_keywords
    assert "Python" in result.matched_keywords
    assert "Git" in result.matched_keywords
    assert "Java" in result.missing_keywords
    assert "SQL" in result.missing_keywords
    assert 0 <= result.keyword_match_percentage <= 100
    assert 0 <= result.role_alignment_score <= 100


def test_keyword_details_include_resume_locations_and_snippets() -> None:
    result = JobDescriptionAnalyzer().analyze(make_resume(), "Need Python, React, REST API, Data Structures.")
    details = {detail.keyword: detail for detail in result.keyword_details}

    assert details["Python"].present is True
    assert "skills" in details["Python"].resume_locations
    assert details["React"].present is True
    assert "project technologies" in details["React"].resume_locations
    assert details["REST API"].present is True
    assert details["REST API"].matched_text


def test_missing_hard_skills_are_not_marked_safe_to_add() -> None:
    result = JobDescriptionAnalyzer().analyze(make_resume(), "Need Java and SQL for backend development.")
    suggestions = {item.keyword: item for item in result.safe_suggestions}

    assert suggestions["Java"].safe_to_add is False
    assert suggestions["Java"].requires_real_knowledge is True
    assert "skills" in suggestions["Java"].suggested_locations
    assert suggestions["SQL"].safe_to_add is False


def test_java_does_not_match_javascript() -> None:
    result = JobDescriptionAnalyzer().analyze(make_resume(), "Required skill: Java.")

    assert "Java" in result.jd_keywords
    assert "Java" in result.missing_keywords
    assert "Java" not in result.matched_keywords


def test_job_description_analyzer_does_not_mutate_resume() -> None:
    resume = make_resume()
    before = resume.model_dump()

    JobDescriptionAnalyzer().analyze(resume, "Need Python, Java, SQL, REST API.")

    assert resume.model_dump() == before


def test_job_description_api_endpoint_returns_comparison() -> None:
    payload = {
        "resume": make_resume().model_dump(mode="json"),
        "target_role": "Software Engineer",
        "target_company": "Infosys",
        "job_description": "Infosys Software Engineer role requiring Python, Java, SQL, REST API, and Git.",
    }

    with TestClient(app) as client:
        response = client.post("/api/resume/analyze-job-description", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "Python" in data["matched_keywords"]
    assert "Java" in data["missing_keywords"]
    assert 0 <= data["keyword_match_percentage"] <= 100
    assert 0 <= data["role_alignment_score"] <= 100
