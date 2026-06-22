export const DEFAULT_SECTION_ORDER = [
  "professional_summary",
  "experience",
  "projects",
  "education",
  "certifications",
  "skills",
  "achievements",
];

function stripId(item) {
  const { id, ...rest } = item;
  return rest;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeList(values = []) {
  return values.map(normalizeText).filter(Boolean);
}

export function getAllSkillNames(profile) {
  return Object.values(profile.skills || {}).flat().filter(Boolean);
}

export function resumeFromProfileVersion(profile, version) {
  const selectedSkillNames = new Set(version?.selectedSkillNames || []);
  const selectedProjectIds = new Set(version?.selectedProjectIds || []);
  const selectedExperienceIds = new Set(version?.selectedExperienceIds || []);

  const skills = Object.entries(profile.skills || {})
    .map(([category, items]) => ({
      category,
      items: normalizeList(items).filter((item) => selectedSkillNames.has(item)),
    }))
    .filter((skill) => skill.items.length);

  return {
    header: {
      full_name: profile.personal?.full_name || "",
      email: profile.personal?.email || "",
      phone: profile.personal?.phone || "",
      location: profile.personal?.location || "",
      linkedin: profile.personal?.linkedin || "",
      github: profile.personal?.github || "",
      portfolio: profile.personal?.portfolio || "",
    },
    professional_summary: profile.personal?.professional_summary || "",
    skills,
    experience: (profile.experience || [])
      .filter((item) => selectedExperienceIds.has(item.id))
      .map(stripId),
    projects: (profile.projects || [])
      .filter((project) => selectedProjectIds.has(project.id))
      .map(stripId),
    education: (profile.education || []).map(stripId),
    certifications: (profile.certifications || []).map(stripId),
    achievements: (profile.achievements || []).map(stripId),
    section_order: DEFAULT_SECTION_ORDER,
  };
}

// Build a resume from the entire profile (every item included). Used by the
// single-resume tabbed editor, which has no per-version item selection.
export function resumeFromProfile(profile) {
  const skills = Object.entries(profile.skills || {})
    .map(([category, items]) => ({ category, items: normalizeList(items) }))
    .filter((skill) => skill.items.length);

  return {
    header: {
      full_name: profile.personal?.full_name || "",
      email: profile.personal?.email || "",
      phone: profile.personal?.phone || "",
      location: profile.personal?.location || "",
      linkedin: profile.personal?.linkedin || "",
      github: profile.personal?.github || "",
      portfolio: profile.personal?.portfolio || "",
    },
    professional_summary: profile.personal?.professional_summary || "",
    skills,
    experience: (profile.experience || []).map(stripId),
    projects: (profile.projects || []).map(stripId),
    education: (profile.education || []).map(stripId),
    certifications: (profile.certifications || []).map(stripId),
    achievements: (profile.achievements || []).map(stripId),
    section_order: DEFAULT_SECTION_ORDER,
  };
}

export function removeEmptyOptionalFields(value) {
  if (Array.isArray(value)) {
    return value
      .map(removeEmptyOptionalFields)
      .filter((item) => !(typeof item === "string" && item.trim() === ""));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, removeEmptyOptionalFields(item)]),
    );
  }

  return typeof value === "string" ? value.trim() : value;
}

export function updateResumeBullet(resume, rewrite) {
  const next = {
    ...resume,
    experience: (resume.experience || []).map((item) => ({ ...item, bullets: [...(item.bullets || [])] })),
    projects: (resume.projects || []).map((project) => ({ ...project, bullets: [...(project.bullets || [])] })),
  };

  if (rewrite.section === "experience" && next.experience[rewrite.item_index]) {
    next.experience[rewrite.item_index].bullets[rewrite.bullet_index] = rewrite.rewritten;
  }

  if (rewrite.section === "projects" && next.projects[rewrite.item_index]) {
    next.projects[rewrite.item_index].bullets[rewrite.bullet_index] = rewrite.rewritten;
  }

  return next;
}

function updateBulletAtIndex(item, bulletIndex, value) {
  if (!Number.isInteger(bulletIndex) || bulletIndex < 0) return item;

  const bullets = Array.isArray(item.bullets) ? [...item.bullets] : [];
  while (bullets.length <= bulletIndex) {
    bullets.push("");
  }
  bullets[bulletIndex] = value;
  return { ...item, bullets };
}

function updateSelectedProfileBullet(items = [], selectedIds = [], rewrite) {
  const selectedIdSet = new Set(selectedIds);
  const selectedItems = items.filter((item) => selectedIdSet.has(item.id));
  const targetId = selectedItems[rewrite.item_index]?.id;

  if (!targetId) return items;

  return items.map((item) =>
    item.id === targetId ? updateBulletAtIndex(item, rewrite.bullet_index, rewrite.rewritten) : item,
  );
}

export function updateProfileBulletFromRewrite(profile, version, rewrite) {
  if (!rewrite?.changed || typeof rewrite.rewritten !== "string") return profile;

  if (rewrite.section === "projects") {
    return {
      ...profile,
      projects: updateSelectedProfileBullet(profile.projects || [], version?.selectedProjectIds || [], rewrite),
    };
  }

  if (rewrite.section === "experience") {
    return {
      ...profile,
      experience: updateSelectedProfileBullet(profile.experience || [], version?.selectedExperienceIds || [], rewrite),
    };
  }

  return profile;
}

export function downloadTextFile(text, filename, mimeType = "text/plain") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
