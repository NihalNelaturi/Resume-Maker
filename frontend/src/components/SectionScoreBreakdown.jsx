function scoreColor(score) {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

export default function SectionScoreBreakdown({ rows = [] }) {
  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Section Scores</h2>
      {!rows.length ? (
        <p className="mt-3 text-sm text-slate-500">Run analysis to see section-wise scoring.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.section}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-800">{row.section}</span>
                <span className="font-bold text-slate-900">{clampScore(row.score)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${scoreColor(clampScore(row.score))}`}
                  style={{ width: `${clampScore(row.score)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
