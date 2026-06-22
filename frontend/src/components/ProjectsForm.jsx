import { Plus, Trash2 } from "lucide-react";

function splitCommaList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const emptyProject = {
  name: "",
  role: "",
  link: "",
  start_date: "",
  end_date: "",
  technologies: [],
  bullets: [""],
};

export default function ProjectsForm({ projects = [], onChange }) {
  function updateProject(index, nextProject) {
    onChange(projects.map((project, currentIndex) => (currentIndex === index ? nextProject : project)));
  }

  function updateBullet(project, projectIndex, bulletIndex, value) {
    const bullets = (project.bullets || [""]).map((bullet, currentIndex) =>
      currentIndex === bulletIndex ? value : bullet,
    );
    updateProject(projectIndex, { ...project, bullets });
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Projects</h2>
          <p className="text-sm text-slate-500">Use action verbs and measurable outcomes in each bullet.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => onChange([...projects, emptyProject])}>
          <Plus size={16} />
          Add project
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {!projects.length ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            No projects added yet. Use Add project to create one.
          </p>
        ) : null}
        {projects.map((project, projectIndex) => (
          <div key={project.id ?? projectIndex} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="field-label">Project name</span>
                <input
                  className="input"
                  value={project.name}
                  onChange={(event) => updateProject(projectIndex, { ...project, name: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Role</span>
                <input
                  className="input"
                  value={project.role || ""}
                  onChange={(event) => updateProject(projectIndex, { ...project, role: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Start date</span>
                <input
                  className="input"
                  value={project.start_date || ""}
                  onChange={(event) => updateProject(projectIndex, { ...project, start_date: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">End date</span>
                <input
                  className="input"
                  value={project.end_date || ""}
                  onChange={(event) => updateProject(projectIndex, { ...project, end_date: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Project link</span>
                <input
                  className="input"
                  value={project.link || ""}
                  onChange={(event) => updateProject(projectIndex, { ...project, link: event.target.value })}
                />
              </label>
              <label>
                <span className="field-label">Technologies, comma-separated</span>
                <input
                  className="input"
                  value={(project.technologies || []).join(", ")}
                  onChange={(event) =>
                    updateProject(projectIndex, {
                      ...project,
                      technologies: splitCommaList(event.target.value),
                    })
                  }
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
                    updateProject(projectIndex, {
                      ...project,
                      bullets: [...(project.bullets || []), ""],
                    })
                  }
                >
                  <Plus size={15} />
                  Add bullet
                </button>
              </div>
              {(project.bullets || [""]).map((bullet, bulletIndex) => (
                <div key={`${projectIndex}-${bulletIndex}`} className="flex gap-2">
                  <textarea
                    className="textarea min-h-16"
                    value={bullet}
                    onChange={(event) => updateBullet(project, projectIndex, bulletIndex, event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-danger self-start"
                    onClick={() =>
                      updateProject(projectIndex, {
                        ...project,
                        bullets: (project.bullets || [""]).filter((_, currentIndex) => currentIndex !== bulletIndex),
                      })
                    }
                    disabled={(project.bullets || [""]).length === 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-danger mt-3"
              onClick={() => onChange(projects.filter((_, currentIndex) => currentIndex !== projectIndex))}
            >
              <Trash2 size={16} />
              Remove project
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
