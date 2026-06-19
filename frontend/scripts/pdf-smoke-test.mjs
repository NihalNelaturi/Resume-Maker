// PDF smoke test — exercises the REAL clientPdf.js code path in Node and asserts
// every template renders a non-trivial PDF with the Unicode font embedded.
//
// This guards against the two classes of bug that previously reached production:
//   1. an empty/broken render path producing a tiny or invalid PDF, and
//   2. non-Latin (Greek/Cyrillic) text silently failing to embed a font.
//
// Run: node scripts/pdf-smoke-test.mjs   (also runs in CI after the build)

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, "..", "public", "fonts");

// clientPdf.js fetches fonts from "/fonts/<file>.ttf". In Node there is no HTTP
// server, so shim fetch to serve those files straight from public/fonts.
globalThis.fetch = async (url) => {
  const file = join(fontsDir, basename(String(url)));
  const buffer = await readFile(file);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
};

const { generateClientResumePdf } = await import("../src/services/clientPdf.js");
const { PDF_TEMPLATES } = await import("../src/services/pdfTemplates.js");

// Fixture mixes Latin and Greek to prove non-Latin scripts render.
const resume = {
  header: {
    full_name: "Ειρήνη Χρυσοβαλάντη / Resume Tester",
    email: "tester@example.com",
    phone: "+30 690 701 4875",
    location: "Πάτρα",
    github: "github.com/example",
  },
  professional_summary: "Απόφοιτη ΣΑΕΚ with full-stack experience building Python APIs and React apps.",
  skills: [{ category: "Languages", items: ["Python", "JavaScript", "SQL"] }],
  experience: [
    {
      title: "Software Engineer",
      company: "Example Co",
      start_date: "2023",
      end_date: "Present",
      bullets: ["Developed REST API endpoints and improved latency by 20%."],
    },
  ],
  projects: [
    {
      name: "Resume Maker",
      technologies: ["FastAPI", "React"],
      bullets: ["Built an ATS-friendly resume generator with in-browser PDF export."],
    },
  ],
  education: [{ institution: "2ο ΕΠΑΛ", degree: "Απόφοιτη Επαγγελματικού Λυκείου", end_date: "2022" }],
  certifications: [{ title: "English B2 – ECCE", issuer: "Michigan", date: "2020" }],
  achievements: [],
};

const MIN_BYTES = 3000;
let failures = 0;

for (const template of PDF_TEMPLATES) {
  try {
    const { blob, filename } = await generateClientResumePdf(resume, { templateId: template.id });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = String.fromCharCode(...bytes.subarray(0, 5));
    const text = Buffer.from(bytes).toString("latin1");
    const expectedFont = template.theme.font === "serif" ? "DejaVuSerif" : "DejaVuSans";

    const problems = [];
    if (header !== "%PDF-") problems.push(`bad header "${header}"`);
    if (bytes.length < MIN_BYTES) problems.push(`too small (${bytes.length} bytes)`);
    if (!text.includes(expectedFont)) problems.push(`embedded font ${expectedFont} missing`);
    if (!filename.endsWith(".pdf")) problems.push(`bad filename "${filename}"`);

    if (problems.length) {
      failures += 1;
      console.error(`FAIL  ${template.id}: ${problems.join(", ")}`);
    } else {
      console.log(`PASS  ${template.id}: ${bytes.length} bytes, ${expectedFont} embedded`);
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${template.id}: threw ${error?.message || error}`);
  }
}

if (failures) {
  console.error(`\nPDF smoke test failed (${failures} template(s)).`);
  process.exit(1);
}
console.log("\nPDF smoke test passed for all templates.");
