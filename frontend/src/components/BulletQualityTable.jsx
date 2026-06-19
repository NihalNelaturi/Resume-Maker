function scoreClass(score) {
  if (score >= 8) return "text-emerald-700";
  if (score >= 6) return "text-amber-700";
  return "text-red-700";
}

export default function BulletQualityTable({ rows = [] }) {
  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Bullet Quality</h2>
      {!rows.length ? (
        <p className="mt-3 text-sm text-slate-500">Run analysis to score each project and experience bullet.</p>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Weakness</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row) => (
                <tr key={`${row.section}-${row.item_index}-${row.bullet_index}`}>
                  <td className={`py-3 pr-3 text-lg font-bold ${scoreClass(row.score)}`}>{row.score}/10</td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-slate-800">{row.label}</p>
                    <p className="mt-1 text-slate-600">{row.original}</p>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {row.weakness_types?.length ? row.weakness_types.join(", ") : "None"}
                  </td>
                  <td className="py-3 text-slate-600">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

