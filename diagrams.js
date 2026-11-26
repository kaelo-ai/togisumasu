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

function frame(spec) {
  const view = spec.view || {};
  const x = view.x || [-6, 6];
  const y = view.y || [-6, 6];
  const left = 36, top = 16, width = 250, height = 190;
  const map = (mx, my) => ({
    x: left + (mx - x[0]) / (x[1] - x[0] || 1) * width,
    y: top + (y[1] - my) / (y[1] - y[0] || 1) * height,
  });
  return { x, y, left, top, width, height, map };
}

function axes(fr, spec) {
  const origin = fr.map(0, 0);
  const x0 = fr.map(fr.x[0], 0), x1 = fr.map(fr.x[1], 0);
  const y0 = fr.map(0, fr.y[0]), y1 = fr.map(0, fr.y[1]);
  const labels = spec.axes || {};
  return `<line x1="${x0.x}" y1="${origin.y}" x2="${x1.x}" y2="${origin.y}" stroke="currentColor" stroke-width="1"/>
    <line x1="${origin.x}" y1="${y0.y}" x2="${origin.x}" y2="${y1.y}" stroke="currentColor" stroke-width="1"/>
    <text x="${x1.x - 8}" y="${origin.y - 6}" font-size="11">${esc(labels.x_label || 'x')}</text>
    <text x="${origin.x + 6}" y="${y1.y + 12}" font-size="11">${esc(labels.y_label || 'y')}</text>`;
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

function pointMark(fr, point) {
  if (!point.xy) return '';
  const p = fr.map(point.xy[0], point.xy[1]);
  const label = point.label;
  return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4" fill="currentColor"/>
    ${label ? `<text x="${(p.x + 5).toFixed(1)}" y="${(p.y - 5).toFixed(1)}" font-size="11">${esc(label)}</text>` : ''}`;
}

function plotGraph(spec) {
  const fr = frame(spec);
  const curves = (spec.functions || []).map(fn => plotExpr(fr, fn.plain || fn.expr)).join('');
  const dashes = (spec.asymptotes || []).filter(a => a.drawn !== false).map(a => asymptote(fr, a.equation)).join('');
  const dots = (spec.points || []).map(point => pointMark(fr, point)).join('');
  return axes(fr, spec) + dashes + curves + dots;
}

function lookup(points, name) {
  const key = String(name || '');
  return points.find(point => point.label === key)
    || points.find(point => String(point.label || '').split('(')[0].trim() === key)
    || null;
}

function plotAnalytic(spec) {
  const fr = frame(spec);
  const points = spec.points || [];
  const lines = (spec.segments || spec.lines || []).map(seg => {
    const a = lookup(points, seg.from), b = lookup(points, seg.to);
    if (!a || !b || !a.xy || !b.xy) return '';
    const p = fr.map(a.xy[0], a.xy[1]), q = fr.map(b.xy[0], b.xy[1]);
    return `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="currentColor" stroke-width="1.4"/>`;
  }).join('');
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
  return axes(fr, spec) + lines + circles + points.map(point => pointMark(fr, point)).join('');
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
  const circles = drawn.map(c => `<circle cx="${f(160 + (g.cx(c) - mx) * k)}" cy="${f(120 - (g.cy(c) - my) * k)}" r="${f(g.rad(c) * k)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`).join('');
  const segs = drawnSegments.map(seg => {
    const a = find(seg.from), b = find(seg.to);
    if (!a || !b) return '';
    return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="currentColor" stroke-width="1.5"/>`;
  }).join('');
  const pts = model.labels.map((_, i) => at(i));
  const cxAll = pts.reduce((s, p) => s + p.x, 0) / n, cyAll = pts.reduce((s, p) => s + p.y, 0) / n;
  const dots = pts.map(p => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.2" fill="currentColor"/>`).join('');
  // Labels sit just outside the figure, away from its middle, so they do not land on a line.
  const labels = pts.map((p, i) => {
    const dx = p.x - cxAll, dy = p.y - cyAll, d = Math.hypot(dx, dy) || 1;
    return `<text x="${f(p.x + dx / d * 10)}" y="${f(p.y + dy / d * 10)}" font-size="12" text-anchor="middle" dominant-baseline="middle">${esc(model.labels[i])}</text>`;
  }).join('');
  return circles + segs + dots + labels;
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
    return axes(fr, { axes: { x_label: spec.x_label, y_label: spec.y_label } }) + bars + ticks;
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
  return axes(fr, { axes: { x_label: spec.x_label, y_label: spec.y_label } }) + bars + dots;
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
  const caption = esc((figure && figure.caption) || 'Diagram');
  return `<svg class="fig" viewBox="0 0 320 240" role="img" aria-label="${caption}">${body}</svg>`;
}

module.exports = { render, evalPlain };
