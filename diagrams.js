// Draw NSC figures from their specs. The PNG crops are reference only and are
// never embedded. given:false values stay off the labels; the curve or point
// is still drawn so the picture matches the paper.
'use strict';
const core = require('./public/core.js');

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

function plotEuclidean(spec) {
  const points = (spec.points || []).map(point => ({ ...point }));
  const placed = new Map();
  const name = label => String(label).split('(')[0].trim();
  // A point that sits on a side, at a midpoint or at an intersection is placed from the points
  // that define it, so S on PQ and T on PR with ST parallel to QR are drawn that way.
  const derived = point => {
    const role = String(point.role || '');
    let m = role.match(/^(?:intersection_of_|intersection_|on_)?([A-Z])([A-Z])_(?:and_)?(?:on_)?([A-Z])([A-Z])$/);
    if (m) return { kind: 'cross', ends: [m[1], m[2], m[3], m[4]] };
    // A point given as lying on a side, where another drawn segment passes through it, is where the two cross.
    const of = /^[A-Z]{2}$/.test(String(point.of || '')) ? point.of : null;
    const through = (spec.segments || []).find(seg => seg.through === point.label);
    if (of && through) return { kind: 'cross', ends: [of[0], of[1], through.from, through.to] };
    if (of && /^on_(?:segment|side|line)$/.test(role)) return { kind: 'along', ends: [of[0], of[1]] };
    if ((m = role.match(/^midpoint_of_([A-Z])([A-Z])$/))) return { kind: 'along', ends: [m[1], m[2]], t: 0.5 };
    if ((m = role.match(/^on_(?:line_)?([A-Z])([A-Z])_?produced$/))) return { kind: 'beyond', ends: [m[1], m[2]] };
    if ((m = role.match(/^on_(?:side_|segment_)?([A-Z])([A-Z])$/))) return { kind: 'along', ends: [m[1], m[2]] };
    return null;
  };
  const hasCircle = (spec.circles || []).length > 0;
  const base = points.filter(point => !point.xy && !derived(point) && !(hasCircle && /^centre/.test(String(point.role || ''))));
  points.forEach(point => {
    if (point.xy) placed.set(point.label, { x: 160 + point.xy[0], y: 120 - point.xy[1] });
    else if (hasCircle && /^centre/.test(String(point.role || '')) && !placed.has('__centre')) { placed.set(point.label, { x: 160, y: 118 }); placed.set('__centre', true); }
  });
  placed.delete('__centre');
  base.forEach((point, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(base.length, 1);
    placed.set(point.label, { x: 160 + 82 * Math.cos(angle), y: 118 + 82 * Math.sin(angle) });
  });
  const find = label => { for (const [key, value] of placed) if (name(key) === label) return value; return null; };
  const alongCount = new Map();
  for (let pass = 0; pass < 3; pass++) {
    for (const point of points) {
      if (placed.has(point.label)) continue;
      const how = derived(point);
      if (!how) continue;
      const ends = how.ends.map(find);
      if (ends.some(p => !p)) continue;
      if (how.kind === 'along') {
        const key = how.ends.join('');
        const n = alongCount.get(key) || 0;
        alongCount.set(key, n + 1);
        const t = how.t != null ? how.t : [0.42, 0.68, 0.25][n % 3];
        placed.set(point.label, { x: ends[0].x + (ends[1].x - ends[0].x) * t, y: ends[0].y + (ends[1].y - ends[0].y) * t });
      } else if (how.kind === 'beyond') {
        placed.set(point.label, { x: ends[1].x + (ends[1].x - ends[0].x) * 0.55, y: ends[1].y + (ends[1].y - ends[0].y) * 0.55 });
      } else {
        const [p1, p2, p3, p4] = ends;
        const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        // Parallel in this rough layout: keep the point on its first line rather than off in a corner.
        if (Math.abs(d) < 1e-6) { placed.set(point.label, { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }); continue; }
        const u = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
        placed.set(point.label, { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) });
      }
    }
  }
  const rest = points.filter(point => !placed.has(point.label));
  rest.forEach((point, i) => {
    const angle = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / Math.max(rest.length, 1);
    placed.set(point.label, { x: 160 + 110 * Math.cos(angle), y: 118 + 95 * Math.sin(angle) });
  });
  const at = label => placed.get(label) || lookupPlace(placed, label);
  function lookupPlace(map, label) {
    for (const [key, value] of map) if (key.split('(')[0].trim() === label) return value;
    return null;
  }
  const segs = (spec.segments || []).map(seg => {
    const a = at(seg.from), b = at(seg.to);
    if (!a || !b) return '';
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="currentColor" stroke-width="1.5"/>`;
  }).join('');
  let circle = '';
  if ((spec.circles || []).length) {
    const through = spec.circles[0].through || [];
    const pts = through.map(at).filter(Boolean);
    const onRing = p => Math.abs(Math.hypot(p.x - 160, p.y - 118) - 82) < 0.5;
    if (pts.length >= 3 && pts.every(onRing)) {
      circle = `<circle cx="160" cy="118" r="82" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    } else if (pts.length >= 3) {
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const r = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
      circle = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    }
  }
  const labels = [...placed].map(([label, p]) => `<text x="${(p.x + 6).toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="12">${esc(String(label).split('(')[0])}</text>`).join('');
  const dots = [...placed].map(([, p]) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="currentColor"/>`).join('');
  return circle + segs + dots + labels;
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
  else if (kind === 'euclidean' || kind === '3d_trig') body = plotEuclidean(spec);
  else if (kind === 'statistics_chart') body = plotStats(spec);
  else body = `<text x="24" y="120" font-size="13">${esc((figure && figure.caption) || kind || 'Diagram')}</text>`;
  const caption = esc((figure && figure.caption) || 'Diagram');
  return `<svg class="fig" viewBox="0 0 320 240" role="img" aria-label="${caption}">${body}</svg>`;
}

module.exports = { render, evalPlain };
