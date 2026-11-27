// Lays out a Euclidean figure from its spec. Points are solved numerically so that the facts the
// paper states (on a circle, on a line, parallel, perpendicular, midpoint, tangent, equal lengths,
// ratios, given angles) hold in the drawing. Zero dependencies; deterministic for a given figure.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const EPS = 1e-9;
// Solving takes up to a couple of seconds a figure, so the solved positions for the shipped papers are
// stored beside them and reused while the spec is unchanged. `npm run figures:layout` rewrites the file.
const STORE = path.join(__dirname, 'data', 'nsc', 'figure-layouts.json');

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function random(seed) {
  let s = seed || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const letters = text => String(text || '').split(/\s+/)[0].replace(/[^A-Z]/g, '').split('');
const produced = text => /produced/i.test(String(text || ''));
const degrees = size => {
  const m = String(size == null ? '' : size).replace(/\^\{?\\circ\}?|°/g, '').trim().match(/^(\d+(?:[.,]\d+)?)$/);
  return m ? Number(m[1].replace(',', '.')) : null;
};

// A 3D figure is drawn as a parallel projection: lines on one line stay on it, midpoints and
// parallelograms survive, and a vertical line stays vertical. Angles and lengths do not, so those
// facts are dropped here and only the projection-safe ones are kept.
function planeRing(plane) {
  return (plane.points || plane.contains || []).map(p => typeof p === 'string' ? p : String(p.label || p));
}
function isHorizPlane(plane) {
  return !!(plane && (plane.horizontal || /horizont|base|ground|floor/i.test(String(plane.name || ''))));
}
function isGroundPoint(point) {
  if (!point) return false;
  return /horizont|base|ground|floor/i.test(String(point.plane || ''))
    || /foot|ground|observer|base_vertex|centre_of_base|center_of_base/i.test(String(point.role || ''));
}

function flatten3d(spec) {
  const points = (spec.points || []).map(point => typeof point === 'string' ? { label: point } : point);
  const byLabel = new Map(points.map(p => [p.label, p]));
  const segments = (spec.segments || []).slice();
  const facts = [];
  const vertical = [];
  const outline = !segments.length;
  const seenSeg = new Set(segments.map(s => [s.from, s.to].sort().join(':')));
  const addSeg = (a, b) => {
    const key = [a, b].sort().join(':');
    if (!a || !b || a === b || seenSeg.has(key)) return;
    seenSeg.add(key);
    segments.push({ from: a, to: b });
  };
  const ground = new Set();
  for (const plane of spec.planes || []) {
    const ring = planeRing(plane);
    if (outline && ring.length >= 3) ring.forEach((a, i) => addSeg(a, ring[(i + 1) % ring.length]));
    if (ring.length === 4 && /rect|square|parallel|rhomb/i.test(String(plane.shape || ''))) facts.push({ type: 'parallelogram', points: ring });
    if (ring.length >= 4) facts.push({ type: 'convex', points: ring });
    if (isHorizPlane(plane)) ring.forEach(p => ground.add(p));
  }
  for (const point of points) if (isGroundPoint(point) && point.label) ground.add(point.label);
  for (const fact of spec.facts || []) {
    if (fact.type === 'midpoint' || fact.type === 'collinear') facts.push(fact);
    if (/rhombus|parallelogram|rectangle|square/.test(fact.type)) facts.push({ type: 'parallelogram', points: fact.points || letters(fact.figure || fact.name || fact.of) });
  }
  const rightAngles = [];
  for (const ra of spec.right_angles || []) {
    const [l1, l2] = (ra.between || []).map(String);
    if (!l1 || !l2) continue;
    const planeLike = l => /plane/i.test(l) || letters(l).length >= 3;
    if (planeLike(l2) && !planeLike(l1)) vertical.push({ line: l1, foot: ra.at });
    else if (planeLike(l1) && !planeLike(l2)) vertical.push({ line: l2, foot: ra.at });
    else for (const line of [l1, l2]) if (!letters(line).includes(ra.at)) rightAngles.push({ on: line, at: ra.at });
  }
  for (const seg of (spec.segments || [])) {
    if (!seg.vertical) continue;
    const a = seg.from, b = seg.to;
    const already = vertical.some(v => letters(v.line).includes(a) && letters(v.line).includes(b));
    if (already) continue;
    const ga = ground.has(a) || isGroundPoint(byLabel.get(a));
    const gb = ground.has(b) || isGroundPoint(byLabel.get(b));
    let foot = ga && !gb ? a : gb && !ga ? b : null;
    if (!foot) {
      const ra = String((byLabel.get(a) || {}).role || '');
      const rb = String((byLabel.get(b) || {}).role || '');
      if (/foot|base|ground/i.test(ra)) foot = a;
      else if (/foot|base|ground|centre_of_base|center_of_base/i.test(rb) || /top|apex|hook|helicopter/i.test(ra)) foot = b;
      else if (/foot|base|ground|centre_of_base|center_of_base/i.test(ra) || /top|apex|hook|helicopter/i.test(rb)) foot = a;
      else foot = b;
    }
    vertical.push({ line: a + b, foot });
  }
  // Draw every vertical, even when it is not already an edge of a plane outline.
  for (const v of vertical) {
    const pts = letters(v.line);
    if (pts.length >= 2) addSeg(pts[0], pts[1]);
  }
  return { points, segments, facts, circles: [], vertical, onLines: rightAngles };
}

// Cabinet / cavalier-style oblique projection: x right, y into the page, z up.
// Verticals stay vertical; a horizontal rectangle becomes a receding parallelogram.
const OBLIQUE_ANGLE = Math.PI / 6;
const OBLIQUE_DEPTH = 0.5;
function projectOblique(p) {
  return {
    X: p.x + OBLIQUE_DEPTH * p.y * Math.cos(OBLIQUE_ANGLE),
    Y: p.z + OBLIQUE_DEPTH * p.y * Math.sin(OBLIQUE_ANGLE),
  };
}

function cycleOrder(verts, segments) {
  const adj = new Map(verts.map(v => [v, []]));
  for (const s of segments || []) {
    if (adj.has(s.from) && adj.has(s.to)) {
      adj.get(s.from).push(s.to);
      adj.get(s.to).push(s.from);
    }
  }
  if ([...adj.values()].some(a => a.length < 2)) return null;
  const order = [verts[0]];
  let prev = null, cur = verts[0];
  while (order.length < verts.length) {
    const next = adj.get(cur).find(p => p !== prev && !order.includes(p)) || adj.get(cur).find(p => p !== prev);
    if (!next || order.includes(next)) return null;
    order.push(next);
    prev = cur; cur = next;
  }
  return order;
}

// Reconstruct world coordinates for a 3D figure (vertical poles, horizontal bases,
// a rectangle standing as a backdrop) and project them. Returns null when the
// figure has no vertical or no clear ground plane, so the 2D solver can take over.
function place3d(spec, model) {
  const pointBy = new Map();
  for (const p of (spec.points || [])) {
    const obj = typeof p === 'string' ? { label: p } : p;
    if (obj.label) pointBy.set(obj.label, obj);
  }
  const inModel = new Set(model.labels);
  const flat = flatten3d(spec);
  const verticals = [];
  for (const v of flat.vertical || []) {
    const pts = letters(v.line);
    const foot = v.foot;
    const top = pts.find(p => p !== foot);
    if (top && foot && inModel.has(top) && inModel.has(foot)) verticals.push({ top, foot, line: v.line });
  }
  const ground = new Set();
  const horizRings = [];
  for (const plane of spec.planes || []) {
    const ring = planeRing(plane).filter(p => inModel.has(p));
    if (isHorizPlane(plane) && ring.length) { ring.forEach(p => ground.add(p)); horizRings.push(ring); }
  }
  for (const v of verticals) ground.add(v.foot);
  for (const [label, point] of pointBy) if (inModel.has(label) && isGroundPoint(point)) ground.add(label);
  const offGround = model.labels.filter(l => !ground.has(l));
  if (verticals.length === 0 && !(ground.size >= 3 && offGround.length === 1)) return null;

  const world = {};
  const set = (lab, x, y, z) => { if (lab && world[lab] == null) world[lab] = { x, y, z }; };

  for (const ring of horizRings) {
    if (ring.length === 4) {
      const [a, b, c, d] = ring;
      set(a, 0, 0, 0);
      set(b, 0, 1.2, 0);
      set(c, 1.4, 1.2, 0);
      set(d, 1.4, 0, 0);
    }
  }

  const centre = model.labels.find(l => /centre_of_base|center_of_base/i.test(String((pointBy.get(l) || {}).role || '')));
  if (centre) {
    set(centre, 0, 0, 0);
    const verts = [...ground].filter(l => l !== centre);
    if (verts.length === 4) {
      const order = cycleOrder(verts, flat.segments) || verts;
      order.forEach((lab, i) => {
        const a = -Math.PI / 4 + i * Math.PI / 2;
        set(lab, Math.cos(a), Math.sin(a), 0);
      });
    }
  }

  const unplacedG = [...ground].filter(l => !world[l]);
  if (unplacedG.length) {
    const foot = verticals.map(v => v.foot).find(f => ground.has(f)) || unplacedG[0];
    set(foot, 0, 0, 0);
    const others = [...ground].filter(l => l !== foot && !world[l]);
    if (others.length === 2) {
      set(others[0], 1.0, 1.15, 0);
      set(others[1], -0.7, 1.25, 0);
    } else {
      others.forEach((lab, i) => {
        const a = Math.PI * (i + 1) / (others.length + 1);
        const r = 1.05 + (i % 2) * 0.2;
        set(lab, r * Math.cos(a - Math.PI / 2), 0.35 + r * Math.sin(a), 0);
      });
    }
  }
  for (const lab of ground) if (!world[lab]) set(lab, 0.8, 0.8, 0);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of Object.values(world)) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const H = 1.15 * span;

  for (const v of verticals) {
    const f = world[v.foot] || { x: 0, y: 0, z: 0 };
    world[v.foot] = { x: f.x, y: f.y, z: 0 };
    world[v.top] = { x: f.x, y: f.y, z: H };
  }

  for (const lab of model.labels) {
    if (world[lab]) continue;
    const role = String((pointBy.get(lab) || {}).role || '');
    const hit = verticals.find(v => {
      const line = letters(v.line).join('');
      return new RegExp('on[_-]?' + line + '|on[_-]?' + line[1] + line[0], 'i').test(role);
    });
    if (hit && world[hit.foot] && world[hit.top]) {
      const a = world[hit.foot], b = world[hit.top], t = 0.55;
      world[lab] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
  }

  for (const lab of model.labels) {
    if (world[lab]) continue;
    let sx = 0, sy = 0, n = 0;
    for (const gnd of ground) if (world[gnd]) { sx += world[gnd].x; sy += world[gnd].y; n++; }
    world[lab] = { x: n ? sx / n : 0, y: n ? sy / n : 0.4, z: H };
  }

  if (model.labels.some(l => !world[l])) return null;
  return world;
}

function layout3d(spec) {
  const model = buildModel(spec, { threeD: true });
  const world = place3d(spec, model);
  if (!world) return null;
  const n = model.labels.length;
  const v = new Array(2 * n + 3 * Math.max(model.circles.length, 1)).fill(0);
  for (let i = 0; i < n; i++) {
    const pr = projectOblique(world[model.labels[i]]);
    v[2 * i] = pr.X;
    v[2 * i + 1] = pr.Y;
  }
  return withVector(model, v);
}


function buildModel(input, options) {
  const spec = options && options.threeD ? flatten3d(input) : input;
  const labels = [];
  const index = new Map();
  const id = label => {
    const key = String(label || '').split('(')[0].trim();
    if (!/^[A-Z]$/.test(key)) return -1;
    if (!index.has(key)) { index.set(key, labels.length); labels.push(key); }
    return index.get(key);
  };
  const points = spec.points || [];
  points.forEach(point => id(point.label));
  for (const seg of spec.segments || []) { id(seg.from); id(seg.to); }

  // circles: centre is a point index or a hidden centre; radius is a variable except for the first circle
  const circles = (spec.circles || []).map((circle, i) => ({
    i, drawn: true,
    name: String(circle.name || circle.role || ''),
    centre: circle.centre ? id(circle.centre) : -1,
    through: new Set((circle.through || []).map(id).filter(n => n >= 0)),
    diameter: circle.diameter ? letters(circle.diameter).map(id) : null,
  }));
  const circleNamed = word => circles.find(c => new RegExp(word, 'i').test(c.name));
  const circleOf = (pointIndex, hint) => {
    if (hint) {
      if (/small/i.test(hint) && circleNamed('small')) return circleNamed('small');
      if (/larg/i.test(hint) && circleNamed('larg')) return circleNamed('larg');
    }
    return circles.find(c => c.through.has(pointIndex)) || circles[0] || null;
  };
  const addCircleThrough = pts => {
    const ids = pts.map(id).filter(n => n >= 0);
    let best = null, overlap = 0;
    for (const c of circles) {
      const n = ids.filter(p => c.through.has(p)).length;
      if (n > overlap) { best = c; overlap = n; }
    }
    if (!best) { best = { i: circles.length, drawn: false, name: '', centre: -1, through: new Set(), diameter: null }; circles.push(best); }
    ids.forEach(p => best.through.add(p));
  };

  const cons = []; // hard constraints: { tag, f(geom) -> residual }
  const collinear = []; // [p, a, b] triples the facts put on one line; the shape terms leave these alone
  const add = (tag, f) => cons.push({ tag, f });
  const onLine = (p, a, b, tag, range) => {
    if ([p, a, b].some(n => n < 0) || p === a || p === b) return;
    collinear.push([p, a, b]);
    add(tag, g => g.lineDist(p, a, b));
    if (range === 'between') add(tag + ' (between)', g => g.hinge(g.param(p, a, b), 0.06, 0.94));
    if (range === 'beyond') add(tag + ' (produced)', g => Math.max(0, 1.12 - g.param(p, a, b)));
  };
  const lineOf = text => {
    const ls = letters(text).map(id);
    return { a: ls[0], b: ls[ls.length - 1], all: ls, produced: produced(text) };
  };
  const placeOnLine = (p, text, tag, mode) => {
    const l = lineOf(text);
    if (l.a == null || l.b == null || l.a < 0 || l.b < 0) return;
    onLine(p, l.a, l.b, tag, mode || (l.produced ? 'beyond' : 'between'));
  };
  const perpendicular = (l1, l2, tag) => {
    const u = lineOf(l1), w = lineOf(l2);
    if ([u.a, u.b, w.a, w.b].some(n => n == null || n < 0)) return;
    add(tag, g => g.dot(u.a, u.b, w.a, w.b));
  };
  const parallel = (l1, l2, tag) => {
    const u = lineOf(l1), w = lineOf(l2);
    if ([u.a, u.b, w.a, w.b].some(n => n == null || n < 0)) return;
    add(tag, g => g.cross(u.a, u.b, w.a, w.b));
  };
  const lengthRatio = (s1, s2, p, q, tag) => {
    const u = lineOf(s1), w = lineOf(s2);
    if ([u.a, u.b, w.a, w.b].some(n => n == null || n < 0)) return;
    add(tag, g => (g.len(u.a, u.b) * q - g.len(w.a, w.b) * p) / (p + q));
  };
  const tangentAt = (lineText, contact, tag) => {
    const l = lineOf(lineText), t = id(contact);
    if (t < 0 || l.a == null || l.a < 0 || l.b < 0) return;
    const circle = circleOf(t);
    if (!circle) return;
    circle.through.add(t);
    for (const p of l.all) if (p !== l.a && p !== l.b) onLine(p, l.a, l.b, tag + ' line', null);
    if (t !== l.a && t !== l.b) onLine(t, l.a, l.b, tag + ' contact on line', null);
    const other = l.a === t ? l.b : l.a;
    add(tag, g => g.perpAt(circle, t, other));
  };

  // point roles
  const segs = spec.segments || [];
  for (const point of points) {
    const p = id(point.label), role = String(point.role || '');
    const where = point.on || point.of;
    let m;
    if (/^centre/.test(role)) {
      const c = circleOf(-1, role) || null;
      const target = (/larg/.test(role) && circleNamed('larg')) || (/small/.test(role) && circleNamed('small')) || circles.find(x => x.centre === p) || circles.find(x => x.centre < 0) || c;
      if (target && target.centre < 0) target.centre = p;
    }
    if (/circle/.test(role) && !/centre/.test(role)) {
      if (/both/.test(role)) circles.forEach(c => c.through.add(p));
      else { const c = circleOf(p, role); if (c) c.through.add(p); }
    }
    if ((m = role.match(/^midpoint_of_([A-Z])([A-Z])$/))) {
      const a = id(m[1]), b = id(m[2]);
      add(`${point.label} midpoint of ${m[1]}${m[2]}`, g => g.mid(p, a, b));
    }
    if ((m = role.match(/(?:intersection_of_|intersection_|^on_)([A-Z])([A-Z])_(?:and_)?(?:on_)?([A-Z])([A-Z])$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]}`, null);
      onLine(p, id(m[3]), id(m[4]), `${point.label} on ${m[3]}${m[4]}`, null);
    } else if ((m = role.match(/^on_(?:line_)?([A-Z])([A-Z])_?produced$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]} produced`, 'beyond');
    } else if ((m = role.match(/^on_(?:side_|segment_)?([A-Z])([A-Z])$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]}`, 'between');
    } else if ((m = role.match(/_and_(?:on_)?([A-Z])([A-Z])$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]}`, 'between');
    } else if ((m = role.match(/_and_([A-Z])([A-Z])_produced$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]} produced`, 'beyond');
    } else if ((m = role.match(/point_of_contact_with_([A-Z])([A-Z])$/))) {
      onLine(p, id(m[1]), id(m[2]), `${point.label} on ${m[1]}${m[2]}`, null);
    }
    if (Array.isArray(where)) where.forEach(text => placeOnLine(p, text, `${point.label} on ${text}`, produced(text) ? null : 'line'));
    else if (where && /^[A-Z]{2,3}( produced)?$/.test(String(where))) placeOnLine(p, where, `${point.label} on ${where}`);
    if (/foot_of_perpendicular/.test(role) && where) {
      const l = lineOf(where);
      const from = segs.map(s => [id(s.from), id(s.to)]).find(([a, b]) => (a === p && !l.all.includes(b)) || (b === p && !l.all.includes(a)));
      if (from) { const q = from[0] === p ? from[1] : from[0]; add(`${point.label} foot of perpendicular`, g => g.dot(q, p, l.a, l.b)); }
    }
    if (role === 'intersection_of_diagonals') {
      // the quadrilateral comes from a named figure fact, or from lengths measured from this point
      const quad = (spec.facts || []).map(f => f.points || letters(f.name || f.figure || f.quad)).find(vs => vs.length === 4);
      if (quad) {
        onLine(p, id(quad[0]), id(quad[2]), `${point.label} on ${quad[0]}${quad[2]}`, 'between');
        onLine(p, id(quad[1]), id(quad[3]), `${point.label} on ${quad[1]}${quad[3]}`, 'between');
      } else {
        // lengths written XT and TY put T between X and Y
        const named = (spec.facts || []).filter(f => f.type === 'length' && f.segment).map(f => letters(f.segment)).filter(ls => ls.length === 2 && ls.includes(point.label));
        const before = new Set(named.filter(ls => ls[1] === point.label).map(ls => ls[0]));
        const after = new Set(named.filter(ls => ls[0] === point.label).map(ls => ls[1]));
        for (const seg of segs) if ((before.has(seg.from) && after.has(seg.to)) || (before.has(seg.to) && after.has(seg.from))) onLine(p, id(seg.from), id(seg.to), `${point.label} on ${seg.from}${seg.to}`, 'between');
      }
    }
    if ((m = role.match(/tangent_at_([A-Z])$/))) {
      const t = id(m[1]), c = circleOf(t);
      if (c) add(`${point.label} on tangent at ${m[1]}`, g => g.perpAt(c, t, p));
    }
  }

  // segments that pass through named points, and segment roles
  for (const seg of segs) {
    const a = id(seg.from), b = id(seg.to);
    const via = [].concat(seg.through || [], seg.via || []);
    via.forEach(v => onLine(id(v), a, b, `${v} on ${seg.from}${seg.to}`, 'between'));
    const role = String(seg.role || '');
    let m;
    if ((m = role.match(/tangent_at_([A-Z])$/))) tangentAt(seg.from + seg.to, m[1], `${seg.from}${seg.to} tangent at ${m[1]}`);
    if (role === 'diameter') {
      const c = circleOf(a); if (c) { c.through.add(a); c.through.add(b); add(`${seg.from}${seg.to} diameter`, g => g.diam(c, a, b)); }
    }
  }
  for (const c of circles) if (c.diameter && c.diameter.length === 2) {
    const [a, b] = c.diameter; c.through.add(a); c.through.add(b);
    add(`circle diameter`, g => g.diam(c, a, b));
  }

  // facts
  const lengthGroups = new Map();
  for (const fact of spec.facts || []) {
    const t = fact.type;
    if (t === 'parallel' && fact.lines) parallel(fact.lines[0], fact.lines[1], `${fact.lines.join(' ∥ ')}`);
    else if (t === 'perpendicular') {
      if (fact.lines) perpendicular(fact.lines[0], fact.lines[1], `${fact.lines.join(' ⊥ ')}`);
      else if (fact.of && fact.to) {
        perpendicular(fact.of, fact.to, `${fact.of} ⊥ ${fact.to}`);
        if (fact.at) { const p = id(fact.at); placeOnLine(p, fact.of, `${fact.at} on ${fact.of}`, 'line'); placeOnLine(p, fact.to, `${fact.at} on ${fact.to}`, 'line'); }
      }
    } else if (t === 'equal_lengths' || t === 'equal_segments') {
      const [s1, s2] = fact.segments || [];
      if (s1 && s2) lengthRatio(s1, s2, 1, 1, `${s1} = ${s2}`);
    } else if (t === 'equal_marks') {
      const [s1, s2] = (fact.segments || []).map(s => Array.isArray(s) ? s.join('') : s);
      if (s1 && s2) lengthRatio(s1, s2, 1, 1, `${s1} = ${s2}`);
    } else if (t === 'ratio') {
      let segsR = fact.segments, value = fact.value;
      if (!segsR && fact.of) segsR = String(fact.of).split(':');
      if (!segsR && fact.statement) { const m = String(fact.statement).match(/([A-Z]{2})\s*:\s*([A-Z]{2})\s*=\s*(\d+)\s*:\s*(\d+)/); if (m) { segsR = [m[1], m[2]]; value = m[3] + ':' + m[4]; } }
      const v = String(value || '').match(/(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)/);
      if (segsR && v) lengthRatio(segsR[0], segsR[1], Number(v[1].replace(',', '.')), Number(v[2].replace(',', '.')), `${segsR[0]}:${segsR[1]} = ${v[1]}:${v[2]}`);
    } else if (t === 'length' && fact.segment) {
      const m = String(fact.size || '').replace(/\s/g, '').match(/^(\d*(?:[.,]\d+)?)([a-z])$/);
      if (m) { const key = m[2]; if (!lengthGroups.has(key)) lengthGroups.set(key, []); lengthGroups.get(key).push([fact.segment, Number((m[1] || '1').replace(',', '.'))]); }
      const n = degrees(fact.size) == null ? Number(String(fact.size).replace(',', '.')) : null;
      if (Number.isFinite(n) && n > 0) { if (!lengthGroups.has('#')) lengthGroups.set('#', []); lengthGroups.get('#').push([fact.segment, n]); }
    } else if (t === 'tangent') tangentAt(fact.line, fact.at, `${fact.line} tangent at ${fact.at}`);
    else if (t === 'diameter') {
      const l = lineOf(fact.line || fact.segment); const c = circleOf(l.a);
      if (c && l.a >= 0 && l.b >= 0) {
        c.through.add(l.a); c.through.add(l.b);
        for (const p of l.all) if (p !== l.a && p !== l.b && c.centre < 0) c.centre = p;
        add(`${fact.line || fact.segment} diameter`, g => g.diam(c, l.a, l.b));
      }
    } else if (t === 'parallelogram' || t === 'rectangle') {
      const vs = (fact.points || letters(fact.figure || fact.name)).map(String);
      if (vs.length === 4) {
        const [a, b, c, d] = vs;
        parallel(a + b, d + c, `${a}${b} ∥ ${d}${c}`);
        parallel(b + c, a + d, `${b}${c} ∥ ${a}${d}`);
        if (t === 'rectangle') perpendicular(a + b, b + c, `${a}${b} ⊥ ${b}${c}`);
      }
    } else if (/^cyclic/.test(t)) addCircleThrough(fact.points || letters(fact.quad || fact.name));
    else if (t === 'midpoint' && fact.point && fact.of) {
      const p = id(fact.point), l = lineOf(fact.of);
      add(`${fact.point} midpoint of ${fact.of}`, g => g.mid(p, l.a, l.b));
    } else if (t === 'collinear' || t === 'order_on_line') {
      const order = (fact.order || fact.points || []).map(id);
      const ends = [order[0], order[order.length - 1]];
      for (const p of order.slice(1, -1)) onLine(p, ends[0], ends[1], `${labels[p]} on ${labels[ends[0]]}${labels[ends[1]]}`, fact.order || t === 'order_on_line' ? 'between' : null);
      if (order.length > 3 && (fact.order || t === 'order_on_line')) for (let i = 1; i < order.length - 2; i++) add(`order on ${labels[ends[0]]}${labels[ends[1]]}`, g => Math.max(0, g.param(order[i], ends[0], ends[1]) - g.param(order[i + 1], ends[0], ends[1]) + 0.05));
    } else if (t === 'centre' && fact.point) {
      const p = id(fact.point);
      const c = (fact.of && /larg/i.test(fact.of) && circleNamed('larg')) || (fact.of && /small/i.test(fact.of) && circleNamed('small')) || circles.find(x => x.centre === p) || circles.find(x => x.centre < 0);
      if (c && c.centre < 0) c.centre = p;
    } else if (t === 'on_circle') {
      const pts = fact.points || (fact.point ? [fact.point] : []);
      for (const label of pts) { const p = id(label); const c = circleOf(p, fact.of); if (c) c.through.add(p); }
      if (fact.also_on && fact.point) placeOnLine(id(fact.point), fact.also_on, `${fact.point} on ${fact.also_on}`);
    } else if (t === 'convex' && Array.isArray(fact.points)) {
      // a face drawn in projection is still a convex polygon: every turn goes the same way
      const ring = fact.points.map(id);
      if (ring.every(n => n >= 0)) add(`${fact.points.join('')} is convex`, g => {
        const turns = ring.map((a, i) => { const b = ring[(i + 1) % ring.length], c = ring[(i + 2) % ring.length]; return g.cross(a, b, b, c); });
        const sign = turns.reduce((x, y) => x + y, 0) >= 0 ? 1 : -1;
        return turns.reduce((sum, turn) => sum + Math.max(0, 0.15 - sign * turn), 0);
      });
    } else if (t === 'angle_bisector' && fact.angle && fact.ray) {
      const [a, o, b] = letters(fact.angle).map(id); const r = lineOf(fact.ray); const q = r.a === o ? r.b : r.a;
      if ([a, o, b, q].every(n => n >= 0)) add(`${fact.ray} bisects ${fact.angle}`, g => g.angle(a, o, q) - g.angle(q, o, b));
    } else if (t === 'angle' && /^[A-Z]{3}$/.test(String(fact.name || ''))) {
      const size = degrees(fact.size);
      const [a, o, b] = letters(fact.name).map(id);
      if (size != null) add(`∠${fact.name} = ${size}°`, g => g.angle(a, o, b) - size * Math.PI / 180);
    } else if (t === 'touch_internally' && fact.at && circles.length >= 2) {
      const p = id(fact.at); const [c1, c2] = [circleNamed('small') || circles[1], circleNamed('larg') || circles[0]];
      c1.through.add(p); c2.through.add(p);
      add(`circles touch at ${fact.at}`, g => g.touch(c1, c2));
    }
  }
  for (const group of lengthGroups.values()) for (let i = 1; i < group.length; i++) {
    const [s1, k1] = group[0], [s2, k2] = group[i];
    lengthRatio(s1, s2, k1, k2, `${s1}:${s2} = ${k1}:${k2}`);
  }
  for (const ra of spec.right_angles || []) if (ra.between) {
    perpendicular(ra.between[0], ra.between[1], `${ra.between.join(' ⊥ ')}`);
    const at = id(ra.at);
    for (const line of ra.between) if (!letters(line).includes(ra.at)) placeOnLine(at, line, `${ra.at} on ${line}`, 'line');
  }
  for (const ang of spec.angles || []) {
    const size = degrees(ang.size);
    if (size != null && Array.isArray(ang.points) && ang.points.length === 3) {
      const [a, o, b] = ang.points.map(id);
      add(`∠${ang.points.join('')} = ${size}°`, g => g.angle(a, o, b) - size * Math.PI / 180);
    }
  }
  for (const v of spec.vertical || []) {
    const l = lineOf(v.line), foot = id(v.foot), top = l.a === foot ? l.b : l.a;
    if (top >= 0 && foot >= 0) {
      add(`${v.line} vertical`, g => (g.X(top) - g.X(foot)) / (g.len(top, foot) + EPS));
      add(`${v.line} rises from ${v.foot}`, g => Math.max(0, g.Y(foot) + 0.4 - g.Y(top)));
    }
  }
  for (const o of spec.onLines || []) placeOnLine(id(o.at), o.on, `${o.at} on ${o.on}`, 'line');
  // a circle named smaller is drawn visibly smaller than the one named larger
  const small = circleNamed('small'), large = circleNamed('larg');
  if (small && large && small !== large) add('smaller circle is smaller', g => Math.max(0, g.rad(small) - 0.75 * g.rad(large)));
  // points on a circle: the membership the facts and roles collected
  for (const c of circles) for (const p of c.through) if (p !== c.centre) add(`${labels[p]} on circle ${c.i + 1}`, g => g.onCircle(c, p));
  for (const c of circles) if (c.centre >= 0) for (const fact of spec.facts || []) if (fact.type === 'diameter') {
    const l = lineOf(fact.line || fact.segment); if (l.a >= 0 && l.b >= 0) collinear.push([c.centre, l.a, l.b]);
  }
  const segments = segs.map(seg => [id(seg.from), id(seg.to)]).filter(([a, b]) => a >= 0 && b >= 0 && a !== b);
  // Every point that lies on a segment by the facts: those pairs are allowed to touch.
  const onSeg = new Set();
  const lineGroups = segments.map(([a, b]) => { const set = new Set([a, b]); for (const [p, x, y] of collinear) if ((x === a && y === b) || (x === b && y === a) || (set.has(x) && set.has(y))) set.add(p); return set; });
  segments.forEach(([a, b], k) => lineGroups[k].forEach(p => onSeg.add(k + ':' + p)));
  return { labels, circles, cons, collinear, segments, onSeg, lineGroups, segmentsDrawn: segs };
}

function makeGeom(model, v) {
  const n = model.labels.length;
  const X = i => v[2 * i], Y = i => v[2 * i + 1];
  const cx = c => c.centre >= 0 ? X(c.centre) : (c.i === 0 ? 0 : v[2 * n + 3 * c.i]);
  const cy = c => c.centre >= 0 ? Y(c.centre) : (c.i === 0 ? 0 : v[2 * n + 3 * c.i + 1]);
  const rad = c => c.i === 0 ? 1 : Math.abs(v[2 * n + 3 * c.i + 2]);
  const len = (a, b) => Math.hypot(X(b) - X(a), Y(b) - Y(a));
  const g = {
    X, Y, cx, cy, rad, len,
    lineDist: (p, a, b) => ((X(b) - X(a)) * (Y(p) - Y(a)) - (Y(b) - Y(a)) * (X(p) - X(a))) / (len(a, b) + EPS),
    param: (p, a, b) => ((X(p) - X(a)) * (X(b) - X(a)) + (Y(p) - Y(a)) * (Y(b) - Y(a))) / (len(a, b) ** 2 + EPS),
    hinge: (t, lo, hi) => Math.max(0, lo - t) + Math.max(0, t - hi),
    cross: (a, b, c, d) => ((X(b) - X(a)) * (Y(d) - Y(c)) - (Y(b) - Y(a)) * (X(d) - X(c))) / (len(a, b) * len(c, d) + EPS),
    dot: (a, b, c, d) => ((X(b) - X(a)) * (X(d) - X(c)) + (Y(b) - Y(a)) * (Y(d) - Y(c))) / (len(a, b) * len(c, d) + EPS),
    mid: (p, a, b) => Math.hypot(X(p) - (X(a) + X(b)) / 2, Y(p) - (Y(a) + Y(b)) / 2),
    onCircle: (c, p) => Math.hypot(X(p) - cx(c), Y(p) - cy(c)) - rad(c),
    perpAt: (c, t, q) => ((X(t) - cx(c)) * (X(q) - X(t)) + (Y(t) - cy(c)) * (Y(q) - Y(t))) / ((Math.hypot(X(t) - cx(c), Y(t) - cy(c)) * len(t, q)) + EPS),
    diam: (c, a, b) => Math.hypot((X(a) + X(b)) / 2 - cx(c), (Y(a) + Y(b)) / 2 - cy(c)),
    angle: (a, o, b) => { const u = Math.atan2(Y(a) - Y(o), X(a) - X(o)), w = Math.atan2(Y(b) - Y(o), X(b) - X(o)); let d = Math.abs(u - w); if (d > Math.PI) d = 2 * Math.PI - d; return d; },
    touch: (c1, c2) => Math.hypot(cx(c1) - cx(c2), cy(c1) - cy(c2)) - Math.abs(rad(c1) - rad(c2)),
  };
  return g;
}

// Shape terms: keep a figure readable. Lines meeting at a point should not fold onto each other,
// and a point should not sit on a segment unless a fact puts it there.
function shapeLoss(model, g) {
  let loss = 0;
  const { segments, onSeg, lineGroups } = model;
  for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
    const [a, b] = segments[i], [c, d] = segments[j];
    const o = a === c || a === d ? a : (b === c || b === d ? b : -1);
    if (o < 0) continue;
    const p = o === a ? b : a, q = o === c ? d : c;
    if (lineGroups[i].has(q) || lineGroups[j].has(p)) continue;
    const ang = g.angle(p, o, q);
    if (ang < 0.4) loss += (0.4 - ang) ** 2;
    if (ang > Math.PI - 0.4) loss += (ang - Math.PI + 0.4) ** 2;
  }
  const n = model.labels.length;
  segments.forEach(([a, b], k) => {
    for (let p = 0; p < n; p++) {
      if (onSeg.has(k + ':' + p)) continue;
      const t = g.param(p, a, b);
      if (t <= 0 || t >= 1) continue;
      const d = Math.abs(g.lineDist(p, a, b));
      if (d < 0.12) loss += (0.12 - d) ** 2;
    }
  });
  return loss;
}

function softLoss(model, g, n) {
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.hypot(g.X(i), g.Y(i));
    if (r > 2.2) loss += (r - 2.2) ** 2;
    for (let j = i + 1; j < n; j++) { const d = Math.hypot(g.X(i) - g.X(j), g.Y(i) - g.Y(j)); if (d < 0.32) loss += 0.3 * (0.32 - d) ** 2; }
  }
  for (const c of model.circles) if (c.i > 0) { const r = g.rad(c); if (r < 0.3) loss += (0.3 - r) ** 2; if (r > 2) loss += (r - 2) ** 2; }
  return loss;
}

function solve(spec, seedText, options) {
  if (options && options.threeD) {
    const laid = layout3d(spec);
    if (laid && laid.residuals.every(r => Math.abs(r.residual) <= 0.01)) return laid;
  }
  const model = buildModel(spec, options);
  const n = model.labels.length;
  const size = 2 * n + 3 * Math.max(model.circles.length, 1);
  const fixed = new Array(size).fill(false);
  const first = model.circles[0];
  if (first && first.centre >= 0) { fixed[2 * first.centre] = fixed[2 * first.centre + 1] = true; }
  const hard = v => { const g = makeGeom(model, v); let s = 0; for (const c of model.cons) { const r = c.f(g); s += r * r; } return s; };
  const quality = v => { const g = makeGeom(model, v); return softLoss(model, g, n) + shapeLoss(model, g); };
  const rand = random(hashString(seedText || JSON.stringify(spec)));
  const start = attempt => {
    const v = new Array(size).fill(0);
    const onFirst = first ? [...first.through] : [];
    model.labels.forEach((_, i) => {
      if (first && first.centre === i) return;
      const k = onFirst.indexOf(i);
      const a = k >= 0 ? (attempt === 0 ? -Math.PI / 2 + k * 2 * Math.PI / onFirst.length : rand() * 2 * Math.PI) : rand() * 2 * Math.PI;
      const r = k >= 0 ? 1 : (first ? 0.3 + rand() * 1.1 : 0.4 + rand() * 0.6);
      v[2 * i] = r * Math.cos(a); v[2 * i + 1] = r * Math.sin(a);
    });
    if (!first && attempt === 0) model.labels.forEach((_, k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n; v[2 * k] = Math.cos(a); v[2 * k + 1] = Math.sin(a); });
    model.circles.forEach(c => { if (c.i > 0) { v[2 * n + 3 * c.i] = (rand() - 0.5) * 0.6; v[2 * n + 3 * c.i + 1] = (rand() - 0.5) * 0.6; v[2 * n + 3 * c.i + 2] = 0.5 + rand() * 0.4; } });
    return v;
  };
  // Adam on a numeric gradient: first with the shape terms strong, then a polish where the facts dominate.
  const descend = (v, weight, iters, lr0) => {
    const total = x => hard(x) + weight * quality(x);
    const m = new Array(size).fill(0), s = new Array(size).fill(0), h = 1e-5;
    let lr = lr0;
    for (let it = 1; it <= iters; it++) {
      const grad = new Array(size).fill(0);
      for (let k = 0; k < size; k++) {
        if (fixed[k]) continue;
        const keep = v[k];
        v[k] = keep + h; const up = total(v);
        v[k] = keep - h; const down = total(v);
        v[k] = keep; grad[k] = (up - down) / (2 * h);
      }
      for (let k = 0; k < size; k++) {
        if (fixed[k]) continue;
        m[k] = 0.9 * m[k] + 0.1 * grad[k]; s[k] = 0.999 * s[k] + 0.001 * grad[k] * grad[k];
        v[k] -= lr * (m[k] / (1 - 0.9 ** it)) / (Math.sqrt(s[k] / (1 - 0.999 ** it)) + 1e-8);
      }
      if (it % Math.ceil(iters / 3) === 0) lr *= 0.35;
    }
    return v;
  };
  let best = null, bestScore = Infinity;
  // eight starts, and up to twenty-four while no start has met the facts yet
  for (let attempt = 0; attempt < 8 || (bestScore >= 1e3 && attempt < 24); attempt++) {
    let v = descend(start(attempt), 0.2, 450, 0.03);
    v = descend(v, 0.002, 300, 0.004);
    const e = hard(v);
    const worst = Math.sqrt(e);
    // Facts first: any layout that meets them beats one that does not; then the more readable one.
    const score = (worst > 0.005 ? 1e3 + e : 0) + quality(v);
    if (score < bestScore) { best = v; bestScore = score; }
    if (bestScore < 1e-4 && attempt >= 1) break;
  }
  return withVector(model, best);
}

function withVector(model, v) {
  const g = makeGeom(model, v);
  const residuals = model.cons.map(c => ({ tag: c.tag, residual: Math.abs(c.f(g)) }));
  return { model, g, v, residuals };
}

// Bump MODEL_VERSION when buildModel changes what it reads, so stored layouts are re-solved.
const MODEL_VERSION = 3;
const specHash = (spec, options) => hashString(JSON.stringify([MODEL_VERSION, spec, options || null])).toString(16);
let stored = null;
function storedLayouts() {
  if (stored) return stored;
  try { stored = JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch (err) { stored = {}; }
  return stored;
}

const cache = new Map();
function layout(spec, seedText, options) {
  const key = JSON.stringify([spec, options || null]);
  if (!cache.has(key)) {
    const saved = seedText && storedLayouts()[seedText];
    const model = saved && saved.hash === specHash(spec, options) ? buildModel(spec, options) : null;
    cache.set(key, model && saved.v.length === 2 * model.labels.length + 3 * Math.max(model.circles.length, 1) ? withVector(model, saved.v) : solve(spec, seedText, options));
  }
  return cache.get(key);
}

const TOLERANCE = 0.01;
function report(spec, seedText, options) {
  const { residuals, model } = layout(spec, seedText, options);
  return { constraints: residuals.length, points: model.labels.length, failing: residuals.filter(r => r.residual > TOLERANCE) };
}

// Re-solve every figure in the shipped papers and write the stored positions.
function writeStore(figures) {
  const out = {};
  for (const figure of figures) {
    const options = figure.kind === '3d_trig' ? { threeD: true } : null;
    const { v } = solve(figure.spec, figure.id, options);
    out[figure.id] = { hash: specHash(figure.spec, options), v: v.map(x => Math.round(x * 1e6) / 1e6) };
  }
  fs.writeFileSync(STORE, JSON.stringify(out, null, 0) + '\n');
  stored = out;
  return Object.keys(out).length;
}

function paperFigures() {
  const dir = path.join(__dirname, 'data', 'nsc', 'papers');
  const figures = [];
  for (const file of fs.readdirSync(dir).sort()) {
    const paper = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const figure of paper.figures || []) if (figure.kind === 'euclidean' || figure.kind === '3d_trig') figures.push(figure);
  }
  return figures;
}

if (require.main === module) {
  const n = writeStore(paperFigures());
  console.log(`Stored layouts for ${n} figures in ${path.relative(process.cwd(), STORE)}.`);
}

module.exports = { layout, report, solve, buildModel, specHash, paperFigures, storedLayouts, TOLERANCE };
