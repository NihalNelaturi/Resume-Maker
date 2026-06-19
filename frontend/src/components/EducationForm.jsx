import { Plus, Trash2 } from "lucide-react";

function splitCommaList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const emptyEducation = {
  institution: "",
  degree: "",
  location: "",
  start_date: "",
  end_date: "",
  score: "",
  coursework: [],
};

export default function EducationForm({ education = [], onChange }) {
  function updateEducation(index, nextEducation) {
    onChange(education.map((item, currentIndex) => (currentIndex === index ? nextEducation : item)));
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Education</h2>
          <p className="text-sm text-slate-500">Freshers can include score and relevant coursework.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => onChange([...education, emptyEducation])}>
          <Plus size={16} />
          Add education
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {!education.length ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No education added yet. Use Add education to create one.
          </p>
        ) : null}
        {education.map((item, index) => (
          <div key={`${item.institution}-${index}`} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Institution</span>
                <input
                  className="input"
                  value={item.institution}
                  onChange={(event) => updateEducation(index, { ...item, institution: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Degree</span>
                <input
                  className="input"
                  value={item.degree}
                  onChange={(event) => updateEducation(index, { ...item, degree: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Location</span>
                <input
                  className="input"
                  value={item.location || ""}
                  onChange={(event) => updateEducation(index, { ...item, location: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Score</span>
                <input
                  className="input"
                  value={item.score || ""}
                  onChange={(event) => updateEducation(index, { ...item, score: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Start date</span>
                <input
                  className="input"
                  value={item.start_date || ""}
                  onChange={(event) => updateEducation(index, { ...item, start_date: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">End date</span>
                <input
                  className="input"
                  value={item.end_date || ""}
                  onChange={(event) => updateEducation(index, { ...item, end_date: event.target.value })}
                />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">Coursework, comma-separated</span>
                <input
                  className="input"
                  value={(item.coursework || []).join(", ")}
                  onChange={(event) =>
                    updateEducation(index, { ...item, coursework: splitCommaList(event.target.value) })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="btn-danger mt-3"
              onClick={() => onChange(education.filter((_, currentIndex) => currentIndex !== index))}
            >
              <Trash2 size={16} />
              Remove education
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
