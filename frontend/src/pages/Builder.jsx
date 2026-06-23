import { useEffect, useMemo, useState } from "react";
import { Download, FileDown, Loader2 } from "lucide-react";
import HeaderForm from "../components/HeaderForm.jsx";
import SkillsForm from "../components/SkillsForm.jsx";
import ExperienceForm from "../components/ExperienceForm.jsx";
import ProjectsForm from "../components/ProjectsForm.jsx";
import EducationForm from "../components/EducationForm.jsx";
import { SimpleListEditor } from "../components/MasterProfileEditor.jsx";
import BackupControls from "../components/BackupControls.jsx";
import SectionOrderControl from "../components/SectionOrderControl.jsx";
import { generateClientResumePdf } from "../services/clientPdf.js";
import { PDF_TEMPLATES, DEFAULT_TEMPLATE_ID } from "../services/pdfTemplates.js";
import { extractTextFromFile, parseResumeText, summarizeImport } from "../services/resumeImport.js";
import { defaultProfile } from "../data/defaultProfile.js";
import {
  createClientId,
  createCommandCenterBackup,
  loadCommandCenterState,
  makeBlankVersion,
  normalizeCommandCenterState,
  resetCommandCenterStorage,
  saveCommandCenterState,
  validateCommandCenterBackup,
} from "../services/profileStorage.js";
import { downloadTextFile, removeEmptyOptionalFields, resumeFromProfile } from "../services/resumeTransforms.js";
import { checkBackend, generateResumePdf, getApiErrorMessage } from "../services/api.js";

const TABS = [
  { id: "contact", label: "Contact" },
  { id: "summary", label: "Summary" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "education", label: "Education" },
  { id: "extras", label: "Certifications" },
  { id: "finish", label: "Finish & Preview" },
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function splitCommaList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function skillObjectToGroups(skills = {}) {
  return Object.entries(skills).map(([category, items]) => ({ category, items: Array.isArray(items) ? items : [] }));
}

function skillGroupsToObject(groups = []) {
  return Object.fromEntries(
    groups
      .map((group) => [
        String(group.category || "").trim(),
        (group.items || []).map((item) => String(item || "").trim()).filter(Boolean),
      ])
      .filter(([category]) => category),
  );
}

function withIds(items = [], prefix) {
  return items.map((item) => ({ ...item, id: item.id || createClientId(prefix) }));
}

function normalizeBullets(items = []) {
  return items.map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) && item.bullets.length ? item.bullets : [""],
  }));
}

export default function Builder() {
  const [initialState] = useState(() => loadCommandCenterState());
  const [profile, setProfile] = useState(initialState.profile);
  const [versions, setVersions] = useState(initialState.versions);
  const [activeVersionId, setActiveVersionId] = useState(initialState.activeVersionId);
  const [activeTab, setActiveTab] = useState("contact");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("resume.pdf");
  const [pdfTemplateId, setPdfTemplateId] = useState(() => {
    try {
      return localStorage.getItem("resmake-pdf-template") || DEFAULT_TEMPLATE_ID;
    } catch {
      return DEFAULT_TEMPLATE_ID;
    }
  });
  const [pdfOptions, setPdfOptions] = useState(() => {
    const defaults = { paperSize: "letter", autoFit: true, fontSize: "M", accent: null };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem("resmake-pdf-options") || "{}") };
    } catch {
      return defaults;
    }
  });
  // Backend capability (for the optional LaTeX engine via Docker) and the
  // selected PDF engine. LaTeX is only usable when the backend with a LaTeX
  // compiler is reachable.
  const [backend, setBackend] = useState({ reachable: false, latex: false, compiler: null, checked: false });
  const [pdfMode, setPdfMode] = useState(() => {
    try {
      return localStorage.getItem("resmake-pdf-mode") === "latex" ? "latex" : "browser";
    } catch {
      return "browser";
    }
  });
  const latexMode = pdfMode === "latex" && backend.latex;

  const cleanedResume = useMemo(() => removeEmptyOptionalFields(resumeFromProfile(profile)), [profile]);
  const isBusy = isGenerating || isImporting;
  const missingRequiredHeader = !hasText(cleanedResume.header?.full_name) || !hasText(cleanedResume.header?.email);
  const resumeName = profile.personal?.full_name?.trim() || "Untitled Resume";

  // Persist to localStorage whenever the data changes.
  useEffect(() => {
    saveCommandCenterState({ profile, versions, activeVersionId });
  }, [profile, versions, activeVersionId]);

  // Probe the backend once on load to see whether the LaTeX engine is available.
  useEffect(() => {
    let active = true;
    checkBackend().then((result) => {
      if (!active) return;
      setBackend({ ...result, checked: true });
      if (!result.latex && pdfMode === "latex") setPdfMode("browser");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate the preview when the Finish tab opens.
  useEffect(() => {
    if (activeTab === "finish" && !pdfUrl && !missingRequiredHeader && !isGenerating) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function updatePersonal(patch) {
    setProfile((current) => ({ ...current, personal: { ...current.personal, ...patch } }));
  }

  function updateProfile(patch) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  function buildPdfRenderOptions(templateId, optionsOverride = pdfOptions) {
    const fontScaleByLabel = { S: 0.92, M: 1, L: 1.08 };
    return {
      templateId,
      paperSize: optionsOverride.paperSize,
      autoFit: optionsOverride.autoFit,
      fontScale: fontScaleByLabel[optionsOverride.fontSize] || 1,
      accent: optionsOverride.accent || undefined,
    };
  }

  function showPdfBlob(blob, filename) {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(URL.createObjectURL(blob));
    setPdfFilename(filename);
  }

  async function renderPdfWithTemplate(templateId, optionsOverride) {
    const { blob, filename } = await generateClientResumePdf(cleanedResume, buildPdfRenderOptions(templateId, optionsOverride));
    showPdfBlob(blob, filename);
    return filename;
  }

  async function renderLatexPdf() {
    const { blob, filename } = await generateResumePdf(cleanedResume);
    showPdfBlob(blob, filename);
    return filename;
  }

  function setPdfEngine(mode) {
    setPdfMode(mode);
    try {
      localStorage.setItem("resmake-pdf-mode", mode);
    } catch {
      // ignore storage failures
    }
    if (!missingRequiredHeader) {
      setIsGenerating(true);
      const render = mode === "latex" && backend.latex ? renderLatexPdf() : renderPdfWithTemplate(pdfTemplateId);
      render
        .catch((error) => setMessage(mode === "latex" ? getApiErrorMessage(error) : "Could not render the preview."))
        .finally(() => setIsGenerating(false));
    }
  }

  async function handleGenerate() {
    if (missingRequiredHeader) {
      setMessage("Add your full name and a valid email in the Contact tab to preview the PDF.");
      return;
    }
    setIsGenerating(true);
    setMessage("");
    try {
      if (latexMode) {
        await renderLatexPdf();
      } else {
        await renderPdfWithTemplate(pdfTemplateId);
      }
    } catch (error) {
      setMessage(
        latexMode
          ? `LaTeX export failed: ${getApiErrorMessage(error)}`
          : "Could not generate the PDF. Check your resume content and try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSelectTemplate(templateId) {
    setPdfTemplateId(templateId);
    try {
      localStorage.setItem("resmake-pdf-template", templateId);
    } catch {
      // ignore storage failures
    }
    if (missingRequiredHeader) return;
    setIsGenerating(true);
    try {
      await renderPdfWithTemplate(templateId);
    } catch {
      setMessage("Could not render the preview with the selected template.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleUpdatePdfOptions(patch) {
    const next = { ...pdfOptions, ...patch };
    setPdfOptions(next);
    try {
      localStorage.setItem("resmake-pdf-options", JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
    if (!missingRequiredHeader) {
      setIsGenerating(true);
      renderPdfWithTemplate(pdfTemplateId, next)
        .catch(() => setMessage("Could not re-render the preview with the new options."))
        .finally(() => setIsGenerating(false));
    }
  }

  function handleDownload() {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = pdfFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // --- Import / backup / reset ---------------------------------------------

  function mergeImportedProfile(existing, parsed) {
    // Import replaces what the parser found (so re-uploading the same resume
    // does not duplicate it); existing data is kept only where the parser
    // produced nothing.
    const personal = { ...existing.personal };
    Object.keys(parsed.personal).forEach((key) => {
      if (hasText(parsed.personal[key])) personal[key] = parsed.personal[key];
    });
    const pickList = (parsedList, existingList) => (parsedList.length ? parsedList : existingList);
    return {
      ...existing,
      personal,
      skills: Object.keys(parsed.skills).length ? parsed.skills : existing.skills,
      experience: pickList(parsed.experience, existing.experience),
      projects: pickList(parsed.projects, existing.projects),
      education: pickList(parsed.education, existing.education),
      certifications: pickList(parsed.certifications, existing.certifications),
      achievements: pickList(parsed.achievements, existing.achievements),
      bulletBank: existing.bulletBank || {},
    };
  }

  function applyParsedResume(text, sourceLabel) {
    const parsed = parseResumeText(text);
    const summary = summarizeImport(parsed);
    const total = summary.experience + summary.projects + summary.education + summary.skills + summary.certifications;
    if (!summary.hasName && !summary.hasEmail && total === 0) {
      setMessage(`Could not extract resume content from ${sourceLabel}. Try the Paste text option instead.`);
      return;
    }

    const isEmpty =
      !hasText(profile.personal?.full_name) &&
      !profile.experience?.length &&
      !profile.projects?.length &&
      !(Array.isArray(profile.skills) ? profile.skills.length : Object.keys(profile.skills || {}).length);

    if (!isEmpty) {
      const confirmed = window.confirm("Replace your current resume with the imported one?");
      if (!confirmed) return;
    }

    const merged = mergeImportedProfile(profile, parsed);
    const nextState = normalizeCommandCenterState({ profile: merged, versions, activeVersionId });
    setProfile(nextState.profile);
    setVersions(nextState.versions);
    setActiveVersionId(nextState.activeVersionId);
    setActiveTab("contact");
    setMessage(
      `Imported from ${sourceLabel}: ${summary.experience} experience, ${summary.projects} projects, ` +
        `${summary.education} education, ${summary.skills} skills, ${summary.certifications} certifications. Review each tab.`,
    );
  }

  async function importResumeFile(file) {
    if (isBusy) return;
    setIsImporting(true);
    setMessage("");
    try {
      const text = await extractTextFromFile(file);
      setExtractedText(text);
      applyParsedResume(text, file.name);
    } catch {
      setMessage("Could not read that file. Supported: PDF, DOCX, TXT, MD. For scanned/image PDFs, paste the text.");
    } finally {
      setIsImporting(false);
    }
  }

  function importResumeText(text) {
    if (isBusy) return;
    if (!hasText(text)) {
      setMessage("Paste your resume text first, then import.");
      return;
    }
    setMessage("");
    applyParsedResume(text, "pasted text");
  }

  function exportBackup() {
    if (isBusy) return;
    const backup = createCommandCenterBackup({ profile, versions, activeVersionId });
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(JSON.stringify(backup, null, 2), `resume-backup-${date}.json`, "application/json");
    setMessage("Backup exported.");
  }

  async function importBackup(file) {
    if (isBusy) return;
    setMessage("");
    try {
      const parsed = JSON.parse(await file.text());
      const validation = validateCommandCenterBackup(parsed);
      if (!validation.valid) {
        setMessage(validation.error);
        return;
      }
      if (!window.confirm("Importing this backup will replace your current resume. Continue?")) return;
      saveCommandCenterState(validation.data);
      setProfile(validation.data.profile);
      setVersions(validation.data.versions);
      setActiveVersionId(validation.data.activeVersionId);
      setMessage("Backup imported.");
    } catch {
      setMessage("Backup import failed: the file is not valid JSON.");
    }
  }

  function resetLocalData() {
    if (isBusy) return;
    if (!window.confirm("Clear all data and start fresh? This erases your resume from this browser.")) return;
    resetCommandCenterStorage();
    const blankVersion = makeBlankVersion([]);
    const nextState = normalizeCommandCenterState({
      profile: defaultProfile,
      versions: [blankVersion],
      activeVersionId: blankVersion.id,
    });
    saveCommandCenterState(nextState);
    setProfile(nextState.profile);
    setVersions(nextState.versions);
    setActiveVersionId(nextState.activeVersionId);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
    setActiveTab("contact");
    setMessage("Cleared everything. Upload a resume or fill in the Contact tab to start.");
  }

  // --- Tab content ----------------------------------------------------------

  function renderTab() {
    if (activeTab === "contact") {
      return (
        <div className="space-y-4">
          <ImportResumePanel
            disabled={isBusy}
            isImporting={isImporting}
            extractedText={extractedText}
            onImportFile={importResumeFile}
            onImportText={importResumeText}
            onReset={resetLocalData}
          />
          <HeaderForm header={profile.personal} onChange={updatePersonal} />
        </div>
      );
    }

    if (activeTab === "summary") {
      return (
        <section className="section-panel">
          <h2 className="text-base font-bold text-slate-950">Professional Summary</h2>
          <p className="mt-1 text-sm text-slate-500">2–4 sentences on who you are and what you do best.</p>
          <textarea
            className="textarea mt-3 min-h-40"
            value={profile.personal?.professional_summary || ""}
            onChange={(event) => updatePersonal({ professional_summary: event.target.value })}
            placeholder="Experienced ... with a track record of ..."
          />
        </section>
      );
    }

    if (activeTab === "skills") {
      return (
        <SkillsForm
          skills={withIds(profile.skills || [], "skill")}
          onChange={(skills) => updateProfile({ skills: withIds(skills, "skill") })}
        />
      );
    }

    if (activeTab === "experience") {
      return (
        <ExperienceForm
          experience={normalizeBullets(withIds(profile.experience || [], "exp"))}
          onChange={(items) => updateProfile({ experience: withIds(normalizeBullets(items), "exp") })}
        />
      );
    }

    if (activeTab === "projects") {
      return (
        <ProjectsForm
          projects={normalizeBullets(withIds(profile.projects || [], "project"))}
          onChange={(items) => updateProfile({ projects: withIds(normalizeBullets(items), "project") })}
        />
      );
    }

    if (activeTab === "education") {
      return (
        <EducationForm
          education={withIds(profile.education || [], "edu")}
          onChange={(items) => updateProfile({ education: withIds(items, "edu") })}
        />
      );
    }

    if (activeTab === "extras") {
      return (
        <div className="space-y-4">
          <SimpleListEditor
            title="Certifications"
            items={withIds(profile.certifications || [], "cert")}
            emptyItem={{ title: "", issuer: "", date: "", link: "" }}
            prefix="cert"
            fields={[
              ["title", "Title"],
              ["issuer", "Issuer"],
              ["date", "Date"],
              ["link", "Link"],
            ]}
            onChange={(items) => updateProfile({ certifications: withIds(items, "cert") })}
          />
          <SimpleListEditor
            title="Achievements"
            items={withIds(profile.achievements || [], "achievement")}
            emptyItem={{ title: "", description: "", date: "" }}
            prefix="achievement"
            fields={[
              ["title", "Title"],
              ["description", "Description"],
              ["date", "Date"],
            ]}
            onChange={(items) => updateProfile({ achievements: withIds(items, "achievement") })}
          />
        </div>
      );
    }

    // Finish & Preview
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.62fr)]">
        <section className="section-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950">PDF Preview</h2>
            <button type="button" className="btn-primary" onClick={handleDownload} disabled={!pdfUrl || isBusy}>
              <Download size={16} />
              Download
            </button>
          </div>
          {pdfUrl ? (
            <iframe
              title="Resume PDF preview"
              src={pdfUrl}
              className="h-[80vh] w-full rounded-md border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex h-[80vh] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 text-center">
              <p className="max-w-xs text-sm text-slate-500">
                {missingRequiredHeader
                  ? "Add your full name and a valid email in the Contact tab to preview the PDF."
                  : isGenerating
                    ? "Generating preview…"
                    : "Your resume preview will appear here."}
              </p>
              {!missingRequiredHeader ? (
                <button type="button" className="btn-primary" onClick={handleGenerate} disabled={isBusy}>
                  <FileDown size={16} />
                  {isGenerating ? "Generating" : "Generate preview"}
                </button>
              ) : null}
            </div>
          )}
          {pdfFilename ? <p className="mt-2 text-xs text-slate-500">Latest file: {pdfFilename}</p> : null}
        </section>

        <div className="space-y-4">
          <section className="section-panel">
            <h2 className="text-base font-bold text-slate-950">PDF Engine</h2>
            <EngineToggle mode={latexMode ? "latex" : "browser"} latexAvailable={backend.latex} disabled={isBusy} onChange={setPdfEngine} />
            <BackendStatus backend={backend} />
            <button
              type="button"
              className="btn-primary mt-4 w-full"
              onClick={handleGenerate}
              disabled={isBusy || missingRequiredHeader}
            >
              <FileDown size={16} />
              {isGenerating ? "Generating" : latexMode ? "Export PDF (LaTeX)" : "Export PDF"}
            </button>
          </section>

          <section className={`section-panel ${latexMode ? "opacity-60" : ""}`}>
            <h2 className="text-base font-bold text-slate-950">Template & Layout</h2>
            {latexMode ? (
              <p className="mt-1 text-sm text-slate-500">
                These apply to the Browser engine. LaTeX uses its own typeset layout.
              </p>
            ) : null}
            <TemplatePicker templateId={pdfTemplateId} disabled={isBusy || latexMode} onSelect={handleSelectTemplate} />
            <PdfOptionsControls options={pdfOptions} disabled={isBusy || latexMode} onChange={handleUpdatePdfOptions} />
          </section>

          <SectionOrderControl
            sectionOrder={profile.sectionOrder || []}
            onChange={(sectionOrder) => updateProfile({ sectionOrder })}
          />

          <BackupControls
            disabled={isBusy}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
            onResetLocalData={resetLocalData}
          />
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-panel">
          {resumeName}
        </span>
        <nav className="flex flex-wrap gap-1.5" aria-label="Resume sections">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide transition ${
                  isActive ? "bg-sky-700 text-white" : "bg-white text-slate-600 shadow-panel hover:bg-slate-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {message ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span>{message}</span>
          <button type="button" className="text-sky-700 hover:text-sky-900" onClick={() => setMessage("")} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      {isImporting ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          Reading your resume…
        </div>
      ) : null}

      {renderTab()}
    </main>
  );
}

const ACCENT_SWATCHES = [
  { label: "Template default", value: null, color: "#94a3b8" },
  { label: "Blue", value: "#1d4ed8", color: "#1d4ed8" },
  { label: "Teal", value: "#0f766e", color: "#0f766e" },
  { label: "Maroon", value: "#881337", color: "#881337" },
  { label: "Violet", value: "#7c3aed", color: "#7c3aed" },
  { label: "Slate", value: "#1f2937", color: "#1f2937" },
];

function SegmentedControl({ label, options, value, disabled, onChange }) {
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1.5 inline-flex rounded-md border border-slate-200 bg-white p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                active ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PdfOptionsControls({ options, disabled, onChange }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <SegmentedControl
          label="Paper size"
          value={options.paperSize}
          disabled={disabled}
          onChange={(value) => onChange({ paperSize: value })}
          options={[
            { label: "Letter", value: "letter" },
            { label: "A4", value: "a4" },
          ]}
        />
        <SegmentedControl
          label="Fit"
          value={options.autoFit}
          disabled={disabled}
          onChange={(value) => onChange({ autoFit: value })}
          options={[
            { label: "Auto one page", value: true },
            { label: "Off", value: false },
          ]}
        />
        <SegmentedControl
          label="Font size"
          value={options.fontSize}
          disabled={disabled || options.autoFit}
          onChange={(value) => onChange({ fontSize: value })}
          options={[
            { label: "S", value: "S" },
            { label: "M", value: "M" },
            { label: "L", value: "L" },
          ]}
        />
      </div>

      <div className="mt-3">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Accent color</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ACCENT_SWATCHES.map((swatch) => {
            const active = (options.accent || null) === swatch.value;
            return (
              <button
                key={swatch.label}
                type="button"
                disabled={disabled}
                title={swatch.label}
                onClick={() => onChange({ accent: swatch.value })}
                className={`h-7 w-7 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  active ? "border-sky-600 ring-2 ring-sky-200" : "border-white shadow"
                }`}
                style={{ backgroundColor: swatch.color }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EngineToggle({ mode, latexAvailable, disabled, onChange }) {
  const options = [
    { value: "browser", label: "Browser", hint: "Instant, in your browser", enabled: true },
    { value: "latex", label: "LaTeX", hint: "Requires Docker backend", enabled: latexAvailable },
  ];
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = option.value === mode;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled || !option.enabled}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              active ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function BackendStatus({ backend }) {
  let text;
  let tone;
  if (!backend.checked) {
    text = "Checking backend…";
    tone = "text-slate-500";
  } else if (backend.latex) {
    text = `Backend connected — LaTeX ready (${backend.compiler}).`;
    tone = "text-emerald-700";
  } else if (backend.reachable) {
    text = "Backend connected, but no LaTeX engine is installed.";
    tone = "text-amber-700";
  } else {
    text = "Backend offline — run the Docker stack (docker compose up) to enable LaTeX.";
    tone = "text-slate-500";
  }
  return <p className={`mt-2 text-xs ${tone}`}>{text}</p>;
}

function TemplatePicker({ templateId, disabled, onSelect }) {
  return (
    <div className="mt-4">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">PDF Template</span>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {PDF_TEMPLATES.map((template) => {
          const isActive = template.id === templateId;
          const accent = `rgb(${template.theme.accent.join(",")})`;
          return (
            <button
              key={template.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(template.id)}
              className={`rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: accent }} />
                <span className="text-sm font-semibold text-slate-950">{template.name}</span>
                {isActive ? <span className="badge ml-auto">Selected</span> : null}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{template.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
