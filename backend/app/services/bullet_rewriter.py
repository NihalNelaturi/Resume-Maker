from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.models.command_center_models import BulletRewrite, RewriteBulletsResponse
from app.models.resume_models import Project, Resume


METRIC_SUGGESTION = "Add metric here if available: accuracy, latency, deployment speed, users, model size, etc."
WEAK_VERBS = {
    "worked": "Analyzed",
    "helped": "Supported",
    "used": "Applied",
    "built": "Developed",
    "responsible": "Managed",
    "assisted": "Supported",
    "participated": "Contributed",
    "handled": "Managed",
}
METRIC_PATTERN = re.compile(r"(\d+[\d,.]*\s*%?|\btop\s+\d+\b|\b\d+x\b)", re.IGNORECASE)
WORD_PATTERN = re.compile(r"[a-z0-9+#.]+", re.IGNORECASE)


@dataclass(frozen=True)
class BulletContext:
    section: str
    item_index: int
    bullet_index: int
    label: str
    original: str
    technologies: tuple[str, ...] = ()


class RewriteProvider(Protocol):
    name: str

    def rewrite(self, context: BulletContext, target_role: str, target_company: str) -> BulletRewrite:
        ...


def _strip_period(text: str) -> str:
    return text.strip().rstrip(".").strip()


def _weak_terms(text: str) -> list[str]:
    first_word_match = re.match(r"^\s*([A-Za-z]+)", text)
    if not first_word_match:
        return []
    first_word = first_word_match.group(1).lower()
    return [first_word] if first_word in WEAK_VERBS else []


def _has_metric(text: str) -> bool:
    return bool(METRIC_PATTERN.search(text))


def _starts_with_action_verb(text: str) -> bool:
    first_word_match = re.match(r"^\s*([A-Za-z]+)", text)
    if not first_word_match:
        return False
    return first_word_match.group(1).lower() not in WEAK_VERBS


class RuleBasedRewriteProvider:
    name = "rule_based"

    def rewrite(self, context: BulletContext, target_role: str, target_company: str) -> BulletRewrite:
        original = context.original.strip()
        weak_terms = _weak_terms(original)
        rewritten = self._rewrite_text(original, weak_terms)
        notes: list[str] = []

        if not weak_terms and rewritten == original:
            notes.append("Bullet already starts with a stronger action verb.")
        if not _has_metric(original):
            notes.append("No metric was added because the original bullet does not contain one.")

        return BulletRewrite(
            section=context.section,
            item_index=context.item_index,
            bullet_index=context.bullet_index,
            label=context.label,
            original=original,
            rewritten=rewritten,
            weak_terms=weak_terms,
            rewrite_source=self.name,
            changed=rewritten != original,
            metric_suggestion=None if _has_metric(original) else METRIC_SUGGESTION,
            notes=notes,
        )

    def _rewrite_text(self, original: str, weak_terms: list[str]) -> str:
        clean = _strip_period(original)
        if not clean:
            return original

        if weak_terms:
            weak = weak_terms[0]
            action = WEAK_VERBS[weak]
            remainder = re.sub(rf"^\s*{re.escape(weak)}\b\s*", "", clean, flags=re.IGNORECASE).strip()
            remainder = re.sub(r"^(on|with|in|for|to)\s+", "", remainder, flags=re.IGNORECASE)
            if remainder:
                rewritten = f"{action} {remainder}"
            else:
                rewritten = action
            return f"{rewritten}."

        if _starts_with_action_verb(clean):
            return f"{clean}."

        return f"Improved {clean[0].lower()}{clean[1:]}."


class BulletRewriteEngine:
    def __init__(self, rule_provider: RewriteProvider | None = None) -> None:
        self.rule_provider = rule_provider or RuleBasedRewriteProvider()

    def rewrite_bullets(
        self,
        resume: Resume,
        target_role: str = "",
        target_company: str = "",
        enable_ai: bool = False,
    ) -> RewriteBulletsResponse:
        # AI providers can be selected here later. Until configured, the rule provider is the safe default.
        provider = self.rule_provider
        rewrites = [
            provider.rewrite(context, target_role=target_role, target_company=target_company)
            for context in self._contexts(resume)
        ]

        return RewriteBulletsResponse(
            rewrites=rewrites,
            provider=provider.name,
            ai_enabled=False,
            safety_rules=[
                "No fake experience is added.",
                "No fake certifications are added.",
                "No fake skills are injected.",
                "No metrics are invented; metric prompts are returned separately.",
            ],
        )

    def _contexts(self, resume: Resume) -> list[BulletContext]:
        contexts: list[BulletContext] = []
        for item_index, item in enumerate(resume.experience):
            label = f"{item.title} at {item.company}"
            for bullet_index, bullet in enumerate(item.bullets):
                contexts.append(
                    BulletContext(
                        section="experience",
                        item_index=item_index,
                        bullet_index=bullet_index,
                        label=label,
                        original=bullet,
                    )
                )

        for item_index, project in enumerate(resume.projects):
            technologies = self._project_technologies(project)
            for bullet_index, bullet in enumerate(project.bullets):
                contexts.append(
                    BulletContext(
                        section="projects",
                        item_index=item_index,
                        bullet_index=bullet_index,
                        label=project.name,
                        original=bullet,
                        technologies=technologies,
                    )
                )
        return contexts

    def _project_technologies(self, project: Project) -> tuple[str, ...]:
        return tuple(technology for technology in project.technologies if technology.strip())
