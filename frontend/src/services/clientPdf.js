import { jsPDF } from "jspdf";

const page = {
  width: 612,
  height: 792,
  marginX: 32,
  marginY: 26,
  bottom: 774,
};

const TEXT_COLOR = [24, 33, 47];
const LINK_BLUE = [29, 78, 216];
const SECTION_TOP_GAP = 6.2;
const FIRST_SECTION_TOP_GAP = 0;
const SECTION_BODY_GAP = 17;
const HEADER_NAME_TO_CONTACT_GAP = 20;
const HEADER_TO_FIRST_SECTION_GAP = 11.5;

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

function drawContactLine(doc, items, y, maxWidth) {
  if (!items.length) return y;

  const separator = " | ";
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
    let x = page.width / 2 - rowWidth / 2;

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

function writeWrapped(doc, text, x, y, maxWidth, options = {}) {
  const {
    fontSize = 9.5,
    lineHeight = 12,
    font = "helvetica",
    style = "normal",
    bullet = false,
  } = options;

  const normalized = safeText(text);
  if (!normalized) return y;

  doc.setFont(font, style);
  doc.setFontSize(fontSize);

  const textX = bullet ? x + 10 : x;
  const lines = doc.splitTextToSize(normalized, maxWidth - (bullet ? 10 : 0));
  let nextY = y;

  lines.forEach((line, index) => {
    nextY = addPageIfNeeded(doc, nextY, lineHeight);
    if (bullet && index === 0) {
      doc.text("-", x, nextY);
    }
    doc.text(line, textX, nextY);
    nextY += lineHeight;
  });

  return nextY;
}

function writeLabeledWrapped(doc, label, text, x, y, maxWidth, options = {}) {
  const {
    fontSize = 9.4,
    lineHeight = 11.5,
    labelStyle = "bold",
    valueStyle = "normal",
    font = "helvetica",
  } = options;
  const normalizedLabel = safeText(label);
  const normalizedText = safeText(text);

  if (!normalizedLabel && !normalizedText) return y;
  if (!normalizedLabel) {
    return writeWrapped(doc, normalizedText, x, y, maxWidth, { fontSize, lineHeight, font, style: valueStyle });
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

function sectionHeading(doc, title, y, { first = false } = {}) {
  const topGap = first ? FIRST_SECTION_TOP_GAP : SECTION_TOP_GAP;
  y = addPageIfNeeded(doc, y + topGap, 22);
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.9);
  doc.text(title.toUpperCase(), page.marginX, y);
  doc.setLineWidth(0.6);
  doc.line(page.marginX, y + 4, page.width - page.marginX, y + 4);
  return y + SECTION_BODY_GAP;
}

function rightText(doc, text, y) {
  const normalized = safeText(text);
  if (!normalized) return;
  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.3);
  doc.text(normalized, page.width - page.marginX, y, { align: "right" });
}

export function generateClientResumePdf(resume) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const maxWidth = page.width - page.marginX * 2;
  let y = page.marginY;

  doc.setTextColor(...TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(safeText(resume.header.full_name) || "Resume", page.width / 2, y, { align: "center" });
  y += HEADER_NAME_TO_CONTACT_GAP;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  y = drawContactLine(doc, contactItems(resume.header), y, maxWidth) + HEADER_TO_FIRST_SECTION_GAP;

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
      y = sectionHeading(doc, "Professional Summary", y, { first: renderedSections === 0 });
      y = writeWrapped(doc, resume.professional_summary, page.marginX, y, maxWidth, { fontSize: 9.75, lineHeight: 11.7 });
      y += 3;
      renderedSections += 1;
    }

    if (section === "skills" && resume.skills?.length) {
      y = sectionHeading(doc, "Skills", y, { first: renderedSections === 0 });
      resume.skills.forEach((skill) => {
        const items = (skill.items || []).map(safeText).filter(Boolean).join(", ");
        y = writeLabeledWrapped(doc, skill.category, items, page.marginX, y, maxWidth, {
          fontSize: 9.45,
          lineHeight: 11.1,
        });
      });
      y += 3;
      renderedSections += 1;
    }

    if (section === "experience" && resume.experience?.length) {
      y = sectionHeading(doc, "Experience", y, { first: renderedSections === 0 });
      resume.experience.forEach((experience) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.2);
        doc.text(joinPresent([experience.title, experience.company], ", "), page.marginX, y);
        rightText(doc, dateRange(experience.start_date, experience.end_date), y);
        y += 11;

        if (experience.location) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.25);
          doc.text(safeText(experience.location), page.marginX, y);
          y += 9.8;
        }

        (experience.bullets || []).filter(safeText).forEach((bullet) => {
          y = writeWrapped(doc, bullet, page.marginX + 4, y, maxWidth - 4, {
            fontSize: 9.4,
            lineHeight: 11.35,
            bullet: true,
          });
        });
        y += 3;
      });
      renderedSections += 1;
    }

    if (section === "projects" && resume.projects?.length) {
      y = sectionHeading(doc, "Projects", y, { first: renderedSections === 0 });
      resume.projects.forEach((project) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.2);
        doc.text(joinPresent([project.name, project.role], ", "), page.marginX, y);
        rightText(doc, dateRange(project.start_date, project.end_date), y);
        y += 11;

        if (project.technologies?.length) {
          y = writeWrapped(doc, project.technologies.map(safeText).filter(Boolean).join(", "), page.marginX, y, maxWidth, {
            fontSize: 9.15,
            lineHeight: 10.4,
            style: "italic",
          });
        }

        (project.bullets || []).filter(safeText).forEach((bullet) => {
          y = writeWrapped(doc, bullet, page.marginX + 4, y, maxWidth - 4, {
            fontSize: 9.4,
            lineHeight: 11.35,
            bullet: true,
          });
        });
        y += 3;
      });
      renderedSections += 1;
    }

    if (section === "education" && resume.education?.length) {
      y = sectionHeading(doc, "Education", y, { first: renderedSections === 0 });
      resume.education.forEach((education) => {
        y = addPageIfNeeded(doc, y, 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.2);
        doc.text(safeText(education.institution), page.marginX, y);
        rightText(doc, dateRange(education.start_date, education.end_date), y);
        y += 11;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.6);
        doc.text(joinPresent([education.degree, education.score]), page.marginX, y);
        y += 10.8;

        if (education.coursework?.length) {
          y = writeWrapped(
            doc,
            `Relevant Coursework: ${education.coursework.map(safeText).filter(Boolean).join(", ")}`,
            page.marginX,
            y,
            maxWidth,
            { fontSize: 9.2, lineHeight: 10.8 },
          );
        }
        y += 2;
      });
      renderedSections += 1;
    }

    if (section === "certifications" && resume.certifications?.length) {
      y = sectionHeading(doc, "Certifications", y, { first: renderedSections === 0 });
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
        y = writeWrapped(doc, text, page.marginX + 4, y, maxWidth - 4, {
          fontSize: 9.35,
          lineHeight: 11.25,
          bullet: true,
        });
      });
      y += 3;
      renderedSections += 1;
    }

    if (section === "achievements" && resume.achievements?.length) {
      y = sectionHeading(doc, "Achievements", y, { first: renderedSections === 0 });
      resume.achievements.forEach((achievement) => {
        const text = joinPresent(
          [
            achievement.title,
            achievement.date ? `(${achievement.date})` : "",
            achievement.description,
          ],
          ": ",
        );
        y = writeWrapped(doc, text, page.marginX + 4, y, maxWidth - 4, {
          fontSize: 9.35,
          lineHeight: 11.25,
          bullet: true,
        });
      });
      y += 3;
      renderedSections += 1;
    }
  });

  return {
    blob: doc.output("blob"),
    filename: filenameFromName(resume.header.full_name),
  };
}
