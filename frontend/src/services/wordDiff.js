// Lightweight word-level diff (LCS-based) used to highlight what a bullet
// rewrite actually changed. Returns two token streams: one for the "before"
// text (marking removed words) and one for the "after" text (marking added
// words). Unchanged words are shared between both.

function tokenize(text) {
  // Keep words and the whitespace/punctuation between them as separate tokens
  // so re-joining reproduces the original string faithfully.
  return String(text || "").match(/\s+|[^\s]+/g) || [];
}

function lcsTable(a, b) {
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

export function diffWords(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);
  const table = lcsTable(a, b);

  const beforeTokens = [];
  const afterTokens = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      beforeTokens.push({ type: "same", text: a[i] });
      afterTokens.push({ type: "same", text: b[j] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      beforeTokens.push({ type: "removed", text: a[i] });
      i += 1;
    } else {
      afterTokens.push({ type: "added", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    beforeTokens.push({ type: "removed", text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    afterTokens.push({ type: "added", text: b[j] });
    j += 1;
  }

  return { beforeTokens, afterTokens };
}
