from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


class LaTeXCompilerError(RuntimeError):
    """Base exception for LaTeX compilation failures."""


class LaTeXCompilerNotFound(LaTeXCompilerError):
    """Raised when neither Tectonic nor pdflatex is available."""


class LaTeXCompilationFailed(LaTeXCompilerError):
    """Raised when the LaTeX compiler returns an error."""


@dataclass(frozen=True)
class CompilerBinary:
    name: str
    path: str


class LatexCompiler:
    ALLOWED_COMPILERS = ("tectonic", "pdflatex")

    def __init__(self, preferred: str = "tectonic", fallback: str = "pdflatex", timeout_seconds: int = 30) -> None:
        self.preferred = preferred
        self.fallback = fallback
        self.timeout_seconds = timeout_seconds

    def available_compiler(self) -> str | None:
        """Return the name of an installed LaTeX compiler, or None if absent."""
        try:
            return self._resolve_compiler().name
        except LaTeXCompilerNotFound:
            return None

    def compile(self, tex_source: str) -> bytes:
        compiler = self._resolve_compiler()

        with tempfile.TemporaryDirectory(prefix="resume-build-") as temp_dir:
            workdir = Path(temp_dir)
            tex_path = workdir / "resume.tex"
            pdf_path = workdir / "resume.pdf"
            tex_path.write_text(tex_source, encoding="utf-8")

            if compiler.name == "tectonic":
                self._run_tectonic(compiler.path, workdir)
            else:
                self._run_pdflatex(compiler.path, workdir)

            if not pdf_path.exists():
                raise LaTeXCompilationFailed("The LaTeX compiler finished without producing a PDF.")

            return pdf_path.read_bytes()

    def _resolve_compiler(self) -> CompilerBinary:
        env_choice = os.getenv("LATEX_COMPILER", "").strip().lower()
        candidates = [env_choice, self.preferred, self.fallback]

        for candidate in candidates:
            if candidate not in self.ALLOWED_COMPILERS:
                continue
            path = shutil.which(candidate)
            if path:
                return CompilerBinary(name=candidate, path=path)

        raise LaTeXCompilerNotFound("No supported LaTeX compiler found. Install tectonic or pdflatex.")

    def _run_tectonic(self, compiler_path: str, workdir: Path) -> None:
        command = [compiler_path, "resume.tex", "--outdir", str(workdir)]
        result = self._run(command, workdir)
        if result.returncode != 0:
            raise LaTeXCompilationFailed(self._format_error("Tectonic", result))

    def _run_pdflatex(self, compiler_path: str, workdir: Path) -> None:
        command = [
            compiler_path,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            "resume.tex",
        ]

        first_pass = self._run(command, workdir)
        if first_pass.returncode != 0:
            raise LaTeXCompilationFailed(self._format_error("pdflatex", first_pass))

        second_pass = self._run(command, workdir)
        if second_pass.returncode != 0:
            raise LaTeXCompilationFailed(self._format_error("pdflatex", second_pass))

    def _run(self, command: list[str], workdir: Path) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                cwd=workdir,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise LaTeXCompilationFailed("LaTeX compilation timed out.") from exc

    @staticmethod
    def _format_error(compiler_name: str, result: subprocess.CompletedProcess[str]) -> str:
        combined_log = "\n".join(part for part in [result.stdout, result.stderr] if part)
        tail = combined_log[-4000:].strip()
        if not tail:
            tail = "No compiler log was returned."
        return f"{compiler_name} failed to compile the resume.\n{tail}"

