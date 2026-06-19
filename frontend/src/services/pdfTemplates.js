// Template definitions for the in-browser (jsPDF) resume renderer.
//
// jsPDF only ships three core font families (helvetica, times, courier),
// so visual variety comes from font choice, accent color, header alignment,
// section-heading style, and spacing density. Each template is a theme the
// renderer in clientPdf.js consumes.

export const PDF_TEMPLATES = [
  {
    id: "classic",
    name: "Classic",
    description: "Centered header, clean black section rules. Safe ATS default.",
    theme: {
      font: "helvetica",
      headerAlign: "center",
      headingStyle: "rule", // underline rule beneath the heading
      accent: [24, 33, 47], // near-black
      nameColor: [24, 33, 47],
      density: 1.0,
    },
  },
  {
    id: "modern",
    name: "Modern Blue",
    description: "Left-aligned header with a blue accent on your name and rules.",
    theme: {
      font: "helvetica",
      headerAlign: "left",
      headingStyle: "accentRule",
      accent: [29, 78, 216], // blue
      nameColor: [29, 78, 216],
      density: 1.0,
    },
  },
  {
    id: "compact",
    name: "Compact",
    description: "Tighter spacing to fit more content on a single page.",
    theme: {
      font: "helvetica",
      headerAlign: "center",
      headingStyle: "rule",
      accent: [24, 33, 47],
      nameColor: [24, 33, 47],
      density: 0.86,
    },
  },
  {
    id: "elegant",
    name: "Elegant Serif",
    description: "Times serif body with a teal accent. A more traditional look.",
    theme: {
      font: "times",
      headerAlign: "center",
      headingStyle: "accentRule",
      accent: [15, 118, 110], // teal
      nameColor: [17, 24, 39],
      density: 1.0,
    },
  },
];

export const DEFAULT_TEMPLATE_ID = "classic";

export function getTemplate(templateId) {
  return PDF_TEMPLATES.find((template) => template.id === templateId) || PDF_TEMPLATES[0];
}
