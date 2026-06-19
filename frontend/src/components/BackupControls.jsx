import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";

export default function BackupControls({ disabled = false, onExportBackup, onImportBackup, onResetLocalData }) {
  const inputRef = useRef(null);

  function handleImportClick() {
    inputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file && !disabled) onImportBackup(file);
    event.target.value = "";
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">Backup & Safety</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onExportBackup} disabled={disabled}>
            <Download size={16} />
            Export Backup
          </button>
          <button type="button" className="btn-secondary" onClick={handleImportClick} disabled={disabled}>
            <Upload size={16} />
            Import Backup
          </button>
          <button type="button" className="btn-danger" onClick={onResetLocalData} disabled={disabled}>
            <RotateCcw size={16} />
            Reset Local Data
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />
    </section>
  );
}
