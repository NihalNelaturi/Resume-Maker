// Heuristic resume importer (no AI). Extracts plain text from an uploaded
// resume file (PDF / DOCX / TXT / MD) and parses it into the app's profile
// shape on a best-effort basis. The result is always meant to be reviewed and
// edited by the user — the profile is the source of truth.

const BULLET_RE = /^\s*[•▪◦‣·*‐-–—]\s+/;
const YEAR_RE = /\b(?:19|20)\d{2}\b/;
const DATE_RANGE_RE =
  /((?:19|20)\d{2}|present|current|now|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)[\s\S]*?$/i;

const SECTIONS = [
  { key: "professional_summary", patterns: ["professional summary", "summary", "profile", "objective", "about me", "about", "career objective", "personal profile", "executive summary"] },
  { key: "skills", patterns: ["technical skills", "core skills", "skills", "core competencies", "technologies", "tech stack", "expertise", "skills & expertise", "it skills"] },
  {
    key: "experience",
    patterns: ["work experience", "professional experience", "employment history", "experience", "employment", "work history", "relevant experience", "career history", "industry experience"],
  },
  { key: "projects", patterns: ["personal projects", "academic projects", "projects", "selected projects", "key projects", "technical projects", "software projects"] },
  { key: "education", patterns: ["education", "academic background", "academic qualifications", "education & certifications", "education & training", "education and training"] },
  { key: "certifications", patterns: ["certifications", "certificates", "licenses", "courses", "certifications & training"] },
  { key: "achievements", patterns: ["achievements", "awards", "honors", "accomplishments", "activities", "extracurriculars"] },
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detect a section heading. Returns { key, remainder } where remainder is any
// inline content that followed the heading on the same line (e.g. the "Python,
// SQL" in "Skills: Python, SQL"), or null when the line is not a heading.
//
// Matching is deliberately strict — whole-line headings, or a heading followed
// by an explicit ":"/"|" separator. Loose prefix/suffix matching is avoided
// because it misclassifies ordinary lines like "relevant experience" as
// headings and drops their content.
function despace(value) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function detectHeading(line) {
  const cleaned = cleanLine(line).replace(/^[#*_\s]+/g, "").replace(/[#*_]+$/g, "");
  if (!cleaned || cleaned.length > 100) return null;
  const lower = cleaned.toLowerCase().replace(/:$/, "").trim();
  const noSpaces = despace(lower);

  for (const section of SECTIONS) {
    for (const pattern of section.patterns) {
      // Whole-line heading. noSpaces also matches letter-spaced headings such
      // as "E X P E R I E N C E".
      if (lower === pattern || noSpaces === despace(pattern)) {
        return { key: section.key, remainder: "" };
      }
      // Inline heading with an explicit separator: "Skills: Python, SQL".
      const inline = cleaned.match(new RegExp(`^${escapeRegExp(pattern)}\\s*[:|]\\s*(.+)$`, "i"));
      if (inline) return { key: section.key, remainder: inline[1].trim() };
    }
  }

  // Letter-spaced heading possibly merged with following content, e.g.
  // "E D U C A T I O N B.Tech ..." -> heading EDUCATION, remainder "B.Tech ...".
  // Requires 3+ single letters separated by spaces, so normal prose never matches.
  const spaced = cleaned.match(/^((?:[A-Za-z]\s){2,}[A-Za-z])(.*)$/);
  if (spaced) {
    const letters = spaced[1].replace(/\s/g, "");
    const lettersLower = letters.toLowerCase();
    const trailing = spaced[2] || "";
    for (const section of SECTIONS) {
      for (const pattern of section.patterns) {
        const dp = despace(pattern);
        if (lettersLower === dp) {
          return { key: section.key, remainder: trailing.trim() };
        }
        // The heading abutted a following word: the extra letters past the
        // pattern (e.g. the "B" of "B.Tech") belong to the content.
        if (lettersLower.startsWith(dp)) {
          return { key: section.key, remainder: `${letters.slice(dp.length)}${trailing}`.trim() };
        }
      }
    }
  }

  return null;
}

function matchSectionHeading(line) {
  const heading = detectHeading(line);
  return heading ? heading.key : null;
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
  const candidates = lines.slice(0, 15).map(cleanLine).filter(Boolean);

  const isPlausible = (line, requireMultiWord) => {
    if (line.length > 45) return false;
    if (/@|https?:|www\.|linkedin|github|\d/i.test(line)) return false;
    if (matchSectionHeading(line)) return false;
    // Institutions/companies/degrees are not names.
    if (EDU_KEYWORD_RE.test(line) || ORG_KEYWORD_RE.test(line) || /\b(b\.?tech|b\.?e|b\.?sc|m\.?tech|bachelor|master|diploma)\b/i.test(line)) {
      return false;
    }
    const words = line.split(" ").filter(Boolean);
    if (words.length < (requireMultiWord ? 2 : 1) || words.length > 4) return false;
    // Each word should start with a capital letter (Latin or Greek).
    return words.every((word) => /^[\p{Lu}]/u.test(word)) && /\p{L}/u.test(line);
  };

  // Prefer a 2-4 word capitalized name; fall back to a single capitalized word.
  for (const line of candidates) {
    if (isPlausible(line, true)) return line;
  }
  for (const line of candidates) {
    if (isPlausible(line, false)) return line;
  }
  return personal.email ? personal.email.split("@")[0] : "";
}

function splitSections(lines) {
  const buckets = { header: [] };
  let current = "header";
  for (const raw of lines) {
    const heading = detectHeading(raw);
    if (heading) {
      current = heading.key;
      if (!buckets[current]) buckets[current] = [];
      // Keep any content that shared the heading's line (e.g. "Skills: Python, SQL").
      if (heading.remainder) buckets[current].push(heading.remainder);
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
  const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\w*\\.?";
  let withoutDate =
    line.replace(new RegExp(`\\s*[|,·–—-]?\\s*(?:${MONTH}\\s+)?((?:19|20)\\d{2}[\\s\\S]*)$`, "i"), "").trim() || line;
  withoutDate = withoutDate.replace(/[\s|·,–—-]+$/, "").trim(); // drop dangling separators
  return withoutDate
    .split(/\s+(?:at|@|\||·|—|–|-|,)\s+/i)
    .map((part) => cleanLine(part).replace(/[\s|·,–—-]+$/, "").trim())
    .filter(Boolean);
}

function looksLikeHeader(line) {
  // Distinguishes a real new entry header (e.g. "Software Engineer, Acme") from
  // a description sentence (e.g. "Contributed to research, driving growth.").
  if (YEAR_RE.test(line)) return true; // a dated line is a header
  const words = line.split(/\s+/);
  if (words.length > 8) return false; // long prose is a description, not a header
  if (!/^[\p{Lu}]/u.test(line)) return false; // headers start with a capital (Latin or Greek)
  if (/[.;:!?]$/.test(line)) return false; // a sentence end means it is a description
  // "Title at Company" / "Title | Company" / "Title · Company" style headers.
  if (/\s(?:at)\s|\s[|·—–]\s/i.test(line)) return true;
  // A short, mostly Title-Case line (most words start capitalised / are numbers).
  const capWords = words.filter((word) => /^[\p{Lu}0-9]/u.test(word)).length;
  return words.length <= 6 && capWords >= Math.ceil(words.length * 0.6);
}

function joinWrapped(previous, addition) {
  // Join a wrapped continuation line. A trailing hyphen is a real compound word
  // broken across lines ("next-" + "generation" -> "next-generation"), so keep
  // it and join without a space.
  if (previous.endsWith("-")) return previous + addition;
  return `${previous} ${addition}`;
}

function parseEntries(sectionLines) {
  // Group lines into entries. The first line (and any later line that looks like
  // a header) starts a new entry; every other line is content. Content captures
  // BOTH bullet points and plain description paragraphs (many resumes describe
  // roles in prose, not bullets). Wrapped continuation lines are joined back.
  const entries = [];
  let current = null;

  for (const raw of sectionLines) {
    const line = cleanLine(raw);
    if (!line) continue;

    const bulleted = isBullet(line);
    const text = bulleted ? stripBullet(line) : line;

    if (!current) {
      current = { header: line, bullets: [] };
      continue;
    }

    // A non-bulleted line that looks like a new entry header starts a new entry.
    if (!bulleted && looksLikeHeader(line)) {
      entries.push(current);
      current = { header: line, bullets: [] };
      continue;
    }

    // Otherwise it is content. Join a plain wrapped continuation onto the
    // previous content line when that line did not end a sentence.
    if (!bulleted && current.bullets.length > 0) {
      const prev = current.bullets[current.bullets.length - 1];
      if (prev && !/[.;:!?)\]]$/.test(prev)) {
        current.bullets[current.bullets.length - 1] = joinWrapped(prev, text);
        continue;
      }
    }
    current.bullets.push(text);
  }
  if (current) entries.push(current);
  return entries;
}

const ORG_KEYWORD_RE = /\b(inc|llc|ltd|corp|co|company|technolog|institute|university|college|labs?|systems?|solutions?|pvt|gmbh|studios?|agency|foundation|bank)\b/i;
const EDU_KEYWORD_RE = /\b(university|college|school|institute|academy|polytechnic|vidyalaya|gurukul)\b/i;

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
    const parts = splitHeaderParts(entry.header);
    const { start, end } = parseDates(entry.header);
    const title = parts[0] || entry.header;
    // Company: prefer a part that names an organization; else the second part.
    const orgPart = parts.slice(1).find((part) => ORG_KEYWORD_RE.test(part));
    const company = orgPart || parts[1] || "";
    profile.experience.push({
      title,
      company,
      location: "",
      start_date: start,
      end_date: end,
      bullets: entry.bullets,
    });
  });

  parseEntries(buckets.projects || []).forEach((entry) => {
    const parts = splitHeaderParts(entry.header);
    const { start, end } = parseDates(entry.header);
    // A bullet like "Technologies: X, Y" becomes the tech list; the rest stay bullets.
    const techBullet = entry.bullets.find((line) => /^(technologies|tech|tools|tech stack|stack)\b\s*[:|-]/i.test(line));
    const technologies = techBullet
      ? techBullet.replace(/^[^:|-]*[:|-]/, "").split(/[,•|·;/]+/).map(cleanLine).filter(Boolean)
      : [];
    profile.projects.push({
      name: parts[0] || entry.header,
      role: "",
      link: "",
      start_date: start,
      end_date: end,
      technologies,
      bullets: entry.bullets.filter((line) => line !== techBullet),
    });
  });

  parseEntries(buckets.education || []).forEach((entry) => {
    const { start, end } = parseDates(entry.header);
    const parts = splitHeaderParts(entry.header);
    const instIndex = parts.findIndex((part) => EDU_KEYWORD_RE.test(part));
    let institution = "";
    let degree = "";
    if (instIndex >= 0) {
      institution = parts[instIndex];
      degree = parts.filter((_, index) => index !== instIndex).join(", ") || entry.bullets[0] || "";
    } else {
      institution = parts[0] || entry.header;
      degree = parts.slice(1).join(", ") || entry.bullets[0] || "";
    }
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

function normalizeItem(item) {
  const transform = item.transform || [1, 0, 0, 1, 0, 0];
  const height = item.height || Math.abs(transform[3]) || 8;
  return {
    str: item.str || "",
    x: transform[4],
    y: transform[5],
    height,
    width: item.width || (item.str || "").length * height * 0.5,
  };
}

// Convert positioned items (a single column) into ordered text lines: group by
// baseline y, order each line left-to-right, and insert spaces at real gaps.
function linesFromItems(items) {
  const lines = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.height * 0.4));
    if (!line) {
      line = { y: item.y, height: item.height, parts: [] };
      lines.push(line);
    }
    line.parts.push(item);
  }
  lines.sort((a, b) => b.y - a.y); // PDF y grows upward
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
    .filter(Boolean);
}

// Detect a two-column layout by finding a vertical band (in the middle of the
// page) that no text crosses, with substantial content on both sides. Returns
// [leftItems, rightItems] or null for single-column pages.
function detectColumns(items) {
  if (items.length < 12) return null;
  const pageLeft = Math.min(...items.map((i) => i.x));
  const pageRight = Math.max(...items.map((i) => i.x + i.width));
  const width = pageRight - pageLeft;
  if (width <= 0) return null;

  let best = null;
  for (let frac = 0.3; frac <= 0.7; frac += 0.02) {
    const split = pageLeft + width * frac;
    let straddle = 0;
    let left = 0;
    let right = 0;
    for (const item of items) {
      const itemRight = item.x + item.width;
      if (item.x < split && itemRight > split) straddle += 1;
      else if (itemRight <= split) left += 1;
      else right += 1;
    }
    // Allow a few straddling items (a full-width header above the columns).
    if (straddle <= 4 && left >= 6 && right >= 6) {
      const score = Math.min(left, right) - straddle;
      if (!best || score > best.score) best = { split, score };
    }
  }
  if (!best) return null;

  // Header lines that span both columns are rendered first, then each column.
  const straddleItems = items.filter((i) => i.x < best.split && i.x + i.width > best.split);
  const leftItems = items.filter((i) => i.x + i.width <= best.split);
  const rightItems = items.filter((i) => i.x >= best.split);
  return [straddleItems, leftItems, rightItems].filter((group) => group.length);
}

// Reconstruct readable text from pdf.js text items. Handles single- and
// two-column layouts (so a skills sidebar doesn't get interleaved into the
// experience lines and break section detection).
export function reconstructPageText(items) {
  const normalized = items.map(normalizeItem).filter((item) => item.str.trim());
  if (!normalized.length) return "";

  const columns = detectColumns(normalized);
  const groups = columns || [normalized];
  return groups.map((group) => linesFromItems(group).join("\n")).filter(Boolean).join("\n");
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
