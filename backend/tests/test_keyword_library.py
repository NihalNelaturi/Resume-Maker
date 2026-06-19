from __future__ import annotations

from app.services.keyword_library import (
    classify_keyword,
    extract_keywords_from_text,
    select_role_keywords,
    text_contains_keyword,
)


def test_role_profiles_select_distinct_keyword_sets() -> None:
    frontend = select_role_keywords("Senior Frontend Engineer")
    backend = select_role_keywords("Backend Developer")
    data = select_role_keywords("Data Analyst")

    assert "React" in frontend and "React" not in backend
    assert "Java" in backend
    assert "Data Analysis" in data


def test_unknown_role_falls_back_to_generic() -> None:
    keywords = select_role_keywords("Underwater Basket Weaver")
    assert "Python" in keywords  # generic software fallback


def test_empty_role_is_generic() -> None:
    assert select_role_keywords("") == select_role_keywords("   ")


def test_keyword_classification() -> None:
    assert classify_keyword("Python") == "hard"
    assert classify_keyword("Data Structures") == "conceptual"
    assert classify_keyword("Debugging") == "project_context"


def test_java_does_not_match_inside_javascript() -> None:
    assert text_contains_keyword("Experienced in JavaScript and React", "Java") is False
    assert text_contains_keyword("Strong Java and Spring background", "Java") is True


def test_extract_keywords_from_job_description() -> None:
    jd = "We need Python, React, REST API design, SQL, and Docker experience."
    found = extract_keywords_from_text(jd)
    for expected in ["Python", "React", "REST API", "SQL", "Docker"]:
        assert expected in found
