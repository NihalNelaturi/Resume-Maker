import { useRef, useState } from "react";
import { FileUp, ClipboardPaste, Loader2, RotateCcw, FileSearch } from "lucide-react";
import { IMPORT_ACCEPT } from "../services/resumeImport.js";

// Bootstrap a profile from an existing resume instead of starting from scratch.
// Supports uploading a PDF/DOCX/TXT/MD file, or pasting raw resume text.
export default function ImportResumePanel({
  disabled = false,
  isImporting = false,
  extractedText = "",
  onImportFile,
  onImportText,
  onReset,
}) {
  const inputRef = useRef(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file && !disabled) onImportFile(file);
    event.target.value = "";
  }

  function reviewExtractedText() {
    setPasteText(extractedText);
    setShowPaste(true);
  }

  return (
    <section className="section-panel mb-4 border-sky-200 bg-sky-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Import an existing resume</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload a PDF, DOCX, or text file (or paste the text) to auto-fill your profile. Everything is parsed in your
            browser — review and edit afterward.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => inputRef.current?.click()} disabled={disabled}>
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {isImporting ? "Importing" : "Upload file"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowPaste((value) => !value)} disabled={disabled}>
            <ClipboardPaste size={16} />
            Paste text
          </button>
          {onReset ? (
            <button type="button" className="btn-danger" onClick={onReset} disabled={disabled}>
              <RotateCcw size={16} />
              Clear all & start fresh
            </button>
          ) : null}
        </div>
      </div>

      <input ref={inputRef} type="file" accept={IMPORT_ACCEPT} className="hidden" onChange={handleFileChange} />

      {extractedText ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-xs text-amber-900">
            Missing some sections? See exactly what was read from your file, fix the section headings, and re-import.
          </span>
          <button type="button" className="btn-secondary py-1" onClick={reviewExtractedText} disabled={disabled}>
            <FileSearch size={15} />
            Review extracted text
          </button>
        </div>
      ) : null}

      {showPaste ? (
        <div className="mt-4">
          <textarea
            className="textarea min-h-48 font-mono text-xs"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={
              "Paste your full resume text here (one item per line). Use clear section headings on their own line, e.g.\n\nSUMMARY\n...\nSKILLS\nLanguages: Python, SQL\nEXPERIENCE\nSoftware Engineer, Acme | 2021 - Present\n- Did things"
            }
            disabled={disabled}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="btn-primary"
              disabled={disabled || !pasteText.trim()}
              onClick={() => onImportText(pasteText)}
            >
              Import text
            </button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Importing replaces your current resume with the uploaded one, then you review and edit each tab. Scanned or
        image-only PDFs have no selectable text — use <strong>Paste text</strong> in that case.
      </p>
    </section>
  );
}
