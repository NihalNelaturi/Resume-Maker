export default function ImprovementChecklist({ items = [] }) {
  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Improvement Checklist</h2>
      {!items.length ? (
        <p className="mt-3 text-sm text-slate-500">Run analysis to generate a targeted checklist.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.text} className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={Boolean(item.completed)} readOnly />
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.text}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Priority: {item.priority}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

