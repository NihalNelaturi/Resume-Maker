import { useEffect, useMemo, useState } from "react";
import { Download, FileCode2, FileDown, Save, Search, Server, Wand2 } from "lucide-react";
import BackupControls from "../components/BackupControls.jsx";
import BulletQualityTable from "../components/BulletQualityTable.jsx";
import BulletRewritePanel from "../components/BulletRewritePanel.jsx";
import ImprovementChecklist from "../components/ImprovementChecklist.jsx";
import JobDescriptionAnalyzerPanel from "../components/JobDescriptionAnalyzerPanel.jsx";
import KeywordEvidenceTable from "../components/KeywordEvidenceTable.jsx";
import MasterProfileEditor from "../components/MasterProfileEditor.jsx";
import MissingKeywordSuggestions from "../components/MissingKeywordSuggestions.jsx";
import ResumePreview from "../components/ResumePreview.jsx";
import ScoreCards from "../components/ScoreCards.jsx";
import SectionScoreBreakdown from "../components/SectionScoreBreakdown.jsx";
import TargetControls from "../components/TargetControls.jsx";
import VersionManager from "../components/VersionManager.jsx";
import { generateClientResumePdf } from "../services/clientPdf.js";
import { PDF_TEMPLATES, DEFAULT_TEMPLATE_ID } from "../services/pdfTemplates.js";
import {
  analyzeJobDescription,
  analyzeResume,
  getApiErrorMessage,
  healthCheck,
  renderResumeLatex,
  rewriteResumeBullets,
  saveResume,
} from "../services/api.js";
import {
  createCommandCenterBackup,
  loadCommandCenterState,
  makeBlankVersion,
  makeVersionFromCurrent,
  normalizeCommandCenterState,
  resetCommandCenterStorage,
  saveCommandCenterState,
  validateCommandCenterBackup,
} from "../services/profileStorage.js";
import {
  downloadTextFile,
  getAllSkillNames,
  removeEmptyOptionalFields,
  updateProfileBulletFromRewrite,
  resumeFromProfileVersion,
  updateResumeBullet,
} from "../services/resumeTransforms.js";

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function nowIso() {
  return new Date().toISOString();
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

const workflowSteps = [
  { id: "profile", label: "Profile", description: "Edit source resume data" },
  { id: "version", label: "Version", description: "Manage tailored resumes" },
  { id: "target", label: "Target", description: "Choose role, company, JD" },
  { id: "improve", label: "Analyze & Improve", description: "Score, inspect, rewrite" },
  { id: "export", label: "Export", description: "Preview, PDF, backups" },
];

export default function Builder() {
  const [initialState] = useState(() => loadCommandCenterState());
  const [profile, setProfile] = useState(initialState.profile);
  const [versions, setVersions] = useState(initialState.versions);
  const [activeVersionId, setActiveVersionId] = useState(initialState.activeVersionId);
  const [activeStep, setActiveStep] = useState("profile");
  const activeVersion = versions.find((version) => version.id === activeVersionId) || versions[0];
  const [resume, setResume] = useState(() => resumeFromProfileVersion(initialState.profile, activeVersion));
  const [analysis, setAnalysis] = useState(activeVersion?.analyzerScore || null);
  const [rewriteResponse, setRewriteResponse] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingJobDescription, setIsAnalyzingJobDescription] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isExportingLatex, setIsExportingLatex] = useState(false);
  const [message, setMessage] = useState(() =>
    initialState.recoveredFromCorruption
      ? "Saved local data was unreadable or contained legacy sample content, so the command center loaded a clean profile safely."
      : "",
  );
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState(activeVersion?.generatedPdfName || "resume.pdf");
  const [pdfTemplateId, setPdfTemplateId] = useState(() => {
    try {
      return localStorage.getItem("resmake-pdf-template") || DEFAULT_TEMPLATE_ID;
    } catch {
      return DEFAULT_TEMPLATE_ID;
    }
  });

  useEffect(() => {
    saveCommandCenterState({ profile, versions, activeVersionId });
  }, [profile, versions, activeVersionId]);

  useEffect(() => {
    let isMounted = true;
    healthCheck()
      .then(() => {
        if (isMounted) setApiStatus("online");
      })
      .catch(() => {
        if (isMounted) setApiStatus("offline");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (versions.length && versions.some((version) => version.id === activeVersionId)) return;

    const nextState = normalizeCommandCenterState({ profile, versions, activeVersionId });
    applyCommandCenterState(nextState);
  }, [activeVersionId, profile, versions]);

  const allSkillNames = useMemo(() => getAllSkillNames(profile), [profile]);
  const cleanedResume = useMemo(() => removeEmptyOptionalFields(resume), [resume]);
  const isBusy =
    isGenerating || isSaving || isAnalyzing || isAnalyzingJobDescription || isRewriting || isExportingLatex;
  const backendReady = apiStatus === "online";
  const backendOffline = apiStatus === "offline";
  const missingRequiredHeader = !hasText(cleanedResume.header?.full_name) || !hasText(cleanedResume.header?.email);
  const profileIsEmpty =
    !hasText(cleanedResume.professional_summary) &&
    !cleanedResume.skills?.length &&
    !cleanedResume.experience?.length &&
    !cleanedResume.projects?.length &&
    !cleanedResume.education?.length;
  const noSelectedProjects = !cleanedResume.projects?.length;
  const serverActionDisabled = isBusy || !backendReady || missingRequiredHeader;
  const resumeExportDisabled = isBusy || missingRequiredHeader;

  function requireBackend(actionLabel) {
    if (missingRequiredHeader) {
      setMessage(`${actionLabel} needs at least a full name and valid email in the header.`);
      return false;
    }

    if (!backendReady) {
      const statusText =
        apiStatus === "checking"
          ? "Backend status is still being checked."
          : "Backend is unreachable at http://127.0.0.1:8000.";
      setMessage(`${actionLabel} requires the FastAPI backend. ${statusText}`);
      return false;
    }

    return true;
  }

  function touchActiveVersion(patch) {
    if (!activeVersion) return;
    setVersions((current) =>
      current.map((version) =>
        version.id === activeVersion.id ? { ...version, ...patch, lastUpdated: nowIso() } : version,
      ),
    );
  }

  function selectVersion(versionId) {
    const nextVersion = versions.find((version) => version.id === versionId);
    if (!nextVersion) return;
    setActiveVersionId(versionId);
    setResume(resumeFromProfileVersion(profile, nextVersion));
    setAnalysis(nextVersion.analyzerScore || null);
    setRewriteResponse(null);
    setPdfFilename(nextVersion.generatedPdfName || "resume.pdf");
    setMessage("");
  }

  function applyCommandCenterState(nextState) {
    const nextVersion =
      nextState.versions.find((version) => version.id === nextState.activeVersionId) || nextState.versions[0];

    setProfile(nextState.profile);
    setVersions(nextState.versions);
    setActiveVersionId(nextVersion.id);
    setResume(resumeFromProfileVersion(nextState.profile, nextVersion));
    setAnalysis(nextVersion.analyzerScore || null);
    setRewriteResponse(null);
    setPdfFilename(nextVersion.generatedPdfName || "resume.pdf");
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
  }

  function updateActiveVersion(patch, { rebuildResume = false } = {}) {
    if (!activeVersion) return;
    const nextState = normalizeCommandCenterState({
      profile,
      versions: versions.map((version) =>
        version.id === activeVersion.id ? { ...version, ...patch, lastUpdated: nowIso() } : version,
      ),
      activeVersionId: activeVersion.id,
    });
    const nextVersion = nextState.versions.find((version) => version.id === nextState.activeVersionId);
    setVersions(nextState.versions);
    setActiveVersionId(nextState.activeVersionId);
    if (rebuildResume) {
      setResume(resumeFromProfileVersion(profile, nextVersion));
      setRewriteResponse(null);
    }
  }

  function createVersion() {
    const nextVersion = makeBlankVersion(versions);
    setVersions((current) => [...current, nextVersion]);
    setActiveVersionId(nextVersion.id);
    setResume(resumeFromProfileVersion(profile, nextVersion));
    setAnalysis(null);
    setRewriteResponse(null);
    setMessage("Created a clean resume version.");
  }

  function duplicateVersion() {
    const nextVersion = makeVersionFromCurrent(activeVersion || versions[0], versions);
    setVersions((current) => [...current, nextVersion]);
    setActiveVersionId(nextVersion.id);
    setResume(resumeFromProfileVersion(profile, nextVersion));
    setAnalysis(null);
    setRewriteResponse(null);
    setMessage(`Duplicated current version as "${nextVersion.name}".`);
  }

  function deleteVersion() {
    if (versions.length <= 1) return;
    const confirmed = window.confirm(`Delete resume version "${activeVersion.name}"? This cannot be undone.`);
    if (!confirmed) return;

    const deletedIndex = versions.findIndex((version) => version.id === activeVersion.id);
    const remaining = versions.filter((version) => version.id !== activeVersion.id);
    const nextVersion = remaining[Math.max(0, deletedIndex - 1)] || remaining[0];
    setVersions(remaining);
    setActiveVersionId(nextVersion.id);
    setResume(resumeFromProfileVersion(profile, nextVersion));
    setAnalysis(nextVersion.analyzerScore || null);
    setRewriteResponse(null);
  }

  function updateMasterProfile(nextProfile) {
    const nextState = normalizeCommandCenterState({
      profile: nextProfile,
      versions,
      activeVersionId: activeVersion?.id,
    });
    applyCommandCenterState(nextState);
    setAnalysis(nextState.versions.find((version) => version.id === nextState.activeVersionId)?.analyzerScore || null);
    setRewriteResponse(null);
  }

  function toggleProject(projectId) {
    updateActiveVersion(
      {
        selectedProjectIds: toggleValue(activeVersion.selectedProjectIds || [], projectId),
        analyzerScore: null,
        jobDescriptionAnalysis: null,
      },
      { rebuildResume: true },
    );
    setAnalysis(null);
  }

  function toggleExperience(experienceId) {
    updateActiveVersion(
      {
        selectedExperienceIds: toggleValue(activeVersion.selectedExperienceIds || [], experienceId),
        analyzerScore: null,
        jobDescriptionAnalysis: null,
      },
      { rebuildResume: true },
    );
    setAnalysis(null);
  }

  function toggleSkill(skillName) {
    updateActiveVersion(
      {
        selectedSkillNames: toggleValue(activeVersion.selectedSkillNames || [], skillName),
        analyzerScore: null,
        jobDescriptionAnalysis: null,
      },
      { rebuildResume: true },
    );
    setAnalysis(null);
  }

  async function handleSave() {
    if (!requireBackend("Saving a draft")) return;

    setIsSaving(true);
    setMessage("");

    try {
      const saved = await saveResume(activeVersion.name, cleanedResume);
      setMessage(`Draft saved with id ${saved.id}.`);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyze() {
    if (!requireBackend("Resume analysis")) return;

    setIsAnalyzing(true);
    setMessage("");

    try {
      const result = await analyzeResume(cleanedResume, activeVersion.targetRole, activeVersion.targetCompany);
      setAnalysis(result);
      touchActiveVersion({ analyzerScore: result });
      setMessage("Resume analysis completed.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleJobDescriptionChange(value) {
    updateActiveVersion({ jobDescription: value, jobDescriptionAnalysis: null });
  }

  async function handleAnalyzeJobDescription() {
    if (!hasText(activeVersion.jobDescription)) {
      setMessage("Paste a job description before running the JD analyzer.");
      return;
    }

    if (!requireBackend("Job description analysis")) return;

    setIsAnalyzingJobDescription(true);
    setMessage("");

    try {
      const result = await analyzeJobDescription(
        cleanedResume,
        activeVersion.targetRole,
        activeVersion.targetCompany,
        activeVersion.jobDescription,
      );
      touchActiveVersion({ jobDescriptionAnalysis: result });
      setMessage("Job description analysis completed.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsAnalyzingJobDescription(false);
    }
  }

  async function handleRewrite() {
    if (!requireBackend("Bullet rewriting")) return;

    setIsRewriting(true);
    setMessage("");

    try {
      const result = await rewriteResumeBullets(
        cleanedResume,
        activeVersion.targetRole,
        activeVersion.targetCompany,
        false,
      );
      setRewriteResponse(result);
      setMessage("Bullet rewrite suggestions generated.");
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsRewriting(false);
    }
  }

  async function handleExportLatex() {
    if (!requireBackend("LaTeX export")) return;

    setIsExportingLatex(true);
    setMessage("");

    try {
      const result = await renderResumeLatex(cleanedResume);
      downloadTextFile(result.latex, result.filename, "application/x-tex");
      touchActiveVersion({ generatedLatex: result.latex });
      setMessage(`LaTeX exported as ${result.filename}.`);
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsExportingLatex(false);
    }
  }

  function renderPdfWithTemplate(templateId) {
    const { blob, filename } = generateClientResumePdf(cleanedResume, { templateId });
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const nextUrl = URL.createObjectURL(blob);
    setPdfUrl(nextUrl);
    setPdfFilename(filename);
    touchActiveVersion({ generatedPdfName: filename });
    return filename;
  }

  function handleGenerate() {
    if (missingRequiredHeader) {
      setMessage("PDF export needs at least a full name and valid email in the header.");
      return;
    }

    setIsGenerating(true);
    setMessage("");

    try {
      renderPdfWithTemplate(pdfTemplateId);
      setMessage("PDF generated in your browser.");
    } catch {
      setMessage("Could not generate the PDF. Check that the resume has valid content and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSelectTemplate(templateId) {
    setPdfTemplateId(templateId);
    try {
      localStorage.setItem("resmake-pdf-template", templateId);
    } catch {
      // Ignore storage failures (e.g. private mode); selection still applies in-session.
    }
    // If a preview is already showing, re-render it with the new template immediately.
    if (pdfUrl && !missingRequiredHeader) {
      try {
        renderPdfWithTemplate(templateId);
      } catch {
        setMessage("Could not re-render the preview with the selected template.");
      }
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

  function applyRewrite(rewrite) {
    if (isBusy) return;
    if (!rewrite?.changed) return;

    const nextResume = updateResumeBullet(resume, rewrite);
    setResume(nextResume);
    setProfile((current) => updateProfileBulletFromRewrite(current, activeVersion, rewrite));
    touchActiveVersion({ analyzerScore: null, jobDescriptionAnalysis: null });
    setAnalysis(null);
    setMessage("Rewrite applied to the active resume version.");
  }

  function exportBackup() {
    if (isBusy) return;
    const backup = createCommandCenterBackup({ profile, versions, activeVersionId: activeVersion.id });
    const date = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      JSON.stringify(backup, null, 2),
      `resume-command-center-backup-${date}.json`,
      "application/json",
    );
    setMessage("Command-center backup exported.");
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

      const confirmed = window.confirm(
        "Importing this backup will replace your current local profile and resume versions. Continue?",
      );
      if (!confirmed) return;

      saveCommandCenterState(validation.data);
      applyCommandCenterState(validation.data);
      setMessage("Command-center backup imported.");
    } catch {
      setMessage("Backup import failed because the selected file is not valid JSON.");
    }
  }

  function resetLocalData() {
    if (isBusy) return;
    const confirmed = window.confirm(
      "Reset local command-center data? This removes the saved profile, versions, active version, and backup state from this browser.",
    );
    if (!confirmed) return;

    resetCommandCenterStorage();
    const nextState = loadCommandCenterState();
    applyCommandCenterState(nextState);
    setMessage("Local command-center data reset.");
  }

  function renderActiveStep() {
    if (activeStep === "profile") {
      return (
        <WorkflowLayout
          title="Your Profile"
          description="Keep the source profile truthful and complete. Resume versions only select from this data."
        >
          {profileIsEmpty ? <OnboardingCard /> : null}
          <MasterProfileEditor profile={profile} onChange={updateMasterProfile} />
        </WorkflowLayout>
      );
    }

    if (activeStep === "version") {
      return (
        <WorkflowLayout
          title="Resume Versions"
          description="Create focused resume versions for each role or company without changing the source profile."
        >
          <VersionManager
            versions={versions}
            activeVersionId={activeVersion.id}
            disabled={isBusy}
            onSelectVersion={selectVersion}
            onUpdateVersion={(patch) => updateActiveVersion(patch)}
            onCreateVersion={createVersion}
            onDuplicateVersion={duplicateVersion}
            onDeleteVersion={deleteVersion}
          />
        </WorkflowLayout>
      );
    }

    if (activeStep === "target") {
      return (
        <WorkflowLayout
          title="Target Resume"
          description="Set the role, company, selected evidence, and job description before running analysis."
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
            <TargetControls
              version={activeVersion}
              profile={profile}
              allSkillNames={allSkillNames}
              disabled={isBusy}
              onUpdateTarget={(patch) =>
                updateActiveVersion({ ...patch, analyzerScore: null, jobDescriptionAnalysis: null })
              }
              onToggleProject={toggleProject}
              onToggleExperience={toggleExperience}
              onToggleSkill={toggleSkill}
            />
            <JobDescriptionAnalyzerPanel
              jobDescription={activeVersion.jobDescription || ""}
              analysis={activeVersion.jobDescriptionAnalysis}
              disabled={isBusy}
              analyzeDisabled={!backendReady || missingRequiredHeader}
              isAnalyzing={isAnalyzingJobDescription}
              onChangeJobDescription={handleJobDescriptionChange}
              onAnalyzeJobDescription={handleAnalyzeJobDescription}
            />
          </div>
        </WorkflowLayout>
      );
    }

    if (activeStep === "improve") {
      return (
        <WorkflowLayout
          title="Analyze & Improve"
          description="Run the resume and JD analyzers, inspect priority issues, and rewrite only selected bullets."
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(420px,1.18fr)]">
            <div className="space-y-4">
              <section className="section-panel">
                <h2 className="text-base font-bold text-slate-950">Analysis Actions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Analyzer and rewrite calls require the FastAPI backend. Existing resume data stays unchanged if a call fails.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={handleAnalyze} disabled={serverActionDisabled}>
                    <Search size={16} />
                    {isAnalyzing ? "Analyzing" : "Analyze Resume"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleAnalyzeJobDescription}
                    disabled={serverActionDisabled || !hasText(activeVersion.jobDescription)}
                  >
                    <Search size={16} />
                    {isAnalyzingJobDescription ? "Checking JD" : "Analyze JD"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleRewrite} disabled={serverActionDisabled}>
                    <Wand2 size={16} />
                    {isRewriting ? "Rewriting" : "Rewrite Bullets"}
                  </button>
                </div>
              </section>

              <ScoreCards analysis={analysis} />
              <BulletRewritePanel disabled={isBusy} rewriteResponse={rewriteResponse} onApplyRewrite={applyRewrite} />
            </div>

            <div className="space-y-3">
              <AdvancedPanel title="Keyword Evidence" description="Detected role and company keywords with source evidence.">
                <KeywordEvidenceTable evidence={analysis?.keyword_evidence || []} />
              </AdvancedPanel>
              <AdvancedPanel title="Missing Keyword Guidance" description="Suggestions only. Nothing is added automatically.">
                <MissingKeywordSuggestions suggestions={analysis?.missing_keyword_suggestions || []} />
              </AdvancedPanel>
              <AdvancedPanel title="Weak Bullet Quality" description="Bullet-level scores, weaknesses, and rewrite targets.">
                <BulletQualityTable rows={analysis?.bullet_quality || []} />
              </AdvancedPanel>
              <AdvancedPanel title="Improvement Checklist" description="Priority fixes before exporting.">
                <ImprovementChecklist items={analysis?.improvement_checklist || []} />
              </AdvancedPanel>
              <AdvancedPanel title="Section Score Breakdown" description="Section-by-section quality notes.">
                <SectionScoreBreakdown rows={analysis?.section_score_breakdown || []} />
              </AdvancedPanel>
            </div>
          </div>
        </WorkflowLayout>
      );
    }

    return (
      <WorkflowLayout
        title="Export & Backup"
        description="Preview the active resume, export PDF or LaTeX, and protect local data with backups."
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
          <div className="space-y-4">
            <ResumePreview resume={cleanedResume} />
            {pdfUrl ? (
              <section className="section-panel">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-950">PDF Preview</h2>
                  <button type="button" className="btn-secondary" onClick={handleDownload} disabled={isBusy}>
                    <Download size={16} />
                    Download
                  </button>
                </div>
                <iframe
                  title="Generated resume PDF preview"
                  src={pdfUrl}
                  className="h-[720px] w-full rounded-md border border-slate-200 bg-white"
                />
              </section>
            ) : null}
          </div>

          <div className="space-y-4">
            <section className="section-panel">
              <h2 className="text-base font-bold text-slate-950">Export Actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                PDF is generated instantly in your browser. Pick a template, then export or download.
              </p>
              <TemplatePicker
                templateId={pdfTemplateId}
                disabled={isBusy}
                onSelect={handleSelectTemplate}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={handleExportLatex} disabled={serverActionDisabled}>
                  <FileCode2 size={16} />
                  {isExportingLatex ? "Exporting" : "Export LaTeX"}
                </button>
                <button type="button" className="btn-primary" onClick={handleGenerate} disabled={resumeExportDisabled}>
                  <FileDown size={16} />
                  {isGenerating ? "Generating" : "Export PDF"}
                </button>
                <button type="button" className="btn-secondary" onClick={handleDownload} disabled={!pdfUrl || isBusy}>
                  <Download size={16} />
                  Download
                </button>
              </div>
              {pdfFilename ? <p className="mt-3 text-xs text-slate-500">Latest file: {pdfFilename}</p> : null}
            </section>

            <BackupControls
              disabled={isBusy}
              onExportBackup={exportBackup}
              onImportBackup={importBackup}
              onResetLocalData={resetLocalData}
            />
          </div>
        </div>
      </WorkflowLayout>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-950">Resume Command Center</h1>
            <p className="mt-1 text-sm text-slate-600">
              {activeVersion.targetCompany || "Target company"} - {activeVersion.targetRole || "Target role"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                apiStatus === "online"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : apiStatus === "offline"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Server size={16} />
              API {apiStatus}
            </span>
            <button type="button" className="btn-secondary" onClick={handleAnalyze} disabled={serverActionDisabled}>
              <Search size={16} />
              {isAnalyzing ? "Analyzing" : "Analyze"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleRewrite} disabled={serverActionDisabled}>
              <Wand2 size={16} />
              {isRewriting ? "Rewriting" : "Rewrite Bullets"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleSave} disabled={serverActionDisabled}>
              <Save size={16} />
              {isSaving ? "Saving" : "Save draft"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleExportLatex} disabled={serverActionDisabled}>
              <FileCode2 size={16} />
              {isExportingLatex ? "Exporting" : "Export LaTeX"}
            </button>
            <button type="button" className="btn-primary" onClick={handleGenerate} disabled={resumeExportDisabled}>
              <FileDown size={16} />
              {isGenerating ? "Generating" : "Export PDF"}
            </button>
            <button type="button" className="btn-secondary" onClick={handleDownload} disabled={!pdfUrl || isBusy}>
              <Download size={16} />
              Download
            </button>
          </div>
        </div>
        <WorkflowNav activeStep={activeStep} onSelectStep={setActiveStep} />
      </div>

      {message ? (
        <div className="mb-5 whitespace-pre-line rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-panel">
          {message}
        </div>
      ) : null}

      <div className="mb-5 space-y-2">
        {backendOffline ? (
          <Notice
            tone="warning"
            message="Backend is offline. Analyze, rewrite, save draft, and LaTeX export require FastAPI on http://127.0.0.1:8000. PDF export can still use the browser fallback."
          />
        ) : null}
        {missingRequiredHeader ? (
          <Notice tone="error" message="Add a full name and valid email before exporting or calling backend actions." />
        ) : null}
        {profileIsEmpty ? (
          <Notice tone="warning" message="No profile content is selected yet. Add resume data or import a backup." />
        ) : null}
        {noSelectedProjects ? (
          <Notice tone="neutral" message="No projects are selected for this version. Analysis can continue, but role fit may be lower." />
        ) : null}
      </div>

      {renderActiveStep()}
    </main>
  );
}

function Notice({ tone = "neutral", message }) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-white text-slate-700";

  return <div className={`rounded-md border px-4 py-3 text-sm shadow-panel ${toneClass}`}>{message}</div>;
}

function WorkflowNav({ activeStep, onSelectStep }) {
  return (
    <nav className="mt-4 grid gap-2 md:grid-cols-5" aria-label="Resume workflow">
      {workflowSteps.map((step, index) => {
        const isActive = step.id === activeStep;

        return (
          <button
            key={step.id}
            type="button"
            className={`rounded-md border px-3 py-2 text-left transition ${
              isActive
                ? "border-sky-300 bg-sky-50 text-sky-950"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
            }`}
            onClick={() => onSelectStep(step.id)}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide">
              {index + 1}. {step.label}
            </span>
            <span className="mt-1 block text-xs text-slate-500">{step.description}</span>
          </button>
        );
      })}
    </nav>
  );
}

function OnboardingCard() {
  const steps = [
    "Fill in your profile: header, summary, skills, experience, projects, and education.",
    "Create a resume version and pick which projects, experience, and skills to include.",
    "Set a target role (and optionally paste a job description) to analyze fit.",
    "Run Analyze & Rewrite, then export a PDF using your preferred template.",
  ];

  return (
    <section className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-panel">
      <h3 className="text-base font-bold text-sky-950">Welcome to your Resume Command Center</h3>
      <p className="mt-1 text-sm text-sky-900">
        Your profile is the single source of truth. Everything else selects from it. Here is the flow:
      </p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-2 text-sm text-sky-900">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-sky-800">
        Tip: your data is saved only in this browser. Use Export Backup in the Export step to keep a copy.
      </p>
    </section>
  );
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
                isActive
                  ? "border-sky-300 bg-sky-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
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

function WorkflowLayout({ title, description, children }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function AdvancedPanel({ title, description, children }) {
  return (
    <details className="group">
      <summary className="section-panel flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="block text-base font-bold text-slate-950">{title}</span>
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
        </span>
        <span className="badge group-open:border-sky-200 group-open:bg-sky-50 group-open:text-sky-800">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
