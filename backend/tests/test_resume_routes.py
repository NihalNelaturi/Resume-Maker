from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


def make_resume_payload() -> dict:
    return {
        "header": {
            "full_name": "Nihal Test",
            "email": "nihal@example.com",
            "phone": "+91 90000 00000",
            "location": "India",
            "github": "github.com/nihal",
        },
        "professional_summary": "Backend-focused developer building reliable Python APIs.",
        "skills": [{"category": "Languages", "items": ["Python", "SQL"]}],
        "projects": [
            {
                "name": "Resume Maker",
                "technologies": ["FastAPI", "React"],
                "bullets": ["Developed REST API endpoints for resume generation using FastAPI."],
            }
        ],
    }


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_render_tex_returns_latex(client: TestClient) -> None:
    response = client.post("/api/resume/render-tex", json=make_resume_payload())
    assert response.status_code == 200
    data = response.json()
    assert "\\documentclass" in data["latex"]
    assert data["filename"].endswith(".tex")


def test_analyze_endpoint_returns_scores(client: TestClient) -> None:
    payload = {
        "resume": make_resume_payload(),
        "target_role": "Backend Engineer",
        "target_company": "",
    }
    response = client.post("/api/resume/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0 <= data["ats_score"] <= 100
    assert "Python" in data["matched_keywords"]


def test_save_get_update_delete_lifecycle(client: TestClient) -> None:
    save = client.post("/api/resume/save", json={"title": "v1", "resume": make_resume_payload()})
    assert save.status_code == 201
    resume_id = save.json()["id"]

    fetched = client.get(f"/api/resume/{resume_id}")
    assert fetched.status_code == 200
    assert fetched.json()["title"] == "v1"

    updated = client.put(
        f"/api/resume/{resume_id}",
        json={"title": "v2", "resume": make_resume_payload()},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "v2"

    deleted = client.delete(f"/api/resume/{resume_id}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

    missing = client.get(f"/api/resume/{resume_id}")
    assert missing.status_code == 404


def test_invalid_resume_is_rejected(client: TestClient) -> None:
    bad_payload = make_resume_payload()
    bad_payload["header"]["email"] = "not-an-email"
    response = client.post("/api/resume/analyze", json={"resume": bad_payload})
    assert response.status_code == 422
