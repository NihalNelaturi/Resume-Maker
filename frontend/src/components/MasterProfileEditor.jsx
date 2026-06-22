import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, UserRound } from "lucide-react";
import EducationForm from "./EducationForm.jsx";
import ExperienceForm from "./ExperienceForm.jsx";
import HeaderForm from "./HeaderForm.jsx";
import ProjectsForm from "./ProjectsForm.jsx";
import SkillsForm from "./SkillsForm.jsx";
import { createClientId } from "../services/profileStorage.js";

function splitCommaList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function skillObjectToGroups(skills = {}) {
  return Object.entries(skills).map(([category, items]) => ({
    category,
    items: Array.isArray(items) ? items : [],
  }));
}

function skillGroupsToObject(groups = []) {
  return Object.fromEntries(
    groups
      .map((group) => [
        String(group.category || "").trim(),
        (group.items || []).map((item) => String(item || "").trim()).filter(Boolean),
      ])
      .filter(([category]) => category),
  );
}

function withIds(items = [], prefix) {
  return items.map((item) => ({
    ...item,
    id: item.id || createClientId(prefix),
  }));
}

function normalizeBullets(items = []) {
  return items.map((item) => ({
    ...item,
    bullets: Array.isArray(item.bullets) && item.bullets.length ? item.bullets : [""],
  }));
}

export default function MasterProfileEditor({ profile, onChange }) {
  const profileStats = useMemo(
    () => ({
      projects: profile.projects?.length || 0,
      experience: profile.experience?.length || 0,
      skills: Object.values(profile.skills || {}).flat().length,
      education: profile.education?.length || 0,
      certifications: profile.certifications?.length || 0,
      achievements: profile.achievements?.length || 0,
    }),
    [profile],
  );
  const hasProfileContent = Object.values(profileStats).some((count) => count > 0) ||
    Boolean(profile.personal?.full_name || profile.personal?.email || profile.personal?.professional_summary);
  const [isOpen, setIsOpen] = useState(!hasProfileContent);

  useEffect(() => {
    if (!hasProfileContent) setIsOpen(true);
  }, [hasProfileContent]);

  const header = {
    full_name: profile.personal?.full_name || "",
    email: profile.personal?.email || "",
    phone: profile.personal?.phone || "",
    location: profile.personal?.location || "",
    linkedin: profile.personal?.linkedin || "",
    github: profile.personal?.github || "",
    portfolio: profile.personal?.portfolio || "",
  };

  function updateProfile(patch) {
    onChange({ ...profile, ...patch });
  }

  function updatePersonal(patch) {
    updateProfile({
      personal: {
        ...profile.personal,
        ...patch,
      },
    });
  }

  function updateList(key, prefix, items) {
    updateProfile({ [key]: withIds(items, prefix) });
  }

  return (
    <section className="space-y-4">
      <details open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-panel">
          <span>
            <span className="flex items-center gap-2 text-base font-bold text-slate-950">
              <UserRound size={18} />
              Your Profile
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              Edit your resume source data. Versions select from this profile.
            </span>
            <span className="mt-2 flex flex-wrap gap-2">
              <span className="badge">{profileStats.projects} projects</span>
              <span className="badge">{profileStats.experience} experience</span>
              <span className="badge">{profileStats.skills} skills</span>
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="badge">localStorage</span>
            <ChevronDown
              size={18}
              className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </span>
        </summary>

        <div className="mt-4 space-y-4">
          <HeaderForm header={header} onChange={updatePersonal} />

          <section className="section-panel">
            <h2 className="text-base font-bold text-slate-950">Professional Summary</h2>
            <textarea
              className="textarea mt-3 min-h-24"
              value={profile.personal?.professional_summary || ""}
              onChange={(event) => updatePersonal({ professional_summary: event.target.value })}
              placeholder="Add your real summary. Leave blank if you do not want one yet."
            />
          </section>

          <SkillsForm
            skills={skillObjectToGroups(profile.skills)}
            onChange={(groups) => updateProfile({ skills: skillGroupsToObject(groups) })}
          />

          <ExperienceForm
            experience={normalizeBullets(withIds(profile.experience || [], "exp"))}
            onChange={(items) => updateList("experience", "exp", normalizeBullets(items))}
          />

          <ProjectsForm
            projects={normalizeBullets(withIds(profile.projects || [], "project"))}
            onChange={(items) => updateList("projects", "project", normalizeBullets(items))}
          />

          <EducationForm
            education={withIds(profile.education || [], "edu")}
            onChange={(items) => updateList("education", "edu", items)}
          />

          <SimpleListEditor
            title="Certifications"
            items={withIds(profile.certifications || [], "cert")}
            emptyItem={{ title: "", issuer: "", date: "", link: "" }}
            prefix="cert"
            fields={[
              ["title", "Title"],
              ["issuer", "Issuer"],
              ["date", "Date"],
              ["link", "Link"],
            ]}
            onChange={(items) => updateList("certifications", "cert", items)}
          />

          <SimpleListEditor
            title="Achievements"
            items={withIds(profile.achievements || [], "achievement")}
            emptyItem={{ title: "", description: "", date: "" }}
            prefix="achievement"
            fields={[
              ["title", "Title"],
              ["description", "Description"],
              ["date", "Date"],
            ]}
            onChange={(items) => updateList("achievements", "achievement", items)}
          />
        </div>
      </details>
    </section>
  );
}

export function SimpleListEditor({ title, items, emptyItem, prefix, fields, onChange }) {
  function updateItem(index, patch) {
    onChange(items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <section className="section-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...items, { id: createClientId(prefix), ...emptyItem }])}
        >
          <Plus size={16} />
          Add
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={item.id || index} className="rounded-md border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              {fields.map(([key, label]) => (
                <label key={key} className={key === "description" ? "md:col-span-2" : ""}>
                  <span className="field-label">{label}</span>
                  {key === "description" ? (
                    <textarea
                      className="textarea min-h-20"
                      value={item[key] || ""}
                      onChange={(event) => updateItem(index, { [key]: event.target.value })}
                    />
                  ) : (
                    <input
                      className="input"
                      value={Array.isArray(item[key]) ? item[key].join(", ") : item[key] || ""}
                      onChange={(event) =>
                        updateItem(index, {
                          [key]: Array.isArray(item[key]) ? splitCommaList(event.target.value) : event.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-danger mt-3"
              onClick={() => onChange(items.filter((_, currentIndex) => currentIndex !== index))}
            >
              <Trash2 size={16} />
              Remove
            </button>
          </div>
        ))}
        {!items.length ? <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No {title.toLowerCase()} added yet.</p> : null}
      </div>
    </section>
  );
}
