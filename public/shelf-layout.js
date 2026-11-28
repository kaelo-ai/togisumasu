/* ===== shelf layout: where each book stands on a level's bookcase =====
   Pure function, shared by the Courses page and the tests. No DOM.

   Books go left to right along a plank, a wider gap between runs of one subject,
   and onto a new plank when the next book would cross the right edge. Each run gets
   a label centred under the part of it on its first plank, nudged right so labels on
   one plank never touch. Positions are absolute, so a filter or a resize can slide
   every book to its new place instead of re-flowing the page. */
'use strict';
(function (root) {
const DEF = { pad: 22, gap: 4, groupGap: 30, area: 252, plank: 18, below: 44, labelGap: 14, minWidth: 220 };

// A label's drawn width: text at ~6.9px per character plus the count and padding.
const labelWidth = (text, count) => Math.round(String(text).length * 6.9 + String(count).length * 7 + 28);

function layout(books, width, opts) {
  const o = { ...DEF, ...(opts || {}) };
  const inner = Math.max(o.minWidth, width || 0), right = inner - o.pad;
  const pitch = o.area + o.plank + o.below;
  const pos = {}, labels = [], ends = [];
  const runs = [];
  for (const b of books) {
    const last = runs[runs.length - 1];
    if (last && last.group === b.group) last.books.push(b); else runs.push({ group: b.group, label: b.label || b.group, books: [b] });
  }
  let row = 0, edge = o.pad, used = false, labelEdge = -Infinity;
  const wrap = () => { ends[row] = edge; row++; edge = o.pad; used = false; labelEdge = -Infinity; };
  for (const run of runs) {
    const lw = labelWidth(run.label, run.books.length);
    const runW = run.books.reduce((n, b) => n + b.w, 0) + o.gap * (run.books.length - 1);
    let x = o.pad;
    if (used) {
      // stand far enough along that this run's label, centred under it, clears the last one
      x = edge + o.groupGap;
      x = Math.max(x, labelEdge + o.labelGap + lw / 2 - Math.min(runW, right - x) / 2);
      if (x + run.books[0].w > right || labelEdge + o.labelGap + lw > inner - 2) { wrap(); x = o.pad; }
    }
    const segRow = row, segStart = x; let segEnd = -1;
    for (const b of run.books) {
      if (used && x + b.w > right) { if (segEnd < 0) segEnd = edge; wrap(); x = o.pad; }
      pos[b.id] = { x, y: row * pitch + o.area - b.h, row };
      edge = x + b.w; x = edge + o.gap; used = true;
    }
    if (segEnd < 0) segEnd = edge;
    const before = labels.length && labels[labels.length - 1].row === segRow ? labels[labels.length - 1] : null;
    let lx = (segStart + segEnd) / 2 - lw / 2;
    if (before) lx = Math.max(lx, before.x + before.w + o.labelGap);
    lx = Math.max(2, Math.min(inner - lw - 2, lx));
    labels.push({ group: run.group, label: run.label, count: run.books.length, x: Math.round(lx), w: lw, row: segRow, y: segRow * pitch + o.area + o.plank + 8 });
    if (row === segRow) labelEdge = lx + lw;
  }
  ends[row] = edge;
  const rows = books.length ? row + 1 : 0;
  return { pos, labels, rows, ends, pitch, width: inner, height: rows ? rows * pitch - o.below + 34 : 0,
    planks: Array.from({ length: rows }, (_, r) => r * pitch + o.area), free: rows ? right - ends[rows - 1] : 0 };
}

const ShelfLayout = { layout, labelWidth, DEF };
if (typeof module !== 'undefined' && module.exports) module.exports = ShelfLayout;
root.ShelfLayout = ShelfLayout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
