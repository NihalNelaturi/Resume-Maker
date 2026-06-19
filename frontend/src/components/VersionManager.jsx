import { Copy, Plus, Trash2 } from "lucide-react";

export default function VersionManager({
  versions,
  activeVersionId,
  disabled = false,
  onSelectVersion,
  onUpdateVersion,
  onCreateVersion,
  onDuplicateVersion,
  onDeleteVersion,
}) {
  const activeVersion = versions.find((version) => version.id === activeVersionId) || versions[0];

  if (!activeVersion) {
    return (
      <section className="section-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Resume Versions (0)</h2>
            <p className="mt-1 text-sm text-slate-500">No resume versions are available.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onCreateVersion} disabled={disabled}>
            <Plus size={16} />
            New version
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">Resume Versions ({versions.length})</h2>
        <button type="button" className="btn-secondary" onClick={onCreateVersion} disabled={disabled}>
          <Plus size={16} />
          New version
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label>
          <span className="field-label">Active version</span>
          <select
            className="input"
            value={activeVersion?.id || ""}
            onChange={(event) => onSelectVersion(event.target.value)}
            disabled={disabled}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Version name</span>
          <input
            className="input"
            value={activeVersion?.name || ""}
            onChange={(event) => onUpdateVersion({ name: event.target.value })}
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          className="btn-danger self-end"
          onClick={onDeleteVersion}
          disabled={disabled || versions.length <= 1}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="badge">Updated {activeVersion?.lastUpdated ? new Date(activeVersion.lastUpdated).toLocaleString() : "never"}</span>
        {activeVersion?.generatedPdfName ? <span className="badge">{activeVersion.generatedPdfName}</span> : null}
        {activeVersion?.analyzerScore ? <span className="badge">ATS {activeVersion.analyzerScore.ats_score}</span> : null}
      </div>

      <button type="button" className="btn-secondary mt-3" onClick={onDuplicateVersion} disabled={disabled}>
        <Copy size={16} />
        Duplicate current
      </button>
    </section>
  );
}
