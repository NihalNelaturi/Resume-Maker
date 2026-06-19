const confidenceStyles = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-300 bg-slate-100 text-slate-700",
  none: "border-red-200 bg-red-50 text-red-800",
};

const locationLabels = {
  summary: "summary",
  skills: "skills",
  project_title: "project title",
  project_technologies: "project technologies",
  project_bullet: "project bullet",
  experience_title: "experience title",
  experience_bullet: "experience bullet",
  certification: "certification",
  education: "education",
  achievement: "achievement",
};

function formatLocations(locations = []) {
  return locations.map((location) => locationLabels[location] || location).join(", ");
}

export default function KeywordEvidenceTable({ evidence = [] }) {
  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Keyword Evidence</h2>
      {!evidence.length ? (
        <p className="mt-3 text-sm text-slate-500">Run analysis to see where target keywords appear.</p>
      ) : (
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3">Keyword</th>
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2 pr-3">Locations</th>
                <th className="py-2">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {evidence.map((item) => (
                <tr key={item.keyword} className={item.confidence === "low" ? "bg-slate-50" : ""}>
                  <td className="py-3 pr-3 font-semibold text-slate-800">{item.keyword}</td>
                  <td className="py-3 pr-3">
                    <span className={`badge ${confidenceStyles[item.confidence] || confidenceStyles.none}`}>
                      {item.confidence || "none"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-slate-600">
                    {item.locations?.length ? formatLocations(item.locations) : "Not found"}
                  </td>
                  <td className="py-3 text-slate-600">
                    {item.matched_text?.length ? item.matched_text.slice(0, 2).join(" | ") : "No evidence"}
                    {item.confidence === "low" ? (
                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                        Low-confidence evidence is visible but does not count as full keyword coverage.
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
