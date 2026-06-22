// Heuristic resume importer (no AI). Extracts plain text from an uploaded
// resume file (PDF / DOCX / TXT / MD) and parses it into the app's profile
// shape on a best-effort basis. The result is always meant to be reviewed and
// edited by the user — the profile is the source of truth.

const BULLET_RE = /^\s*[•▪◦‣·*‐-–—]\s+/;
const YEAR_RE = /\b(?:19|20)\d{2}\b/;
const DATE_RANGE_RE =
  /((?:19|20)\d{2}|present|current|now|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)[\s\S]*?$/i;

const SECTIONS = [
  { key: "professional_summary", patterns: ["professional summary", "summary", "profile", "objective", "about me", "about"] },
  { key: "skills", patterns: ["technical skills", "core skills", "skills", "core competencies", "technologies", "tech stack"] },
  {
    key: "experience",
    patterns: ["work experience", "professional experience", "employment history", "experience", "employment", "work history"],
  },
  { key: "projects", patterns: ["personal projects", "academic projects", "projects", "selected projects"] },
  { key: "education", patterns: ["education", "academic background", "academic qualifications"] },
  { key: "certifications", patterns: ["certifications", "certificates", "licenses", "courses"] },
  { key: "achievements", patterns: ["achievements", "awards", "honors", "accomplishments", "activities"] },
];

function cleanLine(line) {
  return String(line || "").replace(/\s+/g, " ").trim();
}

function isBullet(line) {
  return BULLET_RE.test(line);
}

function stripBullet(line) {
  return line.replace(BULLET_RE, "").trim();
}

function matchSectionHeading(line) {
  const normalized = cleanLine(line)
    .replace(/[:#*_]+$/g, "")
    .replace(/^[#*_\s]+/g, "")
    .toLowerCase()
    .trim();
  if (!normalized || normalized.length > 40 || normalized.split(" ").length > 4) return null;

  for (const section of SECTIONS) {
    if (section.patterns.some((pattern) => normalized === pattern || normalized === `${pattern}:`)) {
      return section.key;
    }
  }
  return null;
}

function extractContact(text) {
  const personal = { full_name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "" };

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) personal.email = email[0];

  const phone = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  if (phone && (phone[1].match(/\d/g) || []).length >= 8) personal.phone = phone[1].trim();

  const linkedin = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)|,]+/i);
  if (linkedin) personal.linkedin = linkedin[0];

  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)|,]+/i);
  if (github) personal.github = github[0];

  // First non-linkedin/github URL becomes the portfolio. Require a real TLD or
  // a path, and never reuse a fragment of the email address.
  const emailLower = personal.email.toLowerCase();
  const urls = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s)|,]*)?/gi) || [];
  const portfolio = urls.find((url) => {
    const lower = url.toLowerCase();
    if (/linkedin\.com|github\.com/.test(lower)) return false;
    if (emailLower && emailLower.includes(lower)) return false;
    return /(\.(com|io|dev|net|org|me|app|co|ai|xyz|tech|page|site|portfolio)\b|\/)/i.test(url);
  });
  if (portfolio) personal.portfolio = portfolio;

  // Location: a "City, ST" / "City, Country" segment near the top, avoiding
  // contact lines and skill lists.
  for (const raw of text.split("\n").slice(0, 6)) {
    const line = cleanLine(raw);
    if (!line) continue;
    for (const segment of line.split(/[|·•]/)) {
      const candidate = cleanLine(segment);
      if (!candidate || /@|https?:|www\.|linkedin|github|\d/i.test(candidate)) continue;
      const match = candidate.match(/^[A-Za-z][A-Za-z.'\- ]+,\s*[A-Za-z]{2,}$/);
      if (match && match[0].length <= 40) {
        personal.location = match[0];
        break;
      }
    }
    if (personal.location) break;
  }

  return personal;
}

function guessName(lines, personal) {
  for (const raw of lines.slice(0, 6)) {
    const line = cleanLine(raw);
    if (!line || line.length > 60) continue;
    if (/@|https?:|www\.|linkedin|github/i.test(line)) continue;
    if ((line.match(/\d/g) || []).length > 2) continue;
    if (matchSectionHeading(line)) continue;
    // A name is usually 1-5 words, mostly letters.
    const words = line.split(" ");
    if (words.length >= 1 && words.length <= 5 && /[a-z]/i.test(line)) {
      return line;
    }
  }
  return personal.email ? personal.email.split("@")[0] : "";
}

function splitSections(lines) {
  const buckets = { header: [] };
  let current = "header";
  for (const raw of lines) {
    const heading = matchSectionHeading(raw);
    if (heading) {
      current = heading;
      if (!buckets[current]) buckets[current] = [];
      continue;
    }
    if (!buckets[current]) buckets[current] = [];
    buckets[current].push(raw);
  }
  return buckets;
}

function parseDates(text) {
  // Pull a trailing date or date range from a header line.
  const range = text.match(/((?:19|20)\d{2}[^\n]*?(?:present|current|now|(?:19|20)\d{2}))/i);
  if (range) {
    const parts = range[1].split(/\s*[–—-]\s*|\s+to\s+|\s+–\s+/i);
    if (parts.length >= 2) return { start: cleanLine(parts[0]), end: cleanLine(parts[parts.length - 1]) };
    return { start: cleanLine(range[1]), end: "" };
  }
  const single = text.match(YEAR_RE);
  return single ? { start: single[0], end: "" } : { start: "", end: "" };
}

function splitHeaderParts(line) {
  // Remove a trailing date range, then split title/company by common separators.
  const withoutDate = line.replace(/\s*[|,–—-]?\s*((?:19|20)\d{2}[\s\S]*)$/i, "").trim() || line;
  const parts = withoutDate
    .split(/\s+(?:at|@|\||·|—|–|-|,)\s+/i)
    .map(cleanLine)
    .filter(Boolean);
  return parts;
}

function looksLikeHeader(line) {
  // Distinguishes a real new entry header from a wrapped bullet continuation.
  if (YEAR_RE.test(line)) return true;
  const words = line.split(/\s+/);
  if (words.length > 10) return false; // long prose is almost certainly a wrap
  if (!/^[\p{Lu}]/u.test(line)) return false; // headers start with a capital (Latin or Greek)
  if (/[.;:]$/.test(line)) return false; // continuations usually end with punctuation
  if (/\s[-–—|]\s|,|\bat\b|@/i.test(line)) return true; // header-style separators
  return words.length <= 6; // a short Title-case line
}

function parseEntries(sectionLines) {
  // Group lines into entries. A bullet line attaches to the current entry; a
  // non-bullet line starts a new entry only if it looks like a header,
  // otherwise it is treated as a wrapped continuation of the previous bullet
  // (this prevents wrapped bullets from becoming spurious bold "titles").
  const entries = [];
  let current = null;

  for (const raw of sectionLines) {
    const line = cleanLine(raw);
    if (!line) continue;

    if (isBullet(line)) {
      if (!current) current = { header: "", bullets: [], extra: [] };
      current.bullets.push(stripBullet(line));
      continue;
    }

    if (!current) {
      current = { header: line, bullets: [], extra: [] };
    } else if (current.bullets.length === 0) {
      // Non-bullet line right under a header with no bullets yet: detail line
      // (e.g. a degree under an institution), unless it is clearly a new header.
      if (looksLikeHeader(line) && current.extra.length > 0) {
        entries.push(current);
        current = { header: line, bullets: [], extra: [] };
      } else {
        current.extra.push(line);
      }
    } else if (looksLikeHeader(line)) {
      entries.push(current);
      current = { header: line, bullets: [], extra: [] };
    } else {
      // Wrapped continuation of the previous bullet.
      current.bullets[current.bullets.length - 1] += ` ${line}`;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function parseSkills(sectionLines) {
  const skills = {};
  for (const raw of sectionLines) {
    const line = stripBullet(cleanLine(raw));
    if (!line) continue;
    const colon = line.indexOf(":");
    let category = "Skills";
    let itemsText = line;
    if (colon > 0 && colon < 40) {
      category = cleanLine(line.slice(0, colon)) || "Skills";
      itemsText = line.slice(colon + 1);
    }
    const items = itemsText
      .split(/[,•|·;/]+/)
      .map(cleanLine)
      .filter((item) => item && item.length <= 40);
    if (!items.length) continue;
    skills[category] = [...(skills[category] || []), ...items];
  }
  // De-duplicate items within each category.
  Object.keys(skills).forEach((category) => {
    skills[category] = [...new Set(skills[category])];
  });
  return skills;
}

export function parseResumeText(text) {
  const safe = String(text || "").replace(/\r\n?/g, "\n");
  const lines = safe.split("\n");
  const personal = extractContact(safe);
  personal.full_name = guessName(lines, personal);

  const buckets = splitSections(lines);

  const profile = {
    personal: { ...personal, professional_summary: "" },
    skills: parseSkills(buckets.skills || []),
    experience: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: [],
    bulletBank: {},
  };

  if (buckets.professional_summary) {
    profile.personal.professional_summary = buckets.professional_summary
      .map(cleanLine)
      .filter(Boolean)
      .join(" ")
      .slice(0, 880);
  }

  parseEntries(buckets.experience || []).forEach((entry) => {
    const [title = "", company = ""] = splitHeaderParts(entry.header);
    const { start, end } = parseDates(entry.header);
    profile.experience.push({
      title: title || entry.header,
      company,
      location: "",
      start_date: start,
      end_date: end,
      bullets: entry.bullets,
    });
  });

  parseEntries(buckets.projects || []).forEach((entry) => {
    const [name = ""] = splitHeaderParts(entry.header);
    const { start, end } = parseDates(entry.header);
    const techLine = entry.extra.find((line) => /^(technologies|tech|tools|stack)\b/i.test(line));
    const technologies = techLine
      ? techLine
          .replace(/^[^:]*:/, "")
          .split(/[,•|·;/]+/)
          .map(cleanLine)
          .filter(Boolean)
      : [];
    profile.projects.push({
      name: name || entry.header,
      role: "",
      link: "",
      start_date: start,
      end_date: end,
      technologies,
      bullets: entry.bullets,
    });
  });

  parseEntries(buckets.education || []).forEach((entry) => {
    const { start, end } = parseDates(entry.header);
    const institution = splitHeaderParts(entry.header)[0] || entry.header;
    const degree = entry.extra[0] || entry.bullets[0] || "";
    profile.education.push({
      institution,
      degree,
      location: "",
      start_date: start,
      end_date: end,
      score: "",
      coursework: [],
    });
  });

  (buckets.certifications || []).forEach((raw) => {
    const line = stripBullet(cleanLine(raw));
    if (!line) return;
    const { start } = parseDates(line);
    profile.certifications.push({
      title: line.replace(DATE_RANGE_RE, "").replace(/[(),|–-]+\s*$/, "").trim() || line,
      issuer: "",
      date: start,
      link: "",
    });
  });

  (buckets.achievements || []).forEach((raw) => {
    const line = stripBullet(cleanLine(raw));
    if (!line) return;
    profile.achievements.push({ title: line, description: "", date: "" });
  });

  return profile;
}

export function summarizeImport(profile) {
  const skillCount = Object.values(profile.skills || {}).reduce((sum, items) => sum + items.length, 0);
  return {
    experience: profile.experience.length,
    projects: profile.projects.length,
    education: profile.education.length,
    skills: skillCount,
    certifications: profile.certifications.length,
    achievements: profile.achievements.length,
    hasName: Boolean(profile.personal.full_name),
    hasEmail: Boolean(profile.personal.email),
  };
}

// --- File text extraction (lazy-loads heavy parsers only when needed) --------

// Reconstruct readable lines from pdf.js text items using their positions.
// Relying on item.hasEOL alone is unreliable (often false for every item,
// which collapses the whole page into one line), so we group items by their
// baseline y, order each line left-to-right, and insert spaces at real gaps.
export function reconstructPageText(items) {
  const lines = [];

  for (const item of items) {
    const str = item.str || "";
    if (!str.trim()) continue;
    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4];
    const y = transform[5];
    const height = item.height || Math.abs(transform[3]) || 8;
    const width = item.width || str.length * height * 0.5;

    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, height * 0.4));
    if (!line) {
      line = { y, height, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, width, str });
  }

  // PDF y grows upward, so larger y is higher on the page.
  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) => {
      line.parts.sort((a, b) => a.x - b.x);
      let text = "";
      let prevEnd = null;
      for (const part of line.parts) {
        if (prevEnd !== null) {
          const gap = part.x - prevEnd;
          if (gap > Math.max(1, line.height * 0.25) && !text.endsWith(" ") && !part.str.startsWith(" ")) {
            text += " ";
          }
        }
        text += part.str;
        prevEnd = part.x + part.width;
      }
      return text.replace(/[ \t]+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function extractPdfText(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${reconstructPageText(content.items)}\n\n`;
  }
  return text;
}

async function extractDocxText(file) {
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractTextFromFile(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  // .txt, .md, and anything else: read as plain text.
  return file.text();
}

export const IMPORT_ACCEPT = ".pdf,.docx,.txt,.md,text/plain,application/pdf";
