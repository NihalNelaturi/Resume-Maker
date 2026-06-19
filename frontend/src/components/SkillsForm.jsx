import { Plus, Trash2 } from "lucide-react";

function splitItems(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function SkillsForm({ skills = [], onChange }) {
  function nextSkillGroupName() {
    const baseName = "New Skill Group";
    const existingNames = new Set(skills.map((skill) => String(skill.category || "").trim()).filter(Boolean));

    if (!existingNames.has(baseName)) return baseName;

    let suffix = 2;
    while (existingNames.has(`${baseName} ${suffix}`)) {
      suffix += 1;
    }
    return `${baseName} ${suffix}`;
  }

  function updateSkill(index, nextSkill) {
    onChange(skills.map((skill, currentIndex) => (currentIndex === index ? nextSkill : skill)));
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Skills</h2>
          <p className="text-sm text-slate-500">Group skills by category for easier scanning.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...skills, { category: nextSkillGroupName(), items: [] }])}
        >
          <Plus size={16} />
          Add skill group
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {!skills.length ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No skills added yet. Use Add skill group to create one.
          </p>
        ) : null}
        {skills.map((skill, index) => (
          <div key={`${skill.category}-${index}`} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[180px_1fr_auto]">
            <label>
              <span className="field-label">Category</span>
              <input
                className="input"
                value={skill.category}
                onChange={(event) => updateSkill(index, { ...skill, category: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Items, comma-separated</span>
              <input
                className="input"
                value={(skill.items || []).join(", ")}
                onChange={(event) => updateSkill(index, { ...skill, items: splitItems(event.target.value) })}
              />
            </label>
            <button
              type="button"
              className="btn-danger self-end"
              onClick={() => onChange(skills.filter((_, currentIndex) => currentIndex !== index))}
            >
              <Trash2 size={16} />
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
