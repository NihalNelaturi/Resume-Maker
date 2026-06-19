import { Plus, Trash2 } from "lucide-react";

const emptyExperience = {
  title: "",
  company: "",
  location: "",
  start_date: "",
  end_date: "",
  bullets: [""],
};

export default function ExperienceForm({ experience = [], onChange }) {
  function updateExperience(index, nextExperience) {
    onChange(experience.map((item, currentIndex) => (currentIndex === index ? nextExperience : item)));
  }

  function updateBullet(item, itemIndex, bulletIndex, value) {
    const bullets = (item.bullets || [""]).map((bullet, currentIndex) =>
      currentIndex === bulletIndex ? value : bullet,
    );
    updateExperience(itemIndex, { ...item, bullets });
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Experience</h2>
          <p className="text-sm text-slate-500">Add internships, roles, freelance work, or research experience.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...experience, emptyExperience])}
        >
          <Plus size={16} />
          Add experience
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {!experience.length ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No experience added yet. Use Add experience to create one.
          </p>
        ) : null}
        {experience.map((item, itemIndex) => (
          <div key={`${item.company}-${itemIndex}`} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Role / title</span>
                <input
                  className="input"
                  value={item.title}
                  onChange={(event) => updateExperience(itemIndex, { ...item, title: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Company / organization</span>
                <input
                  className="input"
                  value={item.company}
                  onChange={(event) => updateExperience(itemIndex, { ...item, company: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Location</span>
                <input
                  className="input"
                  value={item.location || ""}
                  onChange={(event) => updateExperience(itemIndex, { ...item, location: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Start date</span>
                <input
                  className="input"
                  value={item.start_date || ""}
                  onChange={(event) => updateExperience(itemIndex, { ...item, start_date: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">End date</span>
                <input
                  className="input"
                  value={item.end_date || ""}
                  onChange={(event) => updateExperience(itemIndex, { ...item, end_date: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="field-label">Bullets</span>
                <button
                  type="button"
                  className="btn-secondary py-1"
                  onClick={() =>
                    updateExperience(itemIndex, {
                      ...item,
                      bullets: [...(item.bullets || []), ""],
                    })
                  }
                >
                  <Plus size={15} />
                  Add bullet
                </button>
              </div>
              {(item.bullets || [""]).map((bullet, bulletIndex) => (
                <div key={`${itemIndex}-${bulletIndex}`} className="flex gap-2">
                  <textarea
                    className="textarea min-h-16"
                    value={bullet}
                    onChange={(event) => updateBullet(item, itemIndex, bulletIndex, event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-danger self-start"
                    onClick={() =>
                      updateExperience(itemIndex, {
                        ...item,
                        bullets: (item.bullets || [""]).filter((_, currentIndex) => currentIndex !== bulletIndex),
                      })
                    }
                    disabled={(item.bullets || [""]).length === 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-danger mt-3"
              onClick={() => onChange(experience.filter((_, currentIndex) => currentIndex !== itemIndex))}
            >
              <Trash2 size={16} />
              Remove experience
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
