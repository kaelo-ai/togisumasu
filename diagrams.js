// Draw NSC figures from their specs. The PNG crops are reference only and are
// never embedded. given:false values stay off the labels; the curve or point
// is still drawn so the picture matches the paper.
'use strict';
const core = require('./public/core.js');
const euclid = require('./euclid.js');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function specOf(figure) {
  if (figure.spec && typeof figure.spec === 'object') return figure.spec;
  try { return JSON.parse(figure.spec_json || '{}'); }
  catch (err) { return {}; }
}

function evalPlain(expr, x) {
  try { return core.ev(core.parse(String(expr)), { x }); }
  catch (err) { return NaN; }
}

function padRange(lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [lo, hi];
  if (hi < lo) [lo, hi] = [hi, lo];
  const span = hi - lo || 1;
  const extra = Math.max(0.08 * span, 0.4);
  return [lo - extra, hi + extra];
}

function xyOf(value) {
  if (Array.isArray(value) && value.length >= 2) return [Number(value[0]), Number(value[1])];
  if (value && Array.isArray(value.xy) && value.xy.length >= 2) return [Number(value.xy[0]), Number(value.xy[1])];
  return null;
}

// Start from the declared window (or the usual ±6) and expand so every plotted
// point, circle, and segment end stays inside the frame, with room for labels.
function fittedView(spec) {
  const declared = spec.view || {};
  const dx = Array.isArray(declared.x) && declared.x.length === 2 && declared.x.every(v => typeof v === 'number') ? declared.x : null;
  const dy = Array.isArray(declared.y) && declared.y.length === 2 && declared.y.every(v => typeof v === 'number') ? declared.y : null;
  let x0 = dx ? dx[0] : -6, x1 = dx ? dx[1] : 6;
  let y0 = dy ? dy[0] : -6, y1 = dy ? dy[1] : 6;
  const include = (x, y) => {
    if (Number.isFinite(x)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (Number.isFinite(y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  };
  for (const point of spec.points || []) {
    const xy = xyOf(point);
    if (xy) include(xy[0], xy[1]);
  }
  for (const seg of spec.segments || spec.lines || []) {
    for (const end of [seg.from, seg.to]) {
      const xy = xyOf(end);
      if (xy) include(xy[0], xy[1]);
    }
  }
  for (const circle of spec.circles || []) {
    const xy = xyOf(circle.centre || circle.center);
    const r = Number(circle.radius);
    if (xy && Number.isFinite(r)) {
      include(xy[0] - r, xy[1] - r);
      include(xy[0] + r, xy[1] + r);
    }
  }
  return { x: padRange(x0, x1), y: padRange(y0, y1) };
}

function frame(spec) {
  const { x, y } = fittedView(spec);
  const left = 36, top = 16, width = 250, height = 190;
  const map = (mx, my) => ({
    x: left + (mx - x[0]) / (x[1] - x[0] || 1) * width,
    y: top + (y[1] - my) / (y[1] - y[0] || 1) * height,
  });
  return { x, y, left, top, width, height, map };
}

function textWidth(text, fontSize) {
  const clean = String(text || '').replace(/<[^>]+>/g, '');
  return Math.max(fontSize * 0.5, clean.length * fontSize * 0.62);
}

function textBox(x, y, text, fontSize, anchor, baseline) {
  const w = textWidth(text, fontSize);
  const h = fontSize * 1.2;
  let x1 = x, x2 = x + w;
  if (anchor === 'middle') { x1 = x - w / 2; x2 = x + w / 2; }
  else if (anchor === 'end') { x1 = x - w; x2 = x; }
  let y1, y2;
  if (baseline === 'middle') { y1 = y - h / 2; y2 = y + h / 2; }
  else if (baseline === 'hanging') { y1 = y; y2 = y + h; }
  else { y1 = y - fontSize * 0.85; y2 = y + fontSize * 0.25; }
  return { x1, y1, x2, y2 };
}

function boxesOverlap(a, b, pad) {
  const p = pad == null ? 2 : pad;
  return !(a.x2 + p < b.x1 || b.x2 + p < a.x1 || a.y2 + p < b.y1 || b.y2 + p < a.y1);
}

function lineHitsBox(x1, y1, x2, y2, box, pad) {
  const p = pad == null ? 1 : pad;
  const minX = Math.min(x1, x2) - p, maxX = Math.max(x1, x2) + p;
  const minY = Math.min(y1, y2) - p, maxY = Math.max(y1, y2) + p;
  if (maxX < box.x1 || box.x2 < minX || maxY < box.y1 || box.y2 < minY) return false;
  const cx = (box.x1 + box.x2) / 2, cy = (box.y1 + box.y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / len2));
  const px = x1 + t * dx, py = y1 + t * dy;
  return px >= box.x1 - p && px <= box.x2 + p && py >= box.y1 - p && py <= box.y2 + p;
}

const LABEL_CANDIDATES = [
  { dx: 6, dy: -8, anchor: 'start', baseline: 'alphabetic' },
  { dx: -6, dy: -8, anchor: 'end', baseline: 'alphabetic' },
  { dx: 6, dy: 14, anchor: 'start', baseline: 'alphabetic' },
  { dx: -6, dy: 14, anchor: 'end', baseline: 'alphabetic' },
  { dx: 0, dy: -12, anchor: 'middle', baseline: 'alphabetic' },
  { dx: 0, dy: 16, anchor: 'middle', baseline: 'alphabetic' },
  { dx: 12, dy: 3, anchor: 'start', baseline: 'middle' },
  { dx: -12, dy: 3, anchor: 'end', baseline: 'middle' },
  { dx: 8, dy: -16, anchor: 'start', baseline: 'alphabetic' },
  { dx: -8, dy: -16, anchor: 'end', baseline: 'alphabetic' },
  { dx: 8, dy: 20, anchor: 'start', baseline: 'alphabetic' },
  { dx: -8, dy: 20, anchor: 'end', baseline: 'alphabetic' },
];

function placeLabels(marks, obstacles) {
  const boxes = (obstacles.boxes || []).slice();
  const lines = obstacles.lines || [];
  const dots = obstacles.dots || [];
  const order = marks.map((_, i) => i).sort((a, b) => String(marks[b].text).length - String(marks[a].text).length);
  const result = new Array(marks.length);
  for (const i of order) {
    const m = marks[i];
    const fs = m.fontSize || 11;
    let best = null, bestCost = Infinity;
    const cands = m.preferred ? [m.preferred, ...LABEL_CANDIDATES.filter(c => c !== m.preferred)] : LABEL_CANDIDATES;
    for (let ci = 0; ci < cands.length; ci++) {
      const c = cands[ci];
      const x = m.x + c.dx, y = m.y + c.dy;
      const box = textBox(x, y, m.text, fs, c.anchor, c.baseline);
      let cost = 0;
      for (const b of boxes) if (boxesOverlap(box, b, 2)) {
        const overlap = (Math.min(box.x2, b.x2) - Math.max(box.x1, b.x1)) * (Math.min(box.y2, b.y2) - Math.max(box.y1, b.y1));
        cost += 40 + Math.max(0, overlap);
      }
      for (const ln of lines) if (lineHitsBox(ln.x1, ln.y1, ln.x2, ln.y2, box, 1)) cost += 12;
      for (const d of dots) {
        if (d.x >= box.x1 - 3 && d.x <= box.x2 + 3 && d.y >= box.y1 - 3 && d.y <= box.y2 + 3) cost += 20;
      }
      cost += ci * 0.4;
      if (cost < bestCost) { bestCost = cost; best = { x, y, box, anchor: c.anchor, baseline: c.baseline, fontSize: fs, text: m.text }; }
    }
    result[i] = best;
    boxes.push(best.box);
  }
  return result;
}

function textEl(p) {
  const anchor = p.anchor && p.anchor !== 'start' ? ` text-anchor="${p.anchor}"` : '';
  const base = p.baseline && p.baseline !== 'alphabetic' ? ` dominant-baseline="${p.baseline}"` : '';
  return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-size="${p.fontSize || 11}"${anchor}${base}>${esc(p.text)}</text>`;
}

function bboxFromSvg(body) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const inc = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  const num = s => Number(s);
  const attr = (src, name) => {
    const v = src.match(new RegExp('\\b' + name + '="([^"]+)"'));
    return v ? v[1] : null;
  };
  for (const m of body.matchAll(/<line\b([^>]*)>/g)) {
    const a = m[1];
    inc(num(attr(a, 'x1')), num(attr(a, 'y1')));
    inc(num(attr(a, 'x2')), num(attr(a, 'y2')));
  }
  for (const m of body.matchAll(/<circle\b([^>]*)>/g)) {
    const a = m[1];
    const cx = num(attr(a, 'cx')), cy = num(attr(a, 'cy')), r = num(attr(a, 'r')) || 0;
    inc(cx - r, cy - r); inc(cx + r, cy + r);
  }
  for (const m of body.matchAll(/<rect\b([^>]*)>/g)) {
    const a = m[1];
    const x = num(attr(a, 'x')), y = num(attr(a, 'y')), w = num(attr(a, 'width')) || 0, h = num(attr(a, 'height')) || 0;
    inc(x, y); inc(x + w, y + h);
  }
  for (const m of body.matchAll(/<path\b([^>]*)>/g)) {
    const d = attr(m[1], 'd') || '';
    for (const pt of d.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)) inc(num(pt[1]), num(pt[2]));
  }
  for (const m of body.matchAll(/<(?:polygon|polyline)\b([^>]*)>/g)) {
    const pts = attr(m[1], 'points') || '';
    for (const pt of pts.matchAll(/(-?[\d.]+)[,\s]+(-?[\d.]+)/g)) inc(num(pt[1]), num(pt[2]));
  }
  for (const m of body.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const a = m[1], text = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    incBox: {
      const box = textBox(num(attr(a, 'x')), num(attr(a, 'y')), text, num(attr(a, 'font-size')) || 11, attr(a, 'text-anchor') || 'start', attr(a, 'dominant-baseline') || 'alphabetic');
      inc(box.x1, box.y1); inc(box.x2, box.y2);
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 320, maxY: 240 };
  return { minX, minY, maxX, maxY };
}

function wrapSvg(caption, body) {
  const box = bboxFromSvg(body);
  const pad = 12;
  const x = box.minX - pad, y = box.minY - pad;
  const w = Math.max(40, box.maxX - box.minX + 2 * pad);
  const h = Math.max(40, box.maxY - box.minY + 2 * pad);
  return `<svg class="fig" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="${esc(caption)}">${body}</svg>`;
}

function axes(fr, spec) {
  const origin = fr.map(0, 0);
  const x0 = fr.map(fr.x[0], 0), x1 = fr.map(fr.x[1], 0);
  const y0 = fr.map(0, fr.y[0]), y1 = fr.map(0, fr.y[1]);
  const labels = spec.axes || {};
  const body = `<line x1="${x0.x}" y1="${origin.y}" x2="${x1.x}" y2="${origin.y}" stroke="currentColor" stroke-width="1"/>
    <line x1="${origin.x}" y1="${y0.y}" x2="${origin.x}" y2="${y1.y}" stroke="currentColor" stroke-width="1"/>`;
  const marks = [
    { x: x1.x, y: origin.y, text: labels.x_label || 'x', fontSize: 11, preferred: { dx: -8, dy: -6, anchor: 'start', baseline: 'alphabetic' } },
    { x: origin.x, y: y1.y, text: labels.y_label || 'y', fontSize: 11, preferred: { dx: 6, dy: 12, anchor: 'start', baseline: 'alphabetic' } },
  ];
  const obstacles = {
    lines: [
      { x1: x0.x, y1: origin.y, x2: x1.x, y2: origin.y },
      { x1: origin.x, y1: y0.y, x2: origin.x, y2: y1.y },
    ],
    boxes: [],
    dots: [{ x: origin.x, y: origin.y }],
  };
  return { body, obstacles, marks };
}

function plotExpr(fr, expr) {
  let d = '', pen = false, prev = null;
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const x = fr.x[0] + (fr.x[1] - fr.x[0]) * i / steps;
    const y = evalPlain(expr, x);
    const span = (fr.y[1] - fr.y[0]) * 4;
    if (!Number.isFinite(y) || Math.abs(y) > Math.max(Math.abs(fr.y[0]), Math.abs(fr.y[1])) + span) { pen = false; prev = null; continue; }
    const p = fr.map(x, y);
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) > 80) pen = false;
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    pen = true;
    prev = p;
  }
  return d ? `<path d="${d.trim()}" fill="none" stroke="currentColor" stroke-width="1.6"/>` : '';
}

function asymptote(fr, equation) {
  const text = String(equation || '').replace(/\s/g, '');
  const x = text.match(/^x=(-?\d+(?:\.\d+)?)$/);
  const y = text.match(/^y=(-?\d+(?:\.\d+)?)$/);
  if (x) {
    const p = fr.map(Number(x[1]), 0);
    return `<line x1="${p.x}" y1="${fr.top}" x2="${p.x}" y2="${fr.top + fr.height}" stroke="currentColor" stroke-dasharray="4 3" stroke-width="1"/>`;
  }
  if (y) {
    const p = fr.map(0, Number(y[1]));
    return `<line x1="${fr.left}" y1="${p.y}" x2="${fr.left + fr.width}" y2="${p.y}" stroke="currentColor" stroke-dasharray="4 3" stroke-width="1"/>`;
  }
  return '';
}

function lookup(points, name) {
  const key = String(name || '');
  return points.find(point => point.label === key)
    || points.find(point => String(point.label || '').split('(')[0].trim() === key)
    || null;
}

function mapEnd(fr, points, end) {
  const xy = xyOf(end);
  if (xy) return fr.map(xy[0], xy[1]);
  const point = lookup(points, end);
  if (point && point.xy) return fr.map(point.xy[0], point.xy[1]);
  return null;
}

function drawSegments(fr, points, segs) {
  const lines = [];
  const body = (segs || []).map(seg => {
    const p = mapEnd(fr, points, seg.from), q = mapEnd(fr, points, seg.to);
    if (!p || !q) return '';
    lines.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    const dash = /dash/i.test(String(seg.style || '')) ? ' stroke-dasharray="4 3"' : '';
    return `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="currentColor" stroke-width="1.4"${dash}/>`;
  }).join('');
  return { body, lines };
}

function plotPointsAndLabels(fr, spec, obstacles, extraMarks) {
  const dots = (spec.points || []).filter(point => point.xy).map(point => {
    const p = fr.map(point.xy[0], point.xy[1]);
    return { x: p.x, y: p.y, label: point.drawn_label === false ? '' : (point.label || '') };
  });
  const marks = (extraMarks || []).concat(dots.filter(d => d.label).map(d => ({ x: d.x, y: d.y, text: d.label, fontSize: 11 })));
  const placed = placeLabels(marks, {
    lines: obstacles.lines || [],
    boxes: obstacles.boxes || [],
    dots: (obstacles.dots || []).concat(dots.map(d => ({ x: d.x, y: d.y }))),
  });
  const dotSvg = dots.map(d => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="2.4" fill="currentColor"/>`).join('');
  return dotSvg + placed.map(textEl).join('');
}

function plotGraph(spec) {
  const fr = frame(spec);
  const ax = axes(fr, spec);
  const curves = (spec.functions || []).map(fn => plotExpr(fr, fn.plain || fn.expr)).join('');
  const dashes = (spec.asymptotes || []).filter(a => a.drawn !== false).map(a => asymptote(fr, a.equation)).join('');
  const segs = drawSegments(fr, spec.points || [], spec.segments);
  ax.obstacles.lines.push(...segs.lines);
  return ax.body + dashes + segs.body + curves + plotPointsAndLabels(fr, spec, ax.obstacles, ax.marks);
}

function plotAnalytic(spec) {
  const fr = frame(spec);
  const ax = axes(fr, spec);
  const points = spec.points || [];
  const segs = drawSegments(fr, points, spec.segments || spec.lines || []);
  ax.obstacles.lines.push(...segs.lines);
  const circles = (spec.circles || []).map(circle => {
    if (!circle.centre && !circle.center) return '';
    const c = circle.centre || circle.center;
    const centre = Array.isArray(c) ? { xy: c } : c;
    if (!centre.xy || circle.radius == null) return '';
    const p = fr.map(centre.xy[0], centre.xy[1]);
    const edge = fr.map(centre.xy[0] + Number(circle.radius), centre.xy[1]);
    const r = Math.abs(edge.x - p.x);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
  }).join('');
  return ax.body + segs.body + circles + plotPointsAndLabels(fr, spec, ax.obstacles, ax.marks);
}

function plotEuclidean(spec, seed, threeD) {
  // Positions come from euclid.js, which solves the stated facts (on a circle, on a side,
  // parallel, perpendicular, tangent, midpoint, equal lengths, ratios, given angles).
  const { model, g } = euclid.layout(spec, seed, threeD ? { threeD: true } : null);
  const drawnSegments = threeD ? model.segmentsDrawn : (spec.segments || []);
  const n = model.labels.length;
  if (!n) return '';
  const drawn = model.circles.filter(c => c.drawn);
  const xs = [], ys = [];
  for (let i = 0; i < n; i++) { xs.push(g.X(i)); ys.push(g.Y(i)); }
  for (const c of drawn) { xs.push(g.cx(c) - g.rad(c), g.cx(c) + g.rad(c)); ys.push(g.cy(c) - g.rad(c), g.cy(c) + g.rad(c)); }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = Math.min((320 - 56) / Math.max(maxX - minX, 1e-6), (240 - 44) / Math.max(maxY - minY, 1e-6));
  const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
  const at = i => ({ x: 160 + (g.X(i) - mx) * k, y: 120 - (g.Y(i) - my) * k });
  const index = new Map(model.labels.map((label, i) => [label, i]));
  const find = label => { const i = index.get(String(label || '').split('(')[0].trim()); return i == null ? null : at(i); };
  const f = v => v.toFixed(1);
  const ringOf = plane => (plane.points || plane.contains || []).map(p => typeof p === 'string' ? p : p.label);
  const shades = threeD ? (spec.planes || []).filter(plane => plane.shaded).map(plane => {
    const ring = ringOf(plane).map(find).filter(Boolean);
    if (ring.length < 3) return '';
    return `<polygon points="${ring.map(p => `${f(p.x)},${f(p.y)}`).join(' ')}" fill="currentColor" fill-opacity="0.12" stroke="none"/>`;
  }).join('') : '';
  const circles = drawn.map(c => `<circle cx="${f(160 + (g.cx(c) - mx) * k)}" cy="${f(120 - (g.cy(c) - my) * k)}" r="${f(g.rad(c) * k)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`).join('');
  const lineObjs = [];
  const segs = drawnSegments.map(seg => {
    const a = find(seg.from), b = find(seg.to);
    if (!a || !b) return '';
    lineObjs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="currentColor" stroke-width="1.5"/>`;
  }).join('');
  const pts = model.labels.map((_, i) => at(i));
  const cxAll = pts.reduce((s, p) => s + p.x, 0) / n, cyAll = pts.reduce((s, p) => s + p.y, 0) / n;
  const dots = pts.map(p => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.2" fill="currentColor"/>`).join('');
  // Labels sit just outside the figure, away from its middle, so they do not land on a line.
  const marks = pts.map((p, i) => {
    const dx = p.x - cxAll, dy = p.y - cyAll, d = Math.hypot(dx, dy) || 1;
    return {
      x: p.x, y: p.y, text: model.labels[i], fontSize: 12,
      preferred: { dx: dx / d * 10, dy: dy / d * 10, anchor: 'middle', baseline: 'middle' },
    };
  });
  const placed = placeLabels(marks, { lines: lineObjs, boxes: [], dots: pts });
  return shades + circles + segs + dots + placed.map(textEl).join('');
}

function plotStats(spec) {
  const view = spec.view || {};
  // A bar chart over named categories (months, say) has text on the x axis, not a numeric range.
  const categories = Array.isArray(view.x) && view.x.some(v => typeof v !== 'number') ? view.x.map(String) : null;
  const fr = frame(categories ? { ...spec, view: { ...view, x: [0, categories.length] } } : spec);
  if (categories) {
    const series = (spec.series || []).filter(s => Array.isArray(s.values));
    const slot = fr.width / categories.length, w = Math.max(2, (slot - 4) / Math.max(series.length, 1));
    const bars = series.map((s, k) => s.values.map((v, i) => {
      const h = Math.max(0, Number(v) || 0) / (fr.y[1] || 1) * fr.height;
      return `<rect x="${(fr.left + i * slot + 2 + k * w).toFixed(1)}" y="${(fr.top + fr.height - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="currentColor"/>`;
    }).join('')).join('');
    const ticks = categories.map((c, i) => `<text x="${(fr.left + (i + 0.5) * slot).toFixed(1)}" y="${fr.top + fr.height + 12}" font-size="8" text-anchor="middle">${esc(c)}</text>`).join('');
    return axes(fr, { axes: { x_label: spec.x_label, y_label: spec.y_label } }).body + bars + ticks
      + textEl({ x: fr.left + fr.width - 8, y: fr.map(0, 0).y - 6, text: spec.x_label || '', fontSize: 11 })
      + textEl({ x: fr.map(0, 0).x + 6, y: fr.top + 12, text: spec.y_label || '', fontSize: 11 });
  }
  const dots = (spec.points || []).filter(point => point.xy).map(point => {
    const p = fr.map(point.xy[0], point.xy[1]);
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.3" fill="currentColor"/>`;
  }).join('');
  const bars = (spec.bars || spec.bins || []).map((bar, i, all) => {
    const w = fr.width / (all.length || 1);
    const h = (Number(bar.frequency || bar.count || 0) / (fr.y[1] || 1)) * fr.height;
    return `<rect x="${(fr.left + i * w + 2).toFixed(1)}" y="${(fr.top + fr.height - h).toFixed(1)}" width="${Math.max(2, w - 4).toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="currentColor"/>`;
  }).join('');
  const ax = axes(fr, { axes: { x_label: spec.x_label, y_label: spec.y_label } });
  return ax.body + ax.marks.map(m => textEl({ x: m.x + m.preferred.dx, y: m.y + m.preferred.dy, text: m.text, fontSize: 11, anchor: m.preferred.anchor })).join('') + bars + dots;
}

function render(figure) {
  const spec = specOf(figure || {});
  const kind = figure && figure.kind;
  let body = '';
  if (kind === 'function_graph' || kind === 'trig_graph') body = plotGraph(spec);
  else if (kind === 'analytic_geometry') body = plotAnalytic(spec);
  else if (kind === 'euclidean' || kind === '3d_trig') body = plotEuclidean(spec, figure.id, kind === '3d_trig');
  else if (kind === 'statistics_chart') body = plotStats(spec);
  else body = `<text x="24" y="120" font-size="13">${esc((figure && figure.caption) || kind || 'Diagram')}</text>`;
  const caption = (figure && figure.caption) || 'Diagram';
  return wrapSvg(caption, body);
}

module.exports = { render, evalPlain, fittedView, textBox, boxesOverlap };
