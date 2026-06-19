import { Search } from "lucide-react";

function scoreColor(value) {
  if (value >= 80) return "text-emerald-700";
  if (value >= 60) return "text-amber-700";
  return "text-red-700";
}

function KeywordChips({ keywords = [], emptyText }) {
  if (!keywords.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <span key={keyword} className="badge border-slate-200 bg-slate-50 text-slate-700">
          {keyword}
        </span>
      ))}
    </div>
  );
}

export default function JobDescriptionAnalyzerPanel({
  jobDescription = "",
  analysis,
  disabled = false,
  analyzeDisabled = false,
  isAnalyzing = false,
  onChangeJobDescription,
  onAnalyzeJobDescription,
}) {
  const hasJobDescription = jobDescription.trim().length > 0;
  const buttonDisabled = disabled || analyzeDisabled || isAnalyzing || !hasJobDescription;

  return (
    <section className="section-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Job Description Analyzer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paste a JD to compare required keywords against this active resume version.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={onAnalyzeJobDescription} disabled={buttonDisabled}>
          <Search size={16} />
          {isAnalyzing ? "Comparing" : "Analyze JD"}
        </button>
      </div>

      <textarea
        className="textarea mt-4 min-h-44"
        value={jobDescription}
        onChange={(event) => onChangeJobDescription(event.target.value)}
        placeholder="Paste the job description here..."
        disabled={disabled}
      />

      {!hasJobDescription ? (
        <p className="mt-3 text-sm text-slate-500">No job description is stored for this version yet.</p>
      ) : null}

      {analysis ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keyword Match</p>
              <p className={`mt-2 text-2xl font-bold ${scoreColor(analysis.keyword_match_percentage || 0)}`}>
                {analysis.keyword_match_percentage ?? 0}%
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role Alignment</p>
              <p className={`mt-2 text-2xl font-bold ${scoreColor(analysis.role_alignment_score || 0)}`}>
                {analysis.role_alignment_score ?? 0}
              </p>
            </div>
          </div>

          {!analysis.jd_keywords?.length ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No recognizable technical keywords were extracted from this JD. Add more of the responsibilities or
              requirements section, then analyze again.
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-bold text-slate-900">Matched JD Keywords</h3>
            <div className="mt-2">
              <KeywordChips keywords={analysis.matched_keywords || []} emptyText="No JD keywords matched the resume yet." />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">Missing JD Keywords</h3>
            <div className="mt-2">
              <KeywordChips keywords={analysis.missing_keywords || []} emptyText="No missing JD keywords detected." />
            </div>
          </div>

          {analysis.keyword_details?.length ? (
            <div className="overflow-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Keyword</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Resume Location</th>
                    <th className="py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {analysis.keyword_details.map((detail) => (
                    <tr key={detail.keyword}>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{detail.keyword}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`badge ${
                            detail.present
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-red-200 bg-red-50 text-red-800"
                          }`}
                        >
                          {detail.present ? "Matched" : "Missing"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">
                        {detail.resume_locations?.length ? detail.resume_locations.join(", ") : "Not found"}
                      </td>
                      <td className="py-3 text-slate-600">
                        {detail.matched_text?.length ? detail.matched_text.slice(0, 2).join(" | ") : "No evidence"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {analysis.safe_suggestions?.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Safe Suggestions</h3>
              {analysis.safe_suggestions.map((suggestion) => (
                <div key={suggestion.keyword} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{suggestion.keyword}</p>
                    <span
                      className={`badge ${
                        suggestion.safe_to_add
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {suggestion.safe_to_add ? "Safe with evidence" : "Do not auto-add"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Could fit: {suggestion.suggested_locations?.join(", ") || "No safe location"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Analyze the JD to see matched keywords, missing keywords, match percentage, role alignment, and safe guidance.
        </p>
      )}
    </section>
  );
}
