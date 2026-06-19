import { Plus, Sparkles } from "lucide-react";
import { getAllSkillNames } from "../services/resumeTransforms.js";

// Paste-and-go tailoring: after a JD is analyzed, scan the FULL master profile
// for items (projects, experience, skills) that match the JD's keywords but are
// NOT yet included in this version, and offer to add them in one click. This
// turns "what should I put in this resume for this job?" into a guided action.

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesKeyword(text, keyword) {
  const haystack = ` ${String(text || "").toLowerCase()} `;
  const needle = String(keyword || "").toLowerCase().trim();
  if (!needle) return false;
  // '+', '#', '.' are not word characters; match as substring (C++, C#, Node.js).
  if (/[+#.]/.test(needle)) return haystack.includes(needle);
  return new RegExp(`[^a-z0-9+#]${escapeRegExp(needle)}[^a-z0-9+#]`).test(haystack);
}

function matchKeywords(text, jdKeywords, missingSet) {
  const matched = jdKeywords.filter((keyword) => includesKeyword(text, keyword));
  const matchedMissing = matched.filter((keyword) => missingSet.has(keyword));
  return { matched, matchedMissing };
}

function buildCandidates(profile, version, analysis) {
  const jdKeywords = analysis?.jd_keywords || [];
  const missingSet = new Set(analysis?.missing_keywords || []);
  if (!jdKeywords.length) return [];

  const selectedProjectIds = new Set(version?.selectedProjectIds || []);
  const selectedExperienceIds = new Set(version?.selectedExperienceIds || []);
  const selectedSkillNames = new Set(version?.selectedSkillNames || []);
  const candidates = [];

  (profile.projects || [])
    .filter((project) => !selectedProjectIds.has(project.id))
    .forEach((project) => {
      const text = [project.name, project.role, ...(project.technologies || []), ...(project.bullets || [])].join(" ");
      const { matched, matchedMissing } = matchKeywords(text, jdKeywords, missingSet);
      if (matched.length) {
        candidates.push({ kind: "project", id: project.id, label: project.name, matched, matchedMissing });
      }
    });

  (profile.experience || [])
    .filter((item) => !selectedExperienceIds.has(item.id))
    .forEach((item) => {
      const text = [item.title, item.company, ...(item.bullets || [])].join(" ");
      const { matched, matchedMissing } = matchKeywords(text, jdKeywords, missingSet);
      if (matched.length) {
        candidates.push({
          kind: "experience",
          id: item.id,
          label: [item.title, item.company].filter(Boolean).join(" — "),
          matched,
          matchedMissing,
        });
      }
    });

  getAllSkillNames(profile)
    .filter((name) => !selectedSkillNames.has(name))
    .forEach((name) => {
      const { matched, matchedMissing } = matchKeywords(name, jdKeywords, missingSet);
      if (matched.length) {
        candidates.push({ kind: "skill", id: name, label: name, matched, matchedMissing });
      }
    });

  // Prioritize items that fill currently-missing JD keywords.
  return candidates.sort(
    (a, b) => b.matchedMissing.length - a.matchedMissing.length || b.matched.length - a.matched.length,
  );
}

export default function JobMatchSuggestions({ profile, version, analysis, disabled = false, onAdd }) {
  if (!analysis?.jd_keywords?.length) return null;

  const candidates = buildCandidates(profile, version, analysis);

  return (
    <section className="section-panel">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-sky-700" />
        <h2 className="text-base font-bold text-slate-950">Tailor to this JD</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Items from your profile that match this job but aren&apos;t in this version yet. Add the relevant ones, then
        re-run Analyze JD to refresh the scores.
      </p>

      {!candidates.length ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          This version already includes every profile item that matches the JD keywords. Nothing else to add.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {candidates.map((candidate) => (
            <li
              key={`${candidate.kind}-${candidate.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge border-slate-200 bg-white text-slate-500 capitalize">{candidate.kind}</span>
                  <span className="truncate text-sm font-semibold text-slate-900">{candidate.label}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidate.matched.map((keyword) => {
                    const fillsGap = candidate.matchedMissing.includes(keyword);
                    return (
                      <span
                        key={keyword}
                        className={`badge ${
                          fillsGap
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                        title={fillsGap ? "Fills a missing JD keyword" : "Already matched, reinforces it"}
                      >
                        {keyword}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={disabled}
                onClick={() => onAdd(candidate.kind, candidate.id)}
              >
                <Plus size={16} />
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
