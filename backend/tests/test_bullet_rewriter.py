from __future__ import annotations

from app.models.resume_models import Header, Project, Resume
from app.services.bullet_rewriter import BulletRewriteEngine


def make_resume() -> Resume:
    return Resume(
        header=Header(full_name="Nihal Test", email="nihal@example.com"),
        projects=[
            Project(
                name="Edge ML Fault Classifier",
                role="Developer",
                technologies=["MFCC", "Embedded inference"],
                bullets=[
                    "Built an edge machine learning system to classify six industrial motor fault conditions from acoustic signals.",
                    "Improved inference latency by 20% using embedded model optimization.",
                ],
            )
        ],
    )


def test_rewrite_replaces_weak_opening_without_inventing_metrics() -> None:
    result = BulletRewriteEngine().rewrite_bullets(
        make_resume(),
        target_role="Software Engineer",
        target_company="Infosys",
    )

    rewrite = result.rewrites[0]
    assert rewrite.original.startswith("Built")
    assert rewrite.rewritten.startswith("Developed")
    assert "edge machine learning system" in rewrite.rewritten
    assert rewrite.metric_suggestion is not None
    assert "Add metric here if available" in rewrite.metric_suggestion
    assert rewrite.rewrite_source == "rule_based"


def test_existing_metric_is_preserved_without_metric_prompt() -> None:
    result = BulletRewriteEngine().rewrite_bullets(make_resume())
    rewrite = result.rewrites[1]

    assert "20%" in rewrite.rewritten
    assert rewrite.metric_suggestion is None


def test_rewrite_service_does_not_mutate_resume_data() -> None:
    resume = make_resume()
    before = resume.model_dump()

    BulletRewriteEngine().rewrite_bullets(resume, target_role="Software Engineer", target_company="Infosys")

    assert resume.model_dump() == before
