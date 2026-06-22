# Resume Maker

A professional full-stack resume generator that collects structured resume data, validates it with FastAPI and Pydantic, renders a Jinja2-powered LaTeX template, compiles it into a clean ATS-friendly PDF, and lets users preview or download the final resume.

## Architecture

```text
User
  -> React + Tailwind CSS frontend
  -> FastAPI backend
  -> Pydantic validation
  -> Resume Builder service
  -> Jinja2 template engine
  -> LaTeX resume template
  -> Tectonic or pdflatex compiler
  -> Final PDF resume
  -> Preview / download
```

## Features

- Structured resume builder form
- Header, summary, skills, experience, projects, education, certifications, and achievements
- Add and remove skill groups, experience bullets, project bullets, projects, education, certifications, and achievements
- Import an existing resume (PDF / DOCX / TXT / paste) to auto-fill the profile
- Configurable resume section ordering
- Live structured resume preview
- Instant in-browser PDF generation (primary engine) with six selectable
  templates (Classic, Modern Blue, Compact, Elegant Serif, Technical,
  Executive) and customization: auto-fit-to-one-page, paper size (Letter/A4),
  font size, and accent color
- Optional LaTeX PDF generation through the FastAPI backend (local/Docker only)
- Role-aware resume and job-description analysis driven by a data-driven keyword
  library (no person- or company-specific hardcoding)
- PDF preview and download in the frontend
- Clickable email, GitHub, LinkedIn, and portfolio links in generated PDFs
- SQLite draft persistence
- LaTeX escaping for user-provided input
- Temporary-folder PDF compilation
- Docker support with LaTeX installed in the backend image

## Project Structure

```text
resume-maker/
  backend/
    app/
      main.py
      models/
      routes/
      services/
      templates/
      database/
      utils/
    api/
    Dockerfile
    requirements.txt
    vercel.json

  frontend/
    src/
      components/
      pages/
      services/
      App.jsx
      main.jsx
    Dockerfile
    package.json
    tailwind.config.js

  docker-compose.yml
  README.md
```

## Prerequisites

- Docker Desktop for the easiest full setup
- Node.js 22+ and npm for frontend development
- Python 3.12+ for backend development
- `pdflatex` or `tectonic` if running the backend outside Docker

## Run With Docker

From the project root:

```powershell
docker compose up --build
```

Open:

```text
Frontend: http://127.0.0.1:3000
Backend docs: http://127.0.0.1:8000/docs
```

The Docker backend includes TeX Live packages, so PDF generation works without installing LaTeX on Windows.

## Run Backend Locally

```powershell
cd C:\Users\195713940230\Desktop\ResMake\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"status":"ok"}
```

PDF generation requires `pdflatex` or `tectonic` to be available in `PATH` when running outside Docker.

## Run Frontend Locally

```powershell
cd C:\Users\195713940230\Desktop\ResMake\frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend uses this API base URL by default:

```text
http://127.0.0.1:8000
```

To override it:

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:8000"
npm run dev
```

## PDF Generation

The frontend generates PDFs **in the browser** by default (jsPDF), so PDF export
works instantly everywhere, including the Vercel deployment, with no LaTeX
dependency. Pick a template in the Export step; the choice is remembered locally.

The FastAPI backend also exposes a LaTeX-based generator (`/api/resume/generate`)
that produces a more typographically refined PDF, but it requires `tectonic` or
`pdflatex` and therefore only runs locally or in Docker — not on Vercel
serverless.

## Development

Backend tests and lint:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
pytest -q
ruff check .
```

Frontend build:

```powershell
cd frontend
npm ci
npm run build
```

Continuous integration (`.github/workflows/ci.yml`) runs backend ruff + pytest
and a frontend production build on every push and pull request.

## API Endpoints

```text
GET    /api/health
POST   /api/resume/generate
POST   /api/resume/save
GET    /api/resume/{id}
PUT    /api/resume/{id}
DELETE /api/resume/{id}
```

## Example PDF Request

```json
{
  "header": {
    "full_name": "Nihal Test",
    "email": "nihal@example.com",
    "phone": "+91 90000 00000",
    "location": "India",
    "linkedin": "linkedin.com/in/nihal",
    "github": "github.com/nihal",
    "portfolio": ""
  },
  "professional_summary": "Backend-focused student developer building reliable APIs and automation tools.",
  "skills": [
    {
      "category": "Languages",
      "items": ["Python", "JavaScript", "SQL"]
    }
  ],
  "experience": [
    {
      "title": "Research Intern",
      "company": "Example Research Lab",
      "location": "Hyderabad",
      "start_date": "June 2025",
      "end_date": "",
      "bullets": [
        "Worked on communication protocol concepts within a collaborative research team.",
        "Studied system workflows, simulation environments, and technical documentation."
      ]
    }
  ],
  "projects": [
    {
      "name": "Resume Maker",
      "role": "Full-stack Developer",
      "technologies": ["FastAPI", "React", "LaTeX"],
      "bullets": [
        "Built a validated resume generation API using FastAPI and Pydantic.",
        "Rendered ATS-friendly LaTeX resumes and compiled them into downloadable PDFs."
      ]
    }
  ],
  "education": [
    {
      "institution": "Example University",
      "degree": "B.Tech Computer Science",
      "score": "CGPA 8.8"
    }
  ],
  "certifications": [],
  "achievements": [],
  "section_order": [
    "professional_summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "achievements"
  ]
}
```

## Security Notes

- Pydantic rejects unknown fields and validates resume shapes.
- User strings are cleaned and escaped before LaTeX rendering.
- The compiler service only invokes an allowlisted binary: `tectonic` or `pdflatex`.
- PDF generation runs in a temporary directory.
- Temporary build files are deleted after generation.
- Arbitrary shell commands are never accepted from user input.

## Deployment Notes

Frontend:

- Deploy the `frontend` folder to Vercel.
- Set `VITE_API_BASE_URL` to the deployed backend URL.

Backend:

- Deploy the `backend` Dockerfile to Render or Railway for full PDF generation.
- Vercel can run the FastAPI API through `backend/api/index.py`, but Vercel serverless does not use the Dockerfile, so LaTeX compilation is not available there by default.

## Current Local URLs

```text
React frontend: http://127.0.0.1:5173
FastAPI backend: http://127.0.0.1:8000
FastAPI docs: http://127.0.0.1:8000/docs
```
