import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

export async function healthCheck() {
  const response = await api.get("/api/health");
  return response.data;
}

// Probe the backend with a short timeout. Never throws — returns whether the
// backend is reachable and whether it has a LaTeX engine available.
export async function checkBackend() {
  try {
    const response = await api.get("/api/health", { timeout: 4000 });
    return {
      reachable: true,
      latex: Boolean(response.data?.latex),
      compiler: response.data?.latex_compiler || null,
    };
  } catch {
    return { reachable: false, latex: false, compiler: null };
  }
}

export async function saveResume(title, resume) {
  const response = await api.post("/api/resume/save", { title, resume });
  return response.data;
}

export async function generateResumePdf(resume) {
  let response;

  try {
    response = await api.post("/api/resume/generate", resume, {
      responseType: "blob",
    });
  } catch (error) {
    if (error?.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        error.response.data = JSON.parse(text);
      } catch {
        error.response.data = { detail: text };
      }
    }
    throw error;
  }

  const contentDisposition = response.headers["content-disposition"] || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || "resume.pdf";

  return {
    blob: response.data,
    filename,
  };
}

export async function renderResumeLatex(resume) {
  const response = await api.post("/api/resume/render-tex", resume);
  return response.data;
}

export async function analyzeResume(resume, targetRole, targetCompany) {
  const response = await api.post("/api/resume/analyze", {
    resume,
    target_role: targetRole || "",
    target_company: targetCompany || "",
  });
  return response.data;
}

export async function analyzeJobDescription(resume, targetRole, targetCompany, jobDescription) {
  const response = await api.post("/api/resume/analyze-job-description", {
    resume,
    target_role: targetRole || "",
    target_company: targetCompany || "",
    job_description: jobDescription || "",
  });
  return response.data;
}

export async function rewriteResumeBullets(resume, targetRole, targetCompany, enableAi = false) {
  const response = await api.post("/api/resume/rewrite-bullets", {
    resume,
    target_role: targetRole || "",
    target_company: targetCompany || "",
    enable_ai: enableAi,
  });
  return response.data;
}

export function getApiErrorMessage(error) {
  if (!error?.response) {
    return "Backend is unreachable. Start the FastAPI backend on http://127.0.0.1:8000, then try again.";
  }

  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => `${item.loc?.join(".") || "field"}: ${item.msg}`).join("\n");
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (error?.message) {
    if (error.message === "Network Error") {
      return "Backend is unreachable. Start the FastAPI backend on http://127.0.0.1:8000, then try again.";
    }
    return error.message;
  }

  return "Something went wrong while contacting the backend.";
}
