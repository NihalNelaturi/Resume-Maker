"""Shared, data-driven keyword knowledge for resume and job-description analysis.

This module replaces the previous hard-coded, person-specific keyword lists
(the "Infosys Software Engineer" list and the "Motor Fault" project lookup).
Both the resume analyzer and the job-description analyzer read role keyword
sets, alias mappings, and keyword categories from here so the engine
generalizes to any role rather than one specific resume.
"""

from __future__ import annotations

import re


# Canonical keyword -> list of accepted surface forms (aliases). The canonical
# form is always included implicitly by the lookup helpers below.
KEYWORD_ALIASES: dict[str, list[str]] = {
    "C++": ["cpp"],
    "C#": ["c sharp", "csharp"],
    "OOP": ["object oriented", "object-oriented", "object oriented programming"],
    "REST API": [
        "rest api", "restful api", "restful", "api", "apis", "api endpoint", "api endpoints",
        "fastapi", "flask", "django", "express", "spring boot",
    ],
    "Problem Solving": ["problem solving", "problem-solving", "analytical skills", "solved"],
    "Software Development": ["software development", "software engineering", "application development"],
    "Data Structures": ["data structures", "data structure", "dsa"],
    "Algorithms": ["algorithms", "algorithm", "dsa"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "React": ["react", "react.js", "reactjs"],
    "Node.js": ["node.js", "nodejs", "node"],
    "CI/CD": ["ci/cd", "continuous integration", "continuous deployment"],
    "Docker": ["docker", "containerization"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Linux": ["linux", "unix"],
    "AWS": ["aws", "amazon web services"],
    "GCP": ["gcp", "google cloud"],
    "PostgreSQL": ["postgresql", "postgres"],
    "Database": ["database", "databases", "dbms"],
    "Git": ["git", "version control"],
    "Testing": ["testing", "test cases", "qa"],
    "Unit Testing": ["unit testing", "unit tests"],
    "Debugging": ["debugging", "troubleshooting"],
    "Agile": ["agile", "scrum"],
    "Tailwind CSS": ["tailwind css", "tailwind"],
    "Machine Learning": ["machine learning", "ml"],
    "Deep Learning": ["deep learning", "neural networks"],
    "Embedded Systems": ["embedded systems", "embedded"],
    "Data Analysis": ["data analysis", "data analytics", "analytics"],
    "Data Visualization": ["data visualization", "dashboards", "tableau", "power bi"],
    "NLP": ["nlp", "natural language processing"],
}


# Keyword classification controls how missing-keyword suggestions are framed.
#   hard            -> concrete tool/skill; never auto-safe to add.
#   conceptual      -> safe to surface only if coursework/projects support it.
#   project_context -> can be framed through existing project/experience bullets.
CONCEPTUAL_KEYWORDS: frozenset[str] = frozenset({"Data Structures", "Algorithms", "OOP"})
PROJECT_CONTEXT_KEYWORDS: frozenset[str] = frozenset(
    {"Problem Solving", "Debugging", "Software Development", "Agile", "Testing", "Unit Testing"}
)


def classify_keyword(keyword: str) -> str:
    if keyword in CONCEPTUAL_KEYWORDS:
        return "conceptual"
    if keyword in PROJECT_CONTEXT_KEYWORDS:
        return "project_context"
    return "hard"


# Role keyword profiles. Each profile lists the trigger tokens that identify the
# role from a free-text target role, plus the keyword set to score against.
GENERIC_KEYWORDS: list[str] = [
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

ROLE_PROFILES: list[dict[str, list[str]]] = [
    {
        "triggers": ["frontend", "front end", "front-end", "ui developer", "web developer"],
        "keywords": [
            "JavaScript", "TypeScript", "React", "HTML", "CSS", "Tailwind CSS",
            "REST API", "Git", "Testing", "Debugging", "Problem Solving",
        ],
    },
    {
        "triggers": ["backend", "back end", "back-end", "api developer"],
        "keywords": [
            "Python", "Java", "SQL", "REST API", "Database", "Docker",
            "Git", "Testing", "Data Structures", "Algorithms", "Debugging", "Linux",
        ],
    },
    {
        "triggers": ["full stack", "fullstack", "full-stack"],
        "keywords": [
            "JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL",
            "REST API", "Database", "Git", "Docker", "Testing", "Problem Solving",
        ],
    },
    {
        "triggers": ["data scientist", "machine learning", "ml engineer", "ai engineer"],
        "keywords": [
            "Python", "Machine Learning", "Deep Learning", "SQL", "Data Analysis",
            "Algorithms", "Data Visualization", "NLP", "Git", "Problem Solving",
        ],
    },
    {
        "triggers": ["data analyst", "business analyst", "analytics"],
        "keywords": [
            "SQL", "Python", "Data Analysis", "Data Visualization", "Database",
            "Problem Solving", "Excel", "Statistics", "Git",
        ],
    },
    {
        "triggers": ["devops", "site reliability", "sre", "platform engineer", "cloud engineer"],
        "keywords": [
            "Linux", "Docker", "Kubernetes", "CI/CD", "AWS", "GCP",
            "Python", "Git", "Database", "Debugging",
        ],
    },
    {
        "triggers": ["software engineer", "software developer", "sde", "programmer"],
        "keywords": [
            "Python", "Java", "C++", "SQL", "Data Structures", "Algorithms",
            "OOP", "REST API", "Git", "Testing", "Debugging", "Problem Solving",
        ],
    },
]


def select_role_keywords(target_role: str) -> list[str]:
    """Pick the keyword set for the best-matching role profile.

    Matching is token-based against each profile's triggers; the profile with
    the most trigger hits wins. Falls back to a generic software keyword set
    when no role is provided or nothing matches.
    """
    role = (target_role or "").lower().strip()
    if not role:
        return list(GENERIC_KEYWORDS)

    best_profile: dict[str, list[str]] | None = None
    best_score = 0
    for profile in ROLE_PROFILES:
        score = sum(1 for trigger in profile["triggers"] if trigger in role)
        if score > best_score:
            best_score = score
            best_profile = profile

    if best_profile is None:
        return list(GENERIC_KEYWORDS)
    return list(best_profile["keywords"])


def keyword_surface_forms(keyword: str) -> list[str]:
    """Canonical keyword plus its known aliases, lowercased and de-duplicated."""
    forms = [keyword.lower(), *KEYWORD_ALIASES.get(keyword, [])]
    seen: list[str] = []
    for form in forms:
        normalized = form.strip().lower()
        if normalized and normalized not in seen:
            seen.append(normalized)
    return seen


# Keywords the JD extractor will look for in free-text job descriptions.
JD_VOCABULARY: list[str] = sorted(
    {
        *GENERIC_KEYWORDS,
        *(keyword for profile in ROLE_PROFILES for keyword in profile["keywords"]),
        *KEYWORD_ALIASES.keys(),
        "Java", "C", "C#", "FastAPI", "Flask", "Django", "MySQL", "MongoDB",
        "Azure", "GitHub", "HTML", "CSS", "Pydantic", "SQLAlchemy", "Excel", "Statistics",
    }
)


def _word_boundary_match(text_lower: str, surface: str) -> bool:
    if "+" in surface or "#" in surface:
        # '+'/'#' are not word characters; substring match is correct here.
        return surface in text_lower
    pattern = rf"(?<![a-z0-9+#]){re.escape(surface)}(?![a-z0-9+#])"
    return bool(re.search(pattern, text_lower))


def text_contains_keyword(text: str, keyword: str) -> bool:
    text_lower = (text or "").lower()
    return any(_word_boundary_match(text_lower, surface) for surface in keyword_surface_forms(keyword))


def extract_keywords_from_text(text: str) -> list[str]:
    """Return JD vocabulary keywords present in the given free text, in order."""
    return [keyword for keyword in JD_VOCABULARY if text_contains_keyword(text, keyword)]
