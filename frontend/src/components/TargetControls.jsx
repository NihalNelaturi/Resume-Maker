import { BriefcaseBusiness, Building2 } from "lucide-react";

const roleOptions = ["Software Engineer", "Product Company Software Engineer", "ML Engineer", "Embedded ML Engineer"];
const companySuggestions = ["Infosys", "TCS", "Wipro", "Accenture", "Product Company", "Startup", "No company"];

export default function TargetControls({
  version,
  profile,
  allSkillNames,
  disabled = false,
  onUpdateTarget,
  onToggleProject,
  onToggleExperience,
  onToggleSkill,
}) {
  const selectedProjectIds = new Set(version.selectedProjectIds || []);
  const selectedExperienceIds = new Set(version.selectedExperienceIds || []);
  const selectedSkillNames = new Set(version.selectedSkillNames || []);
  const projects = profile.projects || [];
  const experience = profile.experience || [];

  return (
    <section className="section-panel">
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="field-label">Target role</span>
          <span className="relative block">
            <BriefcaseBusiness className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <input
              className="input pl-9"
              value={version.targetRole || ""}
              onChange={(event) => onUpdateTarget({ targetRole: event.target.value })}
              disabled={disabled}
              list="target-role-suggestions"
              placeholder="Type any role"
            />
            <datalist id="target-role-suggestions">
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </datalist>
          </span>
        </label>
        <label>
          <span className="field-label">Target company</span>
          <span className="relative block">
            <Building2 className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
            <input
              className="input pl-9"
              value={version.targetCompany || ""}
              onChange={(event) =>
                onUpdateTarget({ targetCompany: event.target.value === "No company" ? "" : event.target.value })
              }
              disabled={disabled}
              list="target-company-suggestions"
              placeholder="Type any company"
            />
            <datalist id="target-company-suggestions">
              {companySuggestions.map((company) => (
                <option key={company} value={company} />
              ))}
            </datalist>
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SelectionGroup title="Projects" emptyMessage="No projects added yet. Add projects in Master Profile.">
          {projects.map((project) => (
            <CheckboxRow
              key={project.id}
              checked={selectedProjectIds.has(project.id)}
              label={project.name || "Untitled project"}
              onChange={() => onToggleProject(project.id)}
              disabled={disabled}
            />
          ))}
        </SelectionGroup>
        <SelectionGroup title="Experience" emptyMessage="No experience added yet. Add experience in Master Profile.">
          {experience.map((item) => (
            <CheckboxRow
              key={item.id}
              checked={selectedExperienceIds.has(item.id)}
              label={[item.title, item.company].filter(Boolean).join(" - ") || "Untitled experience"}
              onChange={() => onToggleExperience(item.id)}
              disabled={disabled}
            />
          ))}
        </SelectionGroup>
        <SelectionGroup title="Skills" emptyMessage="No skills added yet. Add skills in Master Profile.">
          {allSkillNames.map((skill) => (
            <CheckboxRow
              key={skill}
              checked={selectedSkillNames.has(skill)}
              label={skill}
              onChange={() => onToggleSkill(skill)}
              disabled={disabled}
            />
          ))}
        </SelectionGroup>
      </div>
    </section>
  );
}

function SelectionGroup({ title, emptyMessage, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <div>
      <p className="field-label">{title}</p>
      <div className="mt-2 max-h-44 space-y-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
        {items.length ? items : <p className="px-2 py-1.5 text-sm text-slate-500">{emptyMessage}</p>}
      </div>
    </div>
  );
}

function CheckboxRow({ checked, disabled = false, label, onChange }) {
  return (
    <label className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-white">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
