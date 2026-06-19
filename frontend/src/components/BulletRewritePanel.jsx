import { Check, Wand2 } from "lucide-react";
import { diffWords } from "../services/wordDiff.js";

export default function BulletRewritePanel({ disabled = false, rewriteResponse, onApplyRewrite }) {
  const rewrites = rewriteResponse?.rewrites || [];

  return (
    <section className="section-panel">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-950">Bullet Rewrites</h2>
        <span className="badge">
          <Wand2 size={14} />
          {rewriteResponse?.provider || "rule_based"}
        </span>
      </div>

      {!rewrites.length ? (
        <p className="mt-3 text-sm text-slate-500">No rewrite results yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rewrites.map((rewrite) => {
            const { beforeTokens, afterTokens } = diffWords(rewrite.original, rewrite.rewritten);

            return (
              <div
                key={`${rewrite.section}-${rewrite.item_index}-${rewrite.bullet_index}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{rewrite.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {rewrite.changed ? (
                      <span className="badge border-emerald-200 bg-emerald-50 text-emerald-800">Changed</span>
                    ) : (
                      <span className="badge">No change</span>
                    )}
                    {rewrite.weak_terms?.map((term) => (
                      <span key={term} className="badge border-amber-200 bg-amber-50 text-amber-800">
                        Weak: {term}
                      </span>
                    ))}
                    {rewrite.metric_suggestion ? (
                      <span className="badge border-sky-200 bg-sky-50 text-sky-800">Metric prompt</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <DiffBlock label="Before" tokens={beforeTokens} variant="removed" />
                  <DiffBlock label="After" tokens={afterTokens} variant="added" />
                </div>

                {rewrite.metric_suggestion ? (
                  <p className="mt-2 text-xs font-medium text-sky-800">{rewrite.metric_suggestion}</p>
                ) : null}

                <button
                  type="button"
                  className="btn-primary mt-3"
                  onClick={() => onApplyRewrite(rewrite)}
                  disabled={disabled || !rewrite.changed}
                >
                  <Check size={16} />
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DiffBlock({ label, tokens, variant }) {
  const highlightClass =
    variant === "added"
      ? "rounded bg-emerald-100 text-emerald-900"
      : "rounded bg-red-100 text-red-900 line-through";

  return (
    <div>
      <p className="field-label">{label}</p>
      <p className="mt-1 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
        {tokens.map((token, index) =>
          token.type === "same" ? (
            <span key={index}>{token.text}</span>
          ) : (
            <span key={index} className={highlightClass}>
              {token.text}
            </span>
          ),
        )}
      </p>
    </div>
  );
}
