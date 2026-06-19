export default function MissingKeywordSuggestions({ suggestions = [] }) {
  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Missing Keyword Suggestions</h2>
      {!suggestions.length ? (
        <p className="mt-3 text-sm text-slate-500">No missing keyword suggestions yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.keyword} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{suggestion.keyword}</p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`badge ${
                      suggestion.safe_to_add
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    {suggestion.safe_to_add ? "Safe with evidence" : "Do not auto-add"}
                  </span>
                  {suggestion.requires_real_knowledge ? (
                    <span className="badge border-amber-200 bg-amber-50 text-amber-800">Requires real knowledge</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{suggestion.reason}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Could fit: {suggestion.suggested_locations?.join(", ") || "No safe location"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

