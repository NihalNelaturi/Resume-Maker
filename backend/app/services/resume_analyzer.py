from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from app.models.command_center_models import (
    AnalyzeResumeResponse,
    BulletFinding,
    BulletQuality,
    ImprovementChecklistItem,
    KeywordEvidence,
    KeywordMatch,
    MissingKeywordSuggestion,
    SectionScoreBreakdown,
    SectionQualityIssue,
)
from app.models.resume_models import Resume


INFOSYS_SOFTWARE_ENGINEER_KEYWORDS = [
    "Python",
    "C++",
    "Java",
    "SQL",
    "Data Structures",
    "Algorithms",
    "OOP",
    "Problem Solving",
    "Debugging",
    "Git",
    "Software Development",
    "REST API",
]

SOFTWARE_ENGINEER_KEYWORDS = [
    "Python",
    "JavaScript",
    "SQL",
    "Data Structures",
    "Algorithms",
    "OOP",
    "Git",
    "REST API",
    "Testing",
    "Debugging",
]

WEAK_VERB_PATTERN = re.compile(
    r"^\s*(worked|helped|used|built|responsible|assisted|participated|handled)\b",
    re.IGNORECASE,
)
NUMBER_PATTERN = re.compile(r"(\d+[\d,.]*\s*%?|\btop\s+\d+\b|\b\d+x\b)", re.IGNORECASE)
WORD_PATTERN = re.compile(r"[a-z0-9+#.]+", re.IGNORECASE)
TECHNICAL_METHOD_PATTERN = re.compile(
    r"\b(using|with|through|via|by|implemented|developed|designed|integrated|optimized|trained|deployed|"
    r"fastapi|react|python|sql|c\+\+|java|docker|latex|pydantic|sqlalchemy|api|mfcc|model|algorithm)\b",
    re.IGNORECASE,
)
VAGUE_TERMS_PATTERN = re.compile(
    r"\b(various|multiple|things|stuff|tasks|workflows|concepts|systems|tools|helped|worked on)\b",
    re.IGNORECASE,
)

CONFIDENCE_WEIGHT = {
    "high": 1.0,
    "medium": 0.6,
    "low": 0.0,
    "none": 0.0,
}
CONFIDENCE_RANK = {
    "none": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
}


@dataclass(frozen=True)
class TextSource:
    source: str
    text: str
    location: str
    confidence_bucket: str


def _normalize_target(value: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", value.lower()).strip()


def _bounded_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _keyword_aliases(keyword: str) -> list[str]:
    aliases = {
        "C++": ["c++", "cpp"],
        "OOP": ["oop", "object oriented", "object-oriented"],
        "REST API": ["rest api", "restful api", "restful", "fastapi"],
        "Problem Solving": ["problem solving", "problem-solving", "solved"],
        "Software Development": ["software development", "software engineering"],
        "Data Structures": ["data structures", "data structure", "dsa"],
        "Algorithms": ["algorithms", "algorithm", "dsa"],
    }
    return aliases.get(keyword, [keyword.lower()])


def _canonical_keyword(keyword: str) -> str:
    return _normalize_target(keyword)


def _exact_keyword_match(text: str, keyword: str) -> bool:
    normalized = _normalize_target(text)
    normalized_keyword = _canonical_keyword(keyword)
    if not normalized_keyword:
        return False
    if "+" in normalized_keyword:
        return normalized_keyword in normalized
    pattern = rf"(?<![a-z0-9+#]){re.escape(normalized_keyword)}(?![a-z0-9+#])"
    return bool(re.search(pattern, normalized))


def _alias_keyword_match(text: str, keyword: str) -> bool:
    normalized = _normalize_target(text)
    canonical = _canonical_keyword(keyword)
    for alias in _keyword_aliases(keyword):
        normalized_alias = _normalize_target(alias)
        if not normalized_alias or normalized_alias == canonical:
            continue
        if "+" in normalized_alias:
            if normalized_alias in normalized:
                return True
            continue
        pattern = rf"(?<![a-z0-9+#]){re.escape(normalized_alias)}(?![a-z0-9+#])"
        if re.search(pattern, normalized):
            return True
    return False


def _partial_keyword_match(text: str, keyword: str) -> bool:
    normalized = _normalize_target(text)
    words = [word for word in _canonical_keyword(keyword).split() if len(word) >= 4]
    if not words:
        return False
    return any(word in normalized for word in words)


def _keyword_match_confidence(text: str, keyword: str, source_bucket: str) -> str | None:
    if _exact_keyword_match(text, keyword):
        return source_bucket
    if _alias_keyword_match(text, keyword) or _partial_keyword_match(text, keyword):
        return "low"
    return None


def _words(text: str) -> list[str]:
    return WORD_PATTERN.findall(text)


def _has_metric(text: str) -> bool:
    return bool(NUMBER_PATTERN.search(text))


def _bullet_reasons(text: str) -> list[str]:
    reasons: list[str] = []
    words = _words(text)
    if WEAK_VERB_PATTERN.search(text):
        reasons.append("Starts with a weak or generic verb.")
    if len(words) < 8:
        reasons.append("Bullet is very short and may lack context.")
    if len(words) > 34:
        reasons.append("Bullet is long and may be hard for recruiters to scan.")
    return reasons


def _sentence_snippet(text: str, keyword: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= 160:
        return cleaned

    normalized = cleaned.lower()
    candidates = [keyword.lower(), *_keyword_aliases(keyword)]
    index = -1
    for candidate in candidates:
        index = normalized.find(candidate.lower())
        if index >= 0:
            break
    if index < 0:
        return f"{cleaned[:157]}..."

    start = max(0, index - 60)
    end = min(len(cleaned), index + 100)
    prefix = "..." if start else ""
    suffix = "..." if end < len(cleaned) else ""
    return f"{prefix}{cleaned[start:end]}{suffix}"


def _best_confidence(values: Iterable[str]) -> str:
    best = "none"
    for value in values:
        if CONFIDENCE_RANK.get(value, 0) > CONFIDENCE_RANK[best]:
            best = value
    return best


class ResumeAnalyzer:
    def analyze(self, resume: Resume, target_role: str = "", target_company: str = "") -> AnalyzeResumeResponse:
        keywords = self._target_keywords(target_role, target_company)
        text_sources = list(self._text_sources(resume))
        keyword_evidence = self._keyword_evidence(keywords, text_sources)
        keyword_matches = self._keyword_matches(keyword_evidence)
        matched_keywords = [evidence.keyword for evidence in keyword_evidence if evidence.confidence in {"high", "medium"}]
        missing_keywords = [evidence.keyword for evidence in keyword_evidence if evidence.confidence not in {"high", "medium"}]
        weak_bullets = self._weak_bullets(resume)
        missing_metrics = self._missing_metrics(resume)
        section_issues = self._section_issues(resume, missing_keywords, target_company, target_role)
        bullet_quality = self._bullet_quality(resume)
        section_score_breakdown = self._section_score_breakdown(resume, keyword_evidence, bullet_quality)
        missing_keyword_suggestions = self._missing_keyword_suggestions(
            resume,
            missing_keywords,
            keyword_evidence,
            target_role,
            target_company,
        )
        improvement_checklist = self._improvement_checklist(
            resume,
            missing_keywords,
            target_role,
            target_company,
        )

        weighted_coverage = self._weighted_keyword_coverage(keyword_evidence, len(keywords))
        bullet_count = self._bullet_count(resume)
        weak_ratio = len(weak_bullets) / bullet_count if bullet_count else 1
        metric_ratio = 1 - (len(missing_metrics) / bullet_count) if bullet_count else 0
        section_score = self._section_score(resume)
        contact_score = self._contact_score(resume)

        ats_score = _bounded_score(
            weighted_coverage * 42
            + section_score * 24
            + contact_score * 10
            + max(0, 1 - weak_ratio) * 12
            + metric_ratio * 12
        )
        recruiter_score = self._recruiter_readability_score(resume, weak_bullets)
        role_fit_score = _bounded_score(weighted_coverage * 82 + section_score * 18)
        company_fit_score = _bounded_score(
            weighted_coverage * 100 if target_company else weighted_coverage * 80 + section_score * 20
        )

        return AnalyzeResumeResponse(
            ats_score=ats_score,
            recruiter_readability_score=recruiter_score,
            role_fit_score=role_fit_score,
            company_fit_score=company_fit_score,
            missing_keywords=missing_keywords,
            matched_keywords=matched_keywords,
            keyword_matches=keyword_matches,
            weak_bullets=weak_bullets,
            missing_metrics=missing_metrics,
            section_quality_issues=section_issues,
            keyword_evidence=keyword_evidence,
            missing_keyword_suggestions=missing_keyword_suggestions,
            bullet_quality=bullet_quality,
            improvement_checklist=improvement_checklist,
            section_score_breakdown=section_score_breakdown,
        )

    def _target_keywords(self, target_role: str, target_company: str) -> list[str]:
        role = target_role.lower()
        company = target_company.lower()
        if "infosys" in company and "software" in role and "engineer" in role:
            return INFOSYS_SOFTWARE_ENGINEER_KEYWORDS
        if "software" in role and "engineer" in role:
            return SOFTWARE_ENGINEER_KEYWORDS
        return SOFTWARE_ENGINEER_KEYWORDS[:8]

    def _keyword_evidence(self, keywords: list[str], text_sources: list[TextSource]) -> list[KeywordEvidence]:
        evidence_rows: list[KeywordEvidence] = []
        for keyword in keywords:
            locations: list[str] = []
            matched_text: list[str] = []
            confidences: list[str] = []

            for source in text_sources:
                confidence = _keyword_match_confidence(source.text, keyword, source.confidence_bucket)
                if confidence is None:
                    continue

                locations.append(source.location)
                matched_text.append(_sentence_snippet(source.text, keyword))
                confidences.append(confidence)

            confidence = _best_confidence(confidences)
            evidence_rows.append(
                KeywordEvidence(
                    keyword=keyword,
                    found=bool(locations),
                    locations=locations,
                    matched_text=matched_text,
                    confidence=confidence if locations else "none",
                )
            )

        return evidence_rows

    def _keyword_matches(self, keyword_evidence: list[KeywordEvidence]) -> list[KeywordMatch]:
        matches: list[KeywordMatch] = []
        for evidence in keyword_evidence:
            present = evidence.confidence in {"high", "medium"}
            matches.append(KeywordMatch(keyword=evidence.keyword, present=present, sources=evidence.locations))
        return matches

    def _text_sources(self, resume: Resume) -> Iterable[TextSource]:
        if resume.professional_summary:
            yield TextSource("professional_summary", resume.professional_summary, "summary", "medium")

        for skill in resume.skills:
            yield TextSource(f"skills:{skill.category}", " ".join([skill.category, *skill.items]), "skills", "high")

        for index, item in enumerate(resume.experience):
            yield TextSource(f"experience:{index}:title", f"{item.title} {item.company}", "experience_title", "high")
            for bullet_index, bullet in enumerate(item.bullets):
                yield TextSource(
                    f"experience:{index}:bullet:{bullet_index}",
                    bullet,
                    "experience_bullet",
                    "medium",
                )

        for index, project in enumerate(resume.projects):
            yield TextSource(
                f"projects:{index}:title",
                " ".join([project.name, project.role or ""]),
                "project_title",
                "high",
            )
            if project.technologies:
                yield TextSource(
                    f"projects:{index}:technologies",
                    " ".join(project.technologies),
                    "project_technologies",
                    "high",
                )
            for bullet_index, bullet in enumerate(project.bullets):
                yield TextSource(f"projects:{index}:bullet:{bullet_index}", bullet, "project_bullet", "medium")

        for index, education in enumerate(resume.education):
            yield TextSource(
                f"education:{index}",
                " ".join([education.institution, education.degree, *(education.coursework or [])]),
                "education",
                "high",
            )

        for index, certification in enumerate(resume.certifications):
            yield TextSource(
                f"certifications:{index}",
                f"{certification.title} {certification.issuer or ''}",
                "certification",
                "high",
            )

        for index, achievement in enumerate(resume.achievements):
            yield TextSource(
                f"achievements:{index}",
                f"{achievement.title} {achievement.description or ''}",
                "achievement",
                "medium",
            )

    def _weak_bullets(self, resume: Resume) -> list[BulletFinding]:
        findings: list[BulletFinding] = []
        for section, item_index, label, bullet_index, bullet in self._iter_bullets(resume):
            reasons = _bullet_reasons(bullet)
            if reasons:
                findings.append(
                    BulletFinding(
                        section=section,
                        item_index=item_index,
                        bullet_index=bullet_index,
                        label=label,
                        original=bullet,
                        reasons=reasons,
                    )
                )
        return findings

    def _bullet_quality(self, resume: Resume) -> list[BulletQuality]:
        quality_rows: list[BulletQuality] = []
        for section, item_index, label, bullet_index, bullet in self._iter_bullets(resume):
            weakness_types = self._bullet_weakness_types(bullet)
            score = 10
            penalties = {
                "weak verb": 2,
                "no metric": 2,
                "too vague": 2,
                "too short": 2,
                "too long": 1,
                "lacks technical method": 1,
            }
            for weakness in weakness_types:
                score -= penalties.get(weakness, 1)
            score = max(1, min(10, score))
            reason = (
                "Strong bullet with action, technical context, and measurable signal."
                if not weakness_types
                else f"Needs improvement: {', '.join(weakness_types)}."
            )
            quality_rows.append(
                BulletQuality(
                    section=section,
                    item_index=item_index,
                    bullet_index=bullet_index,
                    label=label,
                    original=bullet,
                    score=score,
                    weakness_types=weakness_types,
                    reason=reason,
                )
            )
        return quality_rows

    def _bullet_weakness_types(self, bullet: str) -> list[str]:
        weaknesses: list[str] = []
        words = _words(bullet)
        if WEAK_VERB_PATTERN.search(bullet):
            weaknesses.append("weak verb")
        if not _has_metric(bullet):
            weaknesses.append("no metric")
        if VAGUE_TERMS_PATTERN.search(bullet):
            weaknesses.append("too vague")
        if len(words) < 8:
            weaknesses.append("too short")
        if len(words) > 34:
            weaknesses.append("too long")
        if not TECHNICAL_METHOD_PATTERN.search(bullet):
            weaknesses.append("lacks technical method")
        return weaknesses

    def _missing_metrics(self, resume: Resume) -> list[BulletFinding]:
        findings: list[BulletFinding] = []
        for section, item_index, label, bullet_index, bullet in self._iter_bullets(resume):
            if not _has_metric(bullet):
                findings.append(
                    BulletFinding(
                        section=section,
                        item_index=item_index,
                        bullet_index=bullet_index,
                        label=label,
                        original=bullet,
                        reasons=["No measurable outcome or scale is present."],
                    )
                )
        return findings

    def _section_issues(
        self,
        resume: Resume,
        missing_keywords: list[str],
        target_company: str,
        target_role: str,
    ) -> list[SectionQualityIssue]:
        issues: list[SectionQualityIssue] = []

        if not resume.professional_summary:
            issues.append(
                SectionQualityIssue(
                    section="professional_summary",
                    severity="medium",
                    message="Add a concise summary aligned to the target role.",
                )
            )
        elif len(_words(resume.professional_summary)) < 18:
            issues.append(
                SectionQualityIssue(
                    section="professional_summary",
                    severity="low",
                    message="Professional summary is short; add role-specific context if truthful.",
                )
            )

        if not resume.skills:
            issues.append(
                SectionQualityIssue(section="skills", severity="high", message="Skills section is missing.")
            )
        if not resume.projects:
            issues.append(
                SectionQualityIssue(section="projects", severity="high", message="Projects section is missing.")
            )
        if not resume.education:
            issues.append(
                SectionQualityIssue(section="education", severity="medium", message="Education section is missing.")
            )
        if target_company and target_role and missing_keywords:
            issues.append(
                SectionQualityIssue(
                    section="target_fit",
                    severity="medium",
                    message="Some target keywords are absent from the current resume data; show them as suggestions only.",
                )
            )

        return issues

    def _missing_keyword_suggestions(
        self,
        resume: Resume,
        missing_keywords: list[str],
        keyword_evidence: list[KeywordEvidence],
        target_role: str,
        target_company: str,
    ) -> list[MissingKeywordSuggestion]:
        evidence_by_keyword = {evidence.keyword: evidence for evidence in keyword_evidence}
        suggestions: list[MissingKeywordSuggestion] = []

        for keyword in missing_keywords:
            evidence = evidence_by_keyword.get(keyword)
            locations: list[str] = []
            safe_to_add = False
            requires_real_knowledge = True
            reason = "Only add this keyword if it is truthful and backed by your real knowledge or experience."

            if keyword in {"Java", "SQL"}:
                locations = ["skills", "project bullet"]
                reason = f"{keyword} is a concrete technical skill; do not add it unless you can use it in interviews."
            elif keyword in {"Data Structures", "Algorithms", "OOP"}:
                locations = ["skills", "education coursework", "project bullet"]
                safe_to_add = self._has_coursework_or_project_support(resume, keyword, evidence)
                reason = (
                    "Safe to mention only if coursework or project work already supports it."
                    if safe_to_add
                    else "This needs real coursework or project evidence before adding."
                )
            elif keyword in {"Problem Solving", "Debugging", "Software Development"}:
                locations = ["professional summary", "project bullet", "experience bullet"]
                safe_to_add = bool(resume.projects or resume.experience)
                reason = (
                    "Can be framed through existing project or experience bullets if the wording stays truthful."
                    if safe_to_add
                    else "Needs project or experience evidence before adding."
                )
            elif keyword == "REST API":
                locations = ["project technologies", "project bullet"]
                safe_to_add = self._has_api_support(resume, evidence)
                reason = (
                    "Can be added only where existing API/framework work supports it."
                    if safe_to_add
                    else "Needs real REST API implementation experience before adding."
                )
            else:
                locations = ["skills", "project bullet"]

            suggestions.append(
                MissingKeywordSuggestion(
                    keyword=keyword,
                    safe_to_add=safe_to_add,
                    suggested_locations=locations,
                    requires_real_knowledge=requires_real_knowledge,
                    reason=reason,
                )
            )

        return suggestions

    def _has_coursework_or_project_support(
        self,
        resume: Resume,
        keyword: str,
        evidence: KeywordEvidence | None,
    ) -> bool:
        if evidence and evidence.found:
            return True
        searchable = " ".join(
            [
                *(course for education in resume.education for course in education.coursework),
                *(project.name for project in resume.projects),
                *(technology for project in resume.projects for technology in project.technologies),
                *(bullet for project in resume.projects for bullet in project.bullets),
            ]
        )
        return _alias_keyword_match(searchable, keyword) or _partial_keyword_match(searchable, keyword)

    def _has_api_support(self, resume: Resume, evidence: KeywordEvidence | None) -> bool:
        if evidence and evidence.found:
            return True
        searchable = " ".join(
            [
                *(technology for project in resume.projects for technology in project.technologies),
                *(bullet for project in resume.projects for bullet in project.bullets),
            ]
        )
        return bool(re.search(r"\b(api|fastapi|flask|django|endpoint|backend)\b", searchable, re.IGNORECASE))

    def _improvement_checklist(
        self,
        resume: Resume,
        missing_keywords: list[str],
        target_role: str,
        target_company: str,
    ) -> list[ImprovementChecklistItem]:
        checklist: list[ImprovementChecklistItem] = []
        is_infosys_software_engineer = (
            "infosys" in target_company.lower()
            and "software" in target_role.lower()
            and "engineer" in target_role.lower()
        )

        if is_infosys_software_engineer:
            checklist.append(
                ImprovementChecklistItem(
                    text="Add SQL only if I know SQL.",
                    priority="high" if "SQL" in missing_keywords else "low",
                    completed="SQL" not in missing_keywords,
                )
            )
            checklist.append(
                ImprovementChecklistItem(
                    text="Add Java only if I know Java.",
                    priority="high" if "Java" in missing_keywords else "low",
                    completed="Java" not in missing_keywords,
                )
            )

        has_motor_fault_project = any(
            "motor" in project.name.lower() and "fault" in project.name.lower() for project in resume.projects
        )
        checklist.append(
            ImprovementChecklistItem(
                text=(
                    "Add one measurable metric to Motor Fault project."
                    if has_motor_fault_project
                    else "Add one measurable metric to Motor Fault project or the strongest technical project."
                ),
                priority="high",
                completed=any(_has_metric(bullet) for project in resume.projects for bullet in project.bullets),
            )
        )
        checklist.append(
            ImprovementChecklistItem(
                text="Strengthen achievements section.",
                priority="medium",
                completed=bool(resume.achievements),
            )
        )
        checklist.append(
            ImprovementChecklistItem(
                text="Keep resume to one page.",
                priority="medium",
                completed=True,
            )
        )
        return checklist

    def _section_score_breakdown(
        self,
        resume: Resume,
        keyword_evidence: list[KeywordEvidence],
        bullet_quality: list[BulletQuality],
    ) -> list[SectionScoreBreakdown]:
        keyword_score = _bounded_score(self._weighted_keyword_coverage(keyword_evidence, len(keyword_evidence)) * 100)
        bullet_score = _bounded_score(
            (sum(row.score for row in bullet_quality) / (len(bullet_quality) * 10)) * 100
        ) if bullet_quality else 35
        rows = [
            SectionScoreBreakdown(
                section="Header",
                score=_bounded_score(self._contact_score(resume) * 100),
                reason="Name, email, phone, and professional links are checked.",
            ),
            SectionScoreBreakdown(
                section="Summary",
                score=85 if resume.professional_summary and len(_words(resume.professional_summary)) >= 18 else 55,
                reason="Summary should be concise and aligned to the target role.",
            ),
            SectionScoreBreakdown(
                section="Skills",
                score=keyword_score,
                reason="Score reflects high/medium confidence target keyword coverage.",
            ),
            SectionScoreBreakdown(
                section="Projects and Experience Bullets",
                score=bullet_score,
                reason="Score averages bullet quality across action, metrics, specificity, and technical method.",
            ),
            SectionScoreBreakdown(
                section="Education",
                score=90 if resume.education else 35,
                reason="Education is expected for early-career software engineering applications.",
            ),
            SectionScoreBreakdown(
                section="Achievements",
                score=85 if resume.achievements else 45,
                reason="Achievements strengthen recruiter readability when they are specific and credible.",
            ),
        ]
        return rows

    def _weighted_keyword_coverage(self, keyword_evidence: list[KeywordEvidence], keyword_count: int) -> float:
        if keyword_count <= 0:
            return 1
        total = sum(CONFIDENCE_WEIGHT.get(evidence.confidence, 0.0) for evidence in keyword_evidence)
        return min(1, total / keyword_count)

    def _section_score(self, resume: Resume) -> float:
        checks = [
            bool(resume.professional_summary),
            bool(resume.skills),
            bool(resume.projects),
            bool(resume.education),
            bool(resume.experience or resume.achievements),
        ]
        return sum(checks) / len(checks)

    def _contact_score(self, resume: Resume) -> float:
        checks = [
            bool(resume.header.full_name),
            bool(resume.header.email),
            bool(resume.header.phone),
            bool(resume.header.linkedin or resume.header.github or resume.header.portfolio),
        ]
        return sum(checks) / len(checks)

    def _recruiter_readability_score(self, resume: Resume, weak_bullets: list[BulletFinding]) -> int:
        score = 100
        bullet_count = self._bullet_count(resume)
        if bullet_count == 0:
            return 35

        score -= min(32, len(weak_bullets) * 5)
        for _, _, _, _, bullet in self._iter_bullets(resume):
            word_count = len(_words(bullet))
            if word_count > 34:
                score -= 4
            elif word_count < 8:
                score -= 3

        if resume.professional_summary and len(_words(resume.professional_summary)) > 75:
            score -= 8
        return _bounded_score(score)

    def _bullet_count(self, resume: Resume) -> int:
        return sum(1 for _ in self._iter_bullets(resume))

    def _iter_bullets(self, resume: Resume) -> Iterable[tuple[str, int, str, int, str]]:
        for item_index, item in enumerate(resume.experience):
            label = f"{item.title} at {item.company}"
            for bullet_index, bullet in enumerate(item.bullets):
                yield "experience", item_index, label, bullet_index, bullet

        for item_index, project in enumerate(resume.projects):
            for bullet_index, bullet in enumerate(project.bullets):
                yield "projects", item_index, project.name, bullet_index, bullet
