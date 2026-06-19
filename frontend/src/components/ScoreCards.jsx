const scoreItems = [
  { key: "ats_score", label: "ATS" },
  { key: "recruiter_readability_score", label: "Recruiter" },
  { key: "role_fit_score", label: "Role Fit" },
  { key: "company_fit_score", label: "Company Fit" },
];

function scoreColor(value) {
  if (value >= 80) return "text-emerald-700";
  if (value >= 65) return "text-amber-700";
  return "text-red-700";
}

export default function ScoreCards({ analysis }) {
  if (!analysis) {
    return (
      <section className="section-panel">
        <h2 className="text-base font-bold text-slate-950">Scores</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {scoreItems.map((item) => (
            <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-400">--</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Scores</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {scoreItems.map((item) => (
          <div key={item.key} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`mt-2 text-2xl font-bold ${scoreColor(analysis[item.key] || 0)}`}>
              {analysis[item.key] ?? 0}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

