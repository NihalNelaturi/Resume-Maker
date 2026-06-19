export default function HeaderForm({ header, onChange }) {
  function updateField(field, value) {
    onChange({ ...header, [field]: value });
  }

  return (
    <section className="section-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Header</h2>
          <p className="text-sm text-slate-500">Use professional contact details. Photos are intentionally excluded.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label>
          <span className="field-label">Full name</span>
          <input
            className="input"
            value={header.full_name}
            onChange={(event) => updateField("full_name", event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            value={header.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Phone</span>
          <input
            className="input"
            value={header.phone || ""}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">Location</span>
          <input
            className="input"
            value={header.location || ""}
            onChange={(event) => updateField("location", event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">LinkedIn</span>
          <input
            className="input"
            value={header.linkedin || ""}
            onChange={(event) => updateField("linkedin", event.target.value)}
          />
        </label>
        <label>
          <span className="field-label">GitHub</span>
          <input
            className="input"
            value={header.github || ""}
            onChange={(event) => updateField("github", event.target.value)}
          />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Portfolio</span>
          <input
            className="input"
            value={header.portfolio || ""}
            onChange={(event) => updateField("portfolio", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}

