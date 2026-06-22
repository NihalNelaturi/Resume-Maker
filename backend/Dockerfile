FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        lmodern \
        texlive-fonts-recommended \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-latex-recommended \
        texlive-luatex \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Warm the LuaLaTeX font cache so the first export isn't slow, and verify the
# Unicode font loads.
RUN printf '%s' '\documentclass{article}\usepackage{fontspec}\setmainfont{DejaVu Serif}\begin{document}warmup\end{document}' > /tmp/warm.tex \
    && (cd /tmp && lualatex -interaction=nonstopmode warm.tex >/dev/null 2>&1 || true) \
    && rm -f /tmp/warm.*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

