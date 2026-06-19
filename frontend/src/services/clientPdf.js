import { jsPDF } from "jspdf";
import { getTemplate } from "./pdfTemplates.js";

// Embedded Unicode fonts. jsPDF's built-in fonts are Latin-1 only and render
// non-Latin text (Greek, Cyrillic, accented characters) as garbage, so we
// register DejaVu TTFs that cover those scripts. Fonts are fetched once from
// /fonts and cached; PDFs are subsetted to keep file size small.
const FONT_FAMILIES = {
  sans: {
    name: "DejaVuSans",
    normal: "/fonts/DejaVuSans.ttf",
    bold: "/fonts/DejaVuSans-Bold.ttf",
  },
  serif: {
    name: "DejaVuSerif",
    normal: "/fonts/DejaVuSerif.ttf",
    bold: "/fonts/DejaVuSerif-Bold.ttf",
  },
};

const fontBase64Cache = new Map();

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchFontBase64(url) {
  if (fontBase64Cache.has(url)) return fontBase64Cache.get(url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load font ${url} (HTTP ${response.status})`);
  }
  const base64 = arrayBufferToBase64(await response.arrayBuffer());
  fontBase64Cache.set(url, base64);
  return base64;
}

async function registerFontFamily(doc, familyKey) {
  const family = FONT_FAMILIES[familyKey] || FONT_FAMILIES.sans;
  const [normalB64, boldB64] = await Promise.all([
    fetchFontBase64(family.normal),
    fetchFontBase64(family.bold),
  ]);

  doc.addFileToVFS(`${family.name}.ttf`, normalB64);
  doc.addFont(`${family.name}.ttf`, family.name, "normal");
  doc.addFileToVFS(`${family.name}-Bold.ttf`, boldB64);
  doc.addFont(`${family.name}-Bold.ttf`, family.name, "bold");
  return family.name;
}

const page = {
  width: 612,
  height: 792,
  marginX: 32,
  marginY: 26,
  bottom: 774,
};

const TEXT_COLOR = [24, 33, 47];
const LINK_BLUE = [29, 78, 216];

// Base spacing constants; scaled per-template by theme.density.
const BASE = {
  sectionTopGap: 6.2,
  sectionBodyGap: 17,
  nameToContactGap: 20,
  headerToFirstSectionGap: 11.5,
};

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function joinPresent(values, separator = " | ") {
  return values.map(safeText).filter(Boolean).join(separator);
}

function dateRange(start, end) {
  return joinPresent([start, end], " - ");
}

function normalizeWebUrl(value) {
  const cleaned = safeText(value).replace(/\s+/g, "");
  if (!cleaned) return "";

  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(cleaned) ? cleaned : `https://${cleaned}`;
    const parsed = new URL(withScheme);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function contactItems(header) {
  const items = [];

  if (safeText(header.email)) {
    items.push({ label: safeText(header.email), url: `mailto:${safeText(header.email)}` });
  }

  if (safeText(header.phone)) items.push({ label: safeText(header.phone) });
  if (safeText(header.location)) items.push({ label: safeText(header.location) });

  ["linkedin", "github", "portfolio"].forEach((field) => {
    const label = safeText(header[field]);
    const url = normalizeWebUrl(header[field]);
    if (label && url) items.push({ label, url });
  });

  return items;
}

function drawContactLine(ctx, items, y, maxWidth) {
  const { doc, theme } = ctx;
  if (!items.length) return y;

  const separator = "  |  ";
  const align = theme.headerAlign;
  const rows = [];
  let currentRow = [];
  let currentWidth = 0;

  items.forEach((item) => {
    const separatorWidth = currentRow.length ? doc.getTextWidth(separator) : 0;
    const itemWidth = doc.getTextWidth(item.label) + separatorWidth;

    if (currentRow.length && currentWidth + itemWidth > maxWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentWidth = doc.getTextWidth(item.label);
    } else {
      currentRow.push(item);
      currentWidth += itemWidth;
    }
  });

  if (currentRow.length) rows.push(currentRow);

  rows.forEach((row) => {
    const rowWidth = row.reduce(
      (sum, item, index) => sum + doc.getTextWidth(item.label) + (index ? doc.getTextWidth(separator) : 0),
      0,
    );
    let x = align === "left" ? page.marginX : page.width / 2 - rowWidth / 2;

    row.forEach((item, index) => {
      if (index) {
        doc.setTextColor(...TEXT_COLOR);
        doc.text(separator, x, y);
        x += doc.getTextWidth(separator);
      }

      if (item.url) {
        doc.setTextColor(...LINK_BLUE);
        if (typeof doc.textWithLink === "function") {
          doc.textWithLink(item.label, x, y, { url: item.url });
        } else {
          doc.text(item.label, x, y);
        }
      } else {
        doc.setTextColor(...TEXT_COLOR);
        doc.text(item.label, x, y);
      }
      x += doc.getTextWidth(item.label);
    });

    doc.setTextColor(...TEXT_COLOR);
    y += 10.8;
  });

  return y;
}

function filenameFromName(name) {
  const slug = safeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "resume"}-resume.pdf`;
}

function addPageIfNeeded(doc, y, needed = 24) {
  if (y + needed <= page.bottom) return y;
  doc.addPage();
  return page.marginY;
}

function writeWrapped(ctx, text, x, y, maxWidth, options = {}) {
  const { doc, theme } = ctx;
  const {
    fontSize = 9.5,
    lineHeight = 12,
    style = "normal",
    bullet = false,
  } = options;
  const font = options.font || theme.font;

  const normalized = safeText(text);
  if (!normalized) return y;

  doc.setFont(font, style);
  doc.setFontSize(fontSize);

  const bulletIndent = 11;
  const textX = bullet ? x + bulletIndent : x;
  const lines = doc.splitTextToSize(normalized, maxWidth - (bullet ? bulletIndent : 0));
  let nextY = y;

  lines.forEach((line, index) => {
    nextY = addPageIfNeeded(doc, nextY, lineHeight);
    if (bullet && index === 0) {
      // Real bullet glyph rather than a hyphen.
      doc.text("•", x, nextY);
    }
    doc.text(line, textX, nextY);
    nextY += lineHeight;
  });

  return nextY;
}

function writeLabeledWrapped(ctx, label, text, x, y, maxWidth, options = {}) {
  const { doc, theme } = ctx;
  const {
    fontSize = 9.4,
    lineHeight = 11.5,
    labelStyle = "bold",
    valueStyle = "normal",
  } = options;
  const font = options.font || theme.font;
  const normalizedLabel = safeText(label);
  const normalizedText = safeText(text);

  if (!normalizedLabel && !normalizedText) return y;
  if (!normalizedLabel) {
    return writeWrapped(ctx, normalizedText, x, y, maxWidth, { fontSize, lineHeight, font, style: valueStyle });
  }

  doc.setFont(font, labelStyle);
  doc.setFontSize(fontSize);
  const labelText = `${normalizedLabel}: `;
  const labelWidth = doc.getTextWidth(labelText);
  const valueX = x + labelWidth;

  doc.setFont(font, valueStyle);
  const lines = doc.splitTextToSize(normalizedText, Math.max(120, maxWidth - labelWidth));
  const renderedLines = lines.length ? lines : [""];
  let nextY = y;

  renderedLines.forEach((line, index) => {
    nextY = addPageIfNeeded(doc, nextY, lineHeight);
    if (index === 0) {
      doc.setFont(font, labelStyle);
      doc.text(labelText, x, nextY);
      doc.setFont(font, valueStyle);
      if (line) doc.text(line, valueX, nextY);
    } else if (line) {
      doc.setFont(font, valueStyle);
      doc.text(line, valueX, nextY);
    }
    nextY += lineHeight;
  });

  return nextY;
}

function sectionHeading(ctx, title, y, { first = false } = {}) {
  const { doc, theme, spacing } = ctx;
  const topGap = first ? 0 : spacing.sectionTopGap;
  y = addPageIfNeeded(doc, y + topGap, 22);

  const accent = theme.accent;
  const headingColor = theme.headingStyle === "rule" ? TEXT_COLOR : accent;

  if (theme.headingStyle === "filled") {
    // Light accent band behind the heading text.
    const bandHeight = 13;
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.setGState && doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.rect(page.marginX - 4, y - 9.5, page.width - page.marginX * 2 + 8, bandHeight, "F");
    doc.setGState && doc.setGState(new doc.GState({ opacity: 1 }));
  }

  doc.setTextColor(...headingColor);
  doc.setFont(theme.font, "bold");
  doc.setFontSize(10.9);
  doc.text(title.toUpperCase(), page.marginX, y);

  if (theme.headingStyle !== "filled") {
    const ruleColor = theme.headingStyle === "accentRule" ? accent : TEXT_COLOR;
    doc.setDrawColor(ruleColor[0], ruleColor[1], ruleColor[2]);
    doc.setLineWidth(theme.headingStyle === "accentRule" ? 0.9 : 0.6);
    doc.line(page.marginX, y + 4, page.width - page.marginX, y + 4);
    doc.setDrawColor(...TEXT_COLOR);
  }

  doc.setTextColor(...TEXT_COLOR);
  return y + spacing.sectionBodyGap;
}

function rightText(ctx, text, y) {
  const { doc, theme } = ctx;
  const normalized = safeText(text);
  if (!normalized) return;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont(theme.font, "normal");
  doc.setFontSize(9.3);
  doc.text(normalized, page.width - page.marginX, y, { align: "right" });
}

export async function generateClientResumePdf(resume, options = {}) {
  const template = getTemplate(options.templateId);
  const baseTheme = template.theme;
  const density = baseTheme.density || 1;
  const spacing = {
    sectionTopGap: BASE.sectionTopGap * density,
    sectionBodyGap: BASE.sectionBodyGap * density,
    nameToContactGap: BASE.nameToContactGap * density,
    headerToFirstSectionGap: BASE.headerToFirstSectionGap * density,
  };

  const doc = new jsPDF({ unit: "pt", format: "letter", putOnlyUsedFonts: true, compress: true });
  // Register the Unicode font family and use its registered name everywhere.
  const fontName = await registerFontFamily(doc, baseTheme.font === "serif" ? "serif" : "sans");
  doc.setFont(fontName, "normal");
  const theme = { ...baseTheme, font: fontName };
  const ctx = { doc, theme, spacing };
  const maxWidth = page.width - page.marginX * 2;
  // Per-section trailing gap scales with density too.
  const blockGap = 3 * density;
  let y = page.marginY;

  doc.setTextColor(...(theme.nameColor || TEXT_COLOR));
  doc.setFont(theme.font, "bold");
  doc.setFontSize(21);
  const name = safeText(resume.header.full_name) || "Resume";
  if (theme.headerAlign === "left") {
    doc.text(name, page.marginX, y);
  } else {
    doc.text(name, page.width / 2, y, { align: "center" });
  }
  doc.setTextColor(...TEXT_COLOR);
  y += spacing.nameToContactGap;

  doc.setFont(theme.font, "normal");
  doc.setFontSize(9.2);
  y = drawContactLine(ctx, contactItems(resume.header), y, maxWidth) + spacing.headerToFirstSectionGap;

  const order = resume.section_order || [
    "professional_summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "achievements",
  ];

  let renderedSections = 0;

  order.forEach((section) => {
    if (section === "professional_summary" && safeText(resume.professional_summary)) {
      y = sectionHeading(ctx, "Professional Summary", y, { first: renderedSections === 0 });
      y = writeWrapped(ctx, resume.professional_summary, page.marginX, y, maxWidth, { fontSize: 9.75, lineHeight: 11.7 });
      y += blockGap;
      renderedSections += 1;
    }

    if (section === "skills" && resume.skills?.length) {
      y = sectionHeading(ctx, "Skills", y, { first: renderedSections === 0 });
      resume.skills.forEach((skill) => {
        const items = (skill.items || []).map(safeText).filter(Boolean).join(", ");
        y = writeLabeledWrapped(ctx, skill.category, items, page.marginX, y, maxWidth, {
          fontSize: 9.45,
          lineHeight: 11.1,
        });
      });
      y += blockGap;
      renderedSections += 1;
    }

    if (section === "experience" && resume.experience?.length) {
      y = sectionHeading(ctx, "Experience", y, { first: renderedSections === 0 });
      resume.experience.forEach((experience) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont(theme.font, "bold");
        doc.setFontSize(10.2);
        doc.text(joinPresent([experience.title, experience.company], ", "), page.marginX, y);
        rightText(ctx, dateRange(experience.start_date, experience.end_date), y);
        y += 11;

        if (experience.location) {
          doc.setFont(theme.font, "normal");
          doc.setFontSize(9.25);
          doc.text(safeText(experience.location), page.marginX, y);
          y += 9.8;
        }

        (experience.bullets || []).filter(safeText).forEach((bullet) => {
          y = writeWrapped(ctx, bullet, page.marginX + 4, y, maxWidth - 4, {
            fontSize: 9.4,
            lineHeight: 11.35,
            bullet: true,
          });
        });
        y += blockGap;
      });
      renderedSections += 1;
    }

    if (section === "projects" && resume.projects?.length) {
      y = sectionHeading(ctx, "Projects", y, { first: renderedSections === 0 });
      resume.projects.forEach((project) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont(theme.font, "bold");
        doc.setFontSize(10.2);
        doc.text(joinPresent([project.name, project.role], ", "), page.marginX, y);
        rightText(ctx, dateRange(project.start_date, project.end_date), y);
        y += 11;

        if (project.technologies?.length) {
          y = writeWrapped(ctx, project.technologies.map(safeText).filter(Boolean).join(", "), page.marginX, y, maxWidth, {
            fontSize: 9.15,
            lineHeight: 10.4,
          });
        }

        (project.bullets || []).filter(safeText).forEach((bullet) => {
          y = writeWrapped(ctx, bullet, page.marginX + 4, y, maxWidth - 4, {
            fontSize: 9.4,
            lineHeight: 11.35,
            bullet: true,
          });
        });
        y += blockGap;
      });
      renderedSections += 1;
    }

    if (section === "education" && resume.education?.length) {
      y = sectionHeading(ctx, "Education", y, { first: renderedSections === 0 });
      resume.education.forEach((education) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont(theme.font, "bold");
        doc.setFontSize(10.2);
        doc.text(safeText(education.institution), page.marginX, y);
        rightText(ctx, dateRange(education.start_date, education.end_date), y);
        y += 11;

        doc.setFont(theme.font, "normal");
        doc.setFontSize(9.6);
        doc.text(joinPresent([education.degree, education.score]), page.marginX, y);
        y += 10.8;

        if (education.coursework?.length) {
          y = writeWrapped(
            ctx,
            `Relevant Coursework: ${education.coursework.map(safeText).filter(Boolean).join(", ")}`,
            page.marginX,
            y,
            maxWidth,
            { fontSize: 9.2, lineHeight: 10.8 },
          );
        }
        y += 2 * density;
      });
      renderedSections += 1;
    }

    if (section === "certifications" && resume.certifications?.length) {
      y = sectionHeading(ctx, "Certifications", y, { first: renderedSections === 0 });
      resume.certifications.forEach((certification) => {
        const text = joinPresent(
          [
            certification.title,
            certification.issuer,
            certification.date ? `(${certification.date})` : "",
            certification.link,
          ],
          ", ",
        );
        y = writeWrapped(ctx, text, page.marginX + 4, y, maxWidth - 4, {
          fontSize: 9.35,
          lineHeight: 11.25,
          bullet: true,
        });
      });
      y += blockGap;
      renderedSections += 1;
    }

    if (section === "achievements" && resume.achievements?.length) {
      y = sectionHeading(ctx, "Achievements", y, { first: renderedSections === 0 });
      resume.achievements.forEach((achievement) => {
        const text = joinPresent(
          [
            achievement.title,
            achievement.date ? `(${achievement.date})` : "",
            achievement.description,
          ],
          ": ",
        );
        y = writeWrapped(ctx, text, page.marginX + 4, y, maxWidth - 4, {
          fontSize: 9.35,
          lineHeight: 11.25,
          bullet: true,
        });
      });
      y += blockGap;
      renderedSections += 1;
    }
  });

  return {
    blob: doc.output("blob"),
    filename: filenameFromName(resume.header.full_name),
  };
}
