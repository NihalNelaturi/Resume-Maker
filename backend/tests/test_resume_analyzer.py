from __future__ import annotations

from app.models.resume_models import Certification, Experience, Header, Project, Resume, Skill
from app.services.resume_analyzer import ResumeAnalyzer


def make_resume() -> Resume:
    return Resume(
        header=Header(
            full_name="Nihal Test",
            email="nihal@example.com",
            phone="+91 90000 00000",
            location="India",
            github="github.com/nihal",
        ),
        professional_summary="Software engineer building Python APIs and debugging full-stack systems.",
        skills=[
            Skill(category="Languages", items=["Python", "C++", "SQL"]),
            Skill(category="Tools", items=["Git"]),
        ],
        projects=[
            Project(
                name="Resume Maker",
                role="Full-stack Developer",
                technologies=["FastAPI", "React", "LaTeX"],
                bullets=[
                    "Built a validated resume generation API using FastAPI and Pydantic.",
                    "Rendered ATS-friendly LaTeX resumes and compiled them into downloadable PDFs.",
                ],
            )
        ],
    )


def test_keyword_evidence_includes_locations_and_confidence() -> None:
    resume = Resume(
        header=Header(full_name="Nihal Test", email="nihal@example.com"),
        professional_summary="Debugging backend workflows for software engineer roles.",
        skills=[Skill(category="Languages", items=["Python"])],
        experience=[
            Experience(
                title="Software Engineer Intern",
                company="Example",
                bullets=["Improved service reliability by debugging API failures."],
            )
        ],
        projects=[
            Project(
                name="C++ Motor Fault Classifier",
                technologies=["FastAPI"],
                bullets=["Implemented REST API endpoints for inference."],
            )
        ],
        certifications=[
            Certification(title="Python Developer Certificate", issuer="Example")
        ],
    )

    result = ResumeAnalyzer().analyze(resume, target_role="Software Engineer", target_company="Infosys")
    evidence = {item.keyword: item for item in result.keyword_evidence}

    assert evidence["Python"].confidence == "high"
    assert "skills" in evidence["Python"].locations
    assert evidence["C++"].confidence == "high"
    assert "project_title" in evidence["C++"].locations
    assert evidence["Debugging"].confidence == "medium"
    assert "summary" in evidence["Debugging"].locations
    assert evidence["REST API"].confidence == "medium"
    assert "project_bullet" in evidence["REST API"].locations


def test_infosys_keywords_are_reported_without_mutating_resume() -> None:
    resume = make_resume()
    before = resume.model_dump()

    result = ResumeAnalyzer().analyze(resume, target_role="Software Engineer", target_company="Infosys")

    assert resume.model_dump() == before
    assert "Python" in result.matched_keywords
    assert "C++" in result.matched_keywords
    assert "Java" in result.missing_keywords
    assert "Java" not in [item for skill in resume.skills for item in skill.items]
    assert 0 <= result.ats_score <= 100
    assert 0 <= result.recruiter_readability_score <= 100
    assert 0 <= result.role_fit_score <= 100
    assert 0 <= result.company_fit_score <= 100


def test_low_confidence_evidence_does_not_count_as_full_coverage() -> None:
    resume = Resume(
        header=Header(full_name="Nihal Test", email="nihal@example.com"),
        skills=[Skill(category="Languages", items=["JavaScript"])],
        projects=[
            Project(
                name="Resume Maker",
                technologies=["FastAPI"],
                bullets=["Built backend services using FastAPI."],
            )
        ],
    )

    result = ResumeAnalyzer().analyze(resume, target_role="Software Engineer", target_company="Infosys")
    evidence = {item.keyword: item for item in result.keyword_evidence}

    assert evidence["Java"].found is True
    assert evidence["Java"].confidence == "low"
    assert "Java" in result.missing_keywords
    assert "Java" not in result.matched_keywords
    assert evidence["REST API"].found is True
    assert evidence["REST API"].confidence == "low"
    assert "REST API" in result.missing_keywords


def test_missing_keyword_suggestions_are_advisory_only() -> None:
    result = ResumeAnalyzer().analyze(make_resume(), target_role="Software Engineer", target_company="Infosys")
    suggestions = {item.keyword: item for item in result.missing_keyword_suggestions}

    assert suggestions["Java"].safe_to_add is False
    assert suggestions["Java"].requires_real_knowledge is True
    assert "skills" in suggestions["Java"].suggested_locations


def test_bullet_quality_checklist_and_section_breakdown_are_returned() -> None:
    result = ResumeAnalyzer().analyze(make_resume(), target_role="Software Engineer", target_company="Infosys")

    assert len(result.bullet_quality) == 2
    weak_bullet = next(item for item in result.bullet_quality if item.original.startswith("Built"))
    assert weak_bullet.score < 10
    assert "weak verb" in weak_bullet.weakness_types
    assert "no metric" in weak_bullet.weakness_types
    # The checklist is now generated generically from detected gaps, not from a
    # hard-coded company/project. Missing hard skills surface as advisory items.
    assert any(
        item.text == "Add Java to skills only if you genuinely know it."
        for item in result.improvement_checklist
    )
    assert any("measurable metric" in item.text for item in result.improvement_checklist)
    assert all(0 <= item.score <= 100 for item in result.section_score_breakdown)


def test_keyword_targets_generalize_across_roles() -> None:
    resume = make_resume()
    analyzer = ResumeAnalyzer()

    backend_keywords = [evidence.keyword for evidence in analyzer.analyze(resume, target_role="Backend Engineer").keyword_evidence]
    frontend_keywords = [evidence.keyword for evidence in analyzer.analyze(resume, target_role="Frontend Developer").keyword_evidence]
    data_keywords = [evidence.keyword for evidence in analyzer.analyze(resume, target_role="Data Analyst").keyword_evidence]

    # No company hard-coding: a frontend role surfaces React, a data role SQL/Data Analysis.
    assert "React" in frontend_keywords
    assert "React" not in backend_keywords
    assert "Data Analysis" in data_keywords
    assert "Java" in backend_keywords


def test_analyzer_detects_weak_bullets_and_missing_metrics() -> None:
    result = ResumeAnalyzer().analyze(make_resume(), target_role="Software Engineer", target_company="Infosys")

    assert any(finding.original.startswith("Built") for finding in result.weak_bullets)
    assert any("No measurable outcome" in finding.reasons[0] for finding in result.missing_metrics)
    assert any(issue.section == "target_fit" for issue in result.section_quality_issues)
