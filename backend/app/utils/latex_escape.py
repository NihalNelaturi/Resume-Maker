from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any


CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MULTISPACE = re.compile(r"[ \t]+")

LATEX_REPLACEMENTS = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def clean_string(value: str) -> str:
    normalized = CONTROL_CHARS.sub("", value)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    lines = [MULTISPACE.sub(" ", line).strip() for line in normalized.split("\n")]
    return "\n".join(line for line in lines if line)


def escape_latex_text(value: str) -> str:
    cleaned = clean_string(value)
    return "".join(LATEX_REPLACEMENTS.get(char, char) for char in cleaned)


def clean_data(value: Any) -> Any:
    if isinstance(value, str):
        return clean_string(value)
    if isinstance(value, list):
        return [clean_data(item) for item in value]
    if isinstance(value, Mapping):
        return {key: clean_data(item) for key, item in value.items()}
    return value


def escape_latex(value: Any) -> Any:
    if isinstance(value, str):
        return escape_latex_text(value)
    if isinstance(value, list):
        return [escape_latex(item) for item in value]
    if isinstance(value, Mapping):
        return {key: escape_latex(item) for key, item in value.items()}
    return value

