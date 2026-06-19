from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models.resume_models import DEFAULT_SECTION_ORDER, Resume, SectionName
from app.services.latex_compiler import LatexCompiler
from app.utils.latex_escape import clean_data, escape_latex

SECTION_TITLES = {
    SectionName.PROFESSIONAL_SUMMARY.value: "Professional Summary",
    SectionName.SKILLS.value: "Skills",
    SectionName.EXPERIENCE.value: "Experience",
    SectionName.PROJECTS.value: "Projects",
    SectionName.EDUCATION.value: "Education",
    SectionName.CERTIFICATIONS.value: "Certifications",
    SectionName.ACHIEVEMENTS.value: "Achievements",
}

SAFE_HREF_REPLACEMENTS = {
    "\\": "",
    "{": "",
    "}": "",
    "%": r"\%",
    "#": r"\#",
    "&": r"\&",
    "_": r"\_",
}


def _latex_href_target(value: str) -> str:
    normalized = re.sub(r"\s+", "", value.strip())
    return "".join(SAFE_HREF_REPLACEMENTS.get(char, char) for char in normalized)


def _normalize_web_url(value: str | None) -> str | None:
    if not value:
        return None

    cleaned = re.sub(r"\s+", "", value.strip())
    if not cleaned:
        return None

    parsed = urlsplit(cleaned)
    if not parsed.scheme:
        cleaned = f"https://{cleaned}"
        parsed = urlsplit(cleaned)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    return _latex_href_target(cleaned)


def _contact_items(
    raw_header: dict[str, Any], escaped_header: dict[str, Any]
) -> dict[str, list[dict[str, str | None]]]:
    items: list[dict[str, str | None]] = []
    links: list[dict[str, str | None]] = []

    if raw_header.get("email"):
        items.append(
            {
                "label": escaped_header["email"],
                "href": _latex_href_target(f"mailto:{raw_header['email']}"),
            }
        )

    for field in ["phone", "location"]:
        if raw_header.get(field):
            items.append({"label": escaped_header[field], "href": None})

    for field in ["linkedin", "github", "portfolio"]:
        href = _normalize_web_url(raw_header.get(field))
        if raw_header.get(field) and href:
            links.append({"label": escaped_header[field], "href": href})

    return {"primary": items, "links": links}


class ResumeBuilder:
    def __init__(
        self,
        compiler: LatexCompiler | None = None,
        template_dir: Path | None = None,
        template_name: str = "resume_template.tex.j2",
    ) -> None:
        self.compiler = compiler or LatexCompiler()
        self.template_name = template_name
        self.template_dir = template_dir or Path(__file__).resolve().parents[1] / "templates"
        self.environment = Environment(
            loader=FileSystemLoader(str(self.template_dir)),
            autoescape=select_autoescape(default=False),
            block_start_string="((*",
            block_end_string="*))",
            variable_start_string="(((",
            variable_end_string=")))",
            comment_start_string="((#",
            comment_end_string="#))",
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def render_tex(self, resume: Resume) -> str:
        raw_resume = clean_data(resume.model_dump(mode="json"))
        escaped_resume = escape_latex(raw_resume)
        escaped_resume["ordered_sections"] = self._visible_sections(raw_resume)
        contact_groups = _contact_items(raw_resume["header"], escaped_resume["header"])
        escaped_resume["header"]["primary_contact_items"] = contact_groups["primary"]
        escaped_resume["header"]["link_contact_items"] = contact_groups["links"]

        template = self.environment.get_template(self.template_name)
        return template.render(resume=escaped_resume, section_titles=SECTION_TITLES)

    def generate_pdf(self, resume: Resume) -> bytes:
        tex_source = self.render_tex(resume)
        return self.compiler.compile(tex_source)

    def _visible_sections(self, resume_data: dict[str, Any]) -> list[str]:
        requested_order = resume_data.get("section_order") or [section.value for section in DEFAULT_SECTION_ORDER]
        visible_sections: list[str] = []

        for section in requested_order:
            if section == SectionName.PROFESSIONAL_SUMMARY.value and resume_data.get("professional_summary"):
                visible_sections.append(section)
            elif section in {
                SectionName.SKILLS.value,
                SectionName.EXPERIENCE.value,
                SectionName.PROJECTS.value,
                SectionName.EDUCATION.value,
                SectionName.CERTIFICATIONS.value,
                SectionName.ACHIEVEMENTS.value,
            } and resume_data.get(section):
                visible_sections.append(section)

        return visible_sections
