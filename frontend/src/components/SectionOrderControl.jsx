import { ArrowDown, ArrowUp } from "lucide-react";

const sectionLabels = {
  professional_summary: "Professional Summary",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  achievements: "Achievements",
};

export default function SectionOrderControl({ sectionOrder, onChange }) {
  function move(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sectionOrder.length) return;

    const nextOrder = [...sectionOrder];
    const [section] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIndex, 0, section);
    onChange(nextOrder);
  }

  return (
    <section className="section-panel">
      <h2 className="text-base font-bold text-slate-950">Section order</h2>
      <p className="mt-1 text-sm text-slate-500">Header always stays first. Reorder the remaining resume sections.</p>

      <div className="mt-4 space-y-2">
        {sectionOrder.map((section, index) => (
          <div key={section} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-slate-800">{sectionLabels[section]}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-2 py-1"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${sectionLabels[section]} up`}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                className="btn-secondary px-2 py-1"
                onClick={() => move(index, 1)}
                disabled={index === sectionOrder.length - 1}
                aria-label={`Move ${sectionLabels[section]} down`}
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
