import { defaultProfile, defaultVersions } from "../data/defaultProfile.js";

export const STORAGE_KEYS = {
  profile: "resumeCommandCenter.profile.v1",
  versions: "resumeCommandCenter.versions.v1",
  activeVersionId: "resumeCommandCenter.activeVersionId.v1",
};

const DEFAULT_SECTION_ORDER = [
  "professional_summary",
  "experience",
  "projects",
  "education",
  "certifications",
  "skills",
  "achievements",
];

const LEGACY_DEMO_MARKERS = {
  projectId: "project-resume-maker",
  experienceId: "exp-research-intern",
};

function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function readJson(key) {
  if (typeof window === "undefined") return { ok: true, value: null };

  try {
    const raw = window.localStorage.getItem(key);
    return { ok: true, value: raw ? JSON.parse(raw) : null };
  } catch {
    return { ok: false, value: null };
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Saving to localStorage can fail in private browsing or quota-exceeded states.
  }
}

export function createClientId(prefix = "item") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadCommandCenterState() {
  const profileResult = readJson(STORAGE_KEYS.profile);
  const versionsResult = readJson(STORAGE_KEYS.versions);
  const rawProfile = profileResult.value ?? defaultProfile;
  const rawVersions = versionsResult.value ?? defaultVersions;
  const activeVersionId = readActiveVersionId();
  const fallbackActiveVersionId = Array.isArray(rawVersions) && rawVersions[0]?.id ? rawVersions[0].id : defaultVersions[0].id;

  return normalizeCommandCenterState({
    profile: rawProfile,
    versions: rawVersions,
    activeVersionId: activeVersionId || fallbackActiveVersionId,
    recoveredFromCorruption: !profileResult.ok || !versionsResult.ok,
  });
}

export function profileToStorage(profile) {
  if (!profile) return profile;
  const skillsArr = Array.isArray(profile.skills) ? profile.skills : [];
  const skillsObj = {};
  skillsArr.forEach((group) => {
    const category = String(group.category || "").trim();
    if (category) {
      skillsObj[category] = (group.items || []).map((item) => String(item || "").trim()).filter(Boolean);
    }
  });
  return {
    ...profile,
    skills: skillsObj,
  };
}

export function saveCommandCenterState({ profile, versions, activeVersionId }) {
  writeJson(STORAGE_KEYS.profile, profileToStorage(profile));
  writeJson(STORAGE_KEYS.versions, versions);
  if (typeof window !== "undefined" && activeVersionId) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.activeVersionId, activeVersionId);
    } catch {
      // Ignore storage failures so the app state remains usable in memory.
    }
  }
}

export function createCommandCenterBackup({ profile, versions, activeVersionId }) {
  return {
    schema: "resume-command-center-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      profile: profileToStorage(profile),
      versions,
      activeVersionId,
    },
  };
}

export function validateCommandCenterBackup(value) {
  if (!value || typeof value !== "object") {
    return { valid: false, error: "Backup must be a JSON object." };
  }

  if (value.schema !== "resume-command-center-backup" || value.version !== 1) {
    return { valid: false, error: "Backup schema or version is not supported." };
  }

  const data = value.data;
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Backup data is missing." };
  }

  const { profile, versions, activeVersionId } = data;
  if (!isValidProfile(profile)) {
    return { valid: false, error: "Backup profile shape is invalid." };
  }

  if (!Array.isArray(versions) || !versions.length || !versions.every(isValidVersion)) {
    return { valid: false, error: "Backup versions shape is invalid." };
  }

  if (typeof activeVersionId !== "string" || !versions.some((version) => version.id === activeVersionId)) {
    return { valid: false, error: "Backup active version does not match any version." };
  }

  return {
    valid: true,
    data: normalizeCommandCenterState({
      profile,
      versions,
      activeVersionId,
    }),
  };
}

export function resetCommandCenterStorage() {
  if (typeof window === "undefined") return;
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
}

export function makeBlankVersion(existingVersions = [], overrides = {}) {
  const now = new Date().toISOString();

  return normalizeVersion({
    id: createClientId("version"),
    name: makeUniqueVersionName(overrides.name || "New Resume Version", existingVersions),
    targetRole: overrides.targetRole || "Software Engineer",
    targetCompany: overrides.targetCompany || "",
    selectedProjectIds: [],
    selectedExperienceIds: [],
    selectedSkillNames: [],
    generatedLatex: "",
    generatedPdfName: "",
    analyzerScore: null,
    jobDescription: "",
    jobDescriptionAnalysis: null,
    lastUpdated: now,
  });
}

export function makeVersionFromCurrent(version, existingVersions = []) {
  const sourceVersion = version || {
    id: "version-current",
    name: "Resume Version",
    targetRole: "Software Engineer",
    targetCompany: "",
    selectedProjectIds: [],
    selectedExperienceIds: [],
    selectedSkillNames: [],
  };

  return {
    ...normalizeVersion(sourceVersion),
    id: createClientId("version"),
    name: makeDuplicateVersionName(sourceVersion.name || "Resume Version", existingVersions),
    generatedLatex: "",
    generatedPdfName: "",
    analyzerScore: null,
    jobDescriptionAnalysis: null,
    lastUpdated: new Date().toISOString(),
  };
}

function makeUniqueVersionName(baseName, existingVersions = []) {
  const existingNames = new Set(existingVersions.map((version) => version.name).filter(Boolean));
  const cleanBase = normalizeVersionName(baseName);

  if (!existingNames.has(cleanBase)) return cleanBase;

  let copyNumber = 2;
  while (existingNames.has(`${cleanBase} ${copyNumber}`)) {
    copyNumber += 1;
  }
  return `${cleanBase} ${copyNumber}`;
}

export function makeDuplicateVersionName(baseName, existingVersions = []) {
  const existingNames = new Set(existingVersions.map((version) => version.name).filter(Boolean));
  const cleanBase = stripCopySuffixes(baseName);
  const firstCopy = `${cleanBase} Copy`;

  if (!existingNames.has(firstCopy)) return firstCopy;

  let copyNumber = 2;
  while (existingNames.has(`${cleanBase} Copy ${copyNumber}`)) {
    copyNumber += 1;
  }
  return `${cleanBase} Copy ${copyNumber}`;
}

export function normalizeCommandCenterState({ profile, versions, activeVersionId, recoveredFromCorruption = false }) {
  const profileValid = isValidProfile(profile) && !isLegacyDemoProfile(profile);
  const nextProfile = profileValid ? normalizeProfile(profile) : deepClone(defaultProfile);
  const nextVersions = normalizeVersions(versions, nextProfile);
  const activeVersionValid = nextVersions.some((version) => version.id === activeVersionId);
  const nextActiveVersionId = activeVersionValid
    ? activeVersionId
    : nextVersions[0].id;

  return {
    profile: nextProfile,
    versions: nextVersions,
    activeVersionId: nextActiveVersionId,
    recoveredFromCorruption:
      recoveredFromCorruption ||
      !profileValid ||
      !Array.isArray(versions) ||
      nextVersions.length !== versions.length ||
      !activeVersionValid,
  };
}

function readActiveVersionId() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(STORAGE_KEYS.activeVersionId);
  } catch {
    return null;
  }
}

function normalizeProfile(profile) {
  return {
    personal: {
      full_name: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      professional_summary: "",
      ...profile.personal,
    },
    skills: normalizeSkills(profile.skills),
    experience: normalizeProfileItems(profile.experience, "exp"),
    projects: normalizeProfileItems(profile.projects, "project"),
    education: normalizeProfileItems(profile.education, "edu"),
    certifications: normalizeProfileItems(profile.certifications, "cert"),
    achievements: normalizeProfileItems(profile.achievements, "achievement"),
    sectionOrder: Array.isArray(profile.sectionOrder) ? profile.sectionOrder : [...DEFAULT_SECTION_ORDER],
    bulletBank: profile.bulletBank || {},
  };
}

function normalizeVersion(version, profile = null) {
  const validProjectIds = new Set((profile?.projects || []).map((project) => project.id));
  const validExperienceIds = new Set((profile?.experience || []).map((item) => item.id));
  const validSkillNames = Array.isArray(profile?.skills)
    ? new Set(profile.skills.flatMap((group) => group.items || []))
    : new Set(Object.values(profile?.skills || {}).flat());
  const jobDescription = typeof version.jobDescription === "string"
    ? version.jobDescription
    : typeof version.jobDescriptionText === "string"
      ? version.jobDescriptionText
      : "";

  return {
    id: version.id,
    name: normalizeVersionName(version.name),
    targetRole: typeof version.targetRole === "string" && version.targetRole.trim() ? version.targetRole : "Software Engineer",
    targetCompany: typeof version.targetCompany === "string" ? version.targetCompany : "",
    selectedProjectIds: filterSelectableValues(version.selectedProjectIds, validProjectIds, profile),
    selectedExperienceIds: filterSelectableValues(version.selectedExperienceIds, validExperienceIds, profile),
    selectedSkillNames: filterSelectableValues(version.selectedSkillNames, validSkillNames, profile),
    generatedLatex: version.generatedLatex || "",
    generatedPdfName: version.generatedPdfName || "",
    analyzerScore: version.analyzerScore || null,
    jobDescription,
    jobDescriptionText: jobDescription,
    jobDescriptionAnalysis: version.jobDescriptionAnalysis || null,
    lastUpdated: typeof version.lastUpdated === "string" && version.lastUpdated ? version.lastUpdated : new Date().toISOString(),
  };
}

function normalizeVersionName(name) {
  const rawName = typeof name === "string" && name.trim() ? name.trim().replace(/\s+/g, " ") : "Untitled Version";
  const suffixMatches = rawName.match(/(?:\s+Copy(?:\s+\d+)?)+$/i);
  if (!suffixMatches) return rawName;

  const suffix = suffixMatches[0];
  const base = stripCopySuffixes(rawName);
  const numberedCopy = suffix.match(/Copy\s+(\d+)\s*$/i);

  if (numberedCopy) return `${base} Copy ${numberedCopy[1]}`;
  return `${base} Copy`;
}

function stripCopySuffixes(name) {
  return String(name || "Resume Version").replace(/(?:\s+Copy(?:\s+\d+)?)+$/i, "").trim() || "Resume Version";
}

function normalizeVersions(versions, profile) {
  const sourceVersions = Array.isArray(versions) && versions.length ? versions : defaultVersions;
  const seenIds = new Set();
  const normalized = [];

  sourceVersions.forEach((version) => {
    if (!isRecoverableVersion(version) || seenIds.has(version.id)) return;
    seenIds.add(version.id);
    normalized.push(normalizeVersion(version, profile));
  });

  if (normalized.length) return normalized;
  return defaultVersions.map((version) => normalizeVersion(version, profile));
}

function filterSelectableValues(values, allowedValues, profile) {
  const list = isStringArray(values) ? values : [];
  if (!profile) return list;
  return list.filter((value) => allowedValues.has(value));
}

function normalizeSkills(skills) {
  if (Array.isArray(skills)) {
    return skills.map((group) => ({
      id: typeof group.id === "string" && group.id.trim() ? group.id : createClientId("skill"),
      category: typeof group.category === "string" ? group.category : "",
      items: Array.isArray(group.items) ? group.items.map((item) => String(item || "").trim()).filter(Boolean) : [],
    }));
  }
  const skillsObj = isObject(skills) ? skills : {};
  return Object.entries(skillsObj).map(([category, items]) => ({
    id: createClientId("skill"),
    category: String(category || "").trim(),
    items: Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [],
  }));
}

function normalizeProfileItems(items, prefix) {
  if (!Array.isArray(items)) return [];
  return items
    .filter(isObject)
    .map((item) => ({
      ...item,
      id: typeof item.id === "string" && item.id.trim() ? item.id : createClientId(prefix),
    }));
}

function isLegacyDemoProfile(profile) {
  return (
    profile?.projects?.some((project) => project?.id === LEGACY_DEMO_MARKERS.projectId) &&
    profile?.experience?.some((item) => item?.id === LEGACY_DEMO_MARKERS.experienceId)
  );
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isValidProfile(profile) {
  return (
    isObject(profile) &&
    isObject(profile.personal) &&
    isObject(profile.skills) &&
    Object.values(profile.skills).every(isStringArray) &&
    Array.isArray(profile.experience) &&
    Array.isArray(profile.projects) &&
    Array.isArray(profile.education) &&
    Array.isArray(profile.certifications) &&
    Array.isArray(profile.achievements) &&
    isObject(profile.bulletBank) &&
    (profile.sectionOrder === undefined || Array.isArray(profile.sectionOrder))
  );
}

function isValidVersion(version) {
  return (
    isRecoverableVersion(version) &&
    typeof version.id === "string" &&
    typeof version.name === "string" &&
    typeof version.targetRole === "string" &&
    typeof version.targetCompany === "string" &&
    isStringArray(version.selectedProjectIds) &&
    isStringArray(version.selectedExperienceIds) &&
    isStringArray(version.selectedSkillNames) &&
    // Older backups may include templateId from the removed template selector.
    (version.templateId === undefined || typeof version.templateId === "string") &&
    (version.jobDescription === undefined || typeof version.jobDescription === "string") &&
    (version.jobDescriptionText === undefined || typeof version.jobDescriptionText === "string") &&
    (version.jobDescriptionAnalysis === undefined ||
      version.jobDescriptionAnalysis === null ||
      isObject(version.jobDescriptionAnalysis))
  );
}

function isRecoverableVersion(version) {
  return isObject(version) && typeof version.id === "string" && Boolean(version.id.trim());
}
