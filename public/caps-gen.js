/* Deterministic, computed generators for Grade 12 CAPS topics that had no
   generator. Methods follow CAPS and Siyavula Grade 10–12 Mathematics (CC BY).
   Answers are calculated in code. Geometry diagrams are drawn here; proofs
   use statement+reason chains. Loaded after core.js in the browser. */
(function (root) {
  'use strict';

  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const Rnz = (a, b) => { let v; do v = R(a, b); while (v === 0); return v; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wantKp = (n, kp) => kp == null || !(kp >= 0) ? R(0, n) : Math.max(0, Math.min(n, kp | 0));
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; };
  function frac(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    n /= g; d /= g;
    return { n, d, v: n / d, tex: d === 1 ? `${n}` : `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`, txt: d === 1 ? `${n}` : `${n}/${d}` };
  }
  function poly(cs, v = 'x') {
    const deg = cs.length - 1; let s = '';
    cs.forEach((c, i) => {
      if (c === 0) return;
      const p = deg - i, ac = Math.abs(c);
      const t = p === 0 ? `${ac}` : `${ac === 1 ? '' : ac}${v}${p > 1 ? '^{' + p + '}' : ''}`;
      s += s === '' ? (c < 0 ? '-' : '') + t : (c < 0 ? ' - ' : ' + ') + t;
    });
    return s || '0';
  }
  const r2 = x => Math.round(x * 100) / 100;
  const dec = x => String(Number(Number(x).toFixed(6)));
  const money = x => 'R\\,' + r2(x).toFixed(2);
  const sg = n => n < 0 ? ` - ${-n}` : ` + ${n}`;

  function svg(w, h, body, caption) {
    const cap = caption ? `<figcaption>${caption}</figcaption>` : '';
    return `<figure class="qfig"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${Math.min(w, 420)}" role="img"${caption ? ` aria-label="${String(caption).replace(/"/g, '')}"` : ''}>${body}</svg>${cap}</figure>`;
  }
  const N = (x, y, t, dy = -8) => `<text x="${x}" y="${y + dy}" font-size="13" text-anchor="middle" fill="currentColor">${t}</text>`;
  const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" fill="none"/>`;
  const C = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="currentColor" stroke-width="1.5" fill="none"/>`;
  const P = (x, y) => `<circle cx="${x}" cy="${y}" r="2.5" fill="currentColor"/>`;
  function pt(cx, cy, r, deg) {
    const t = deg * Math.PI / 180;
    return { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) };
  }
  const xy = (p, q) => L(p.x, p.y, q.x, q.y) + P(p.x, p.y) + P(q.x, q.y);

  // ---- Marked geometry figures (ticks for equal sides, arcs for angles,
  // arrows for parallel lines, a square for 90°). Points are {x, y} in SVG units.
  const GF = (() => {
    const f1 = n => Math.round(n * 10) / 10;
    const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
    const len = v => Math.hypot(v.x, v.y) || 1;
    const unit = v => { const l = len(v); return { x: v.x / l, y: v.y / l }; };
    const at = (p, u, d) => ({ x: p.x + u.x * d, y: p.y + u.y * d });
    const ang = (v, p) => Math.atan2(-(p.y - v.y), p.x - v.x);
    const ln = (p, q, extra = '') => `<line x1="${f1(p.x)}" y1="${f1(p.y)}" x2="${f1(q.x)}" y2="${f1(q.y)}" stroke="currentColor" stroke-width="1.5"${extra}/>`;
    const seg = (p, q) => ln(p, q);
    const dashed = (p, q) => ln(p, q, ' stroke-dasharray="4 3"');
    const dot = p => `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="2.3" fill="currentColor"/>`;
    const text = (x, y, t, size = 13, extra = '') => `<text x="${f1(x)}" y="${f1(y)}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="currentColor"${extra}>${t}</text>`;
    // Label a point, pushed away from `away` (usually the figure's centre).
    function label(p, t, away, d = 13) {
      const u = away ? unit(sub(p, away)) : { x: 0, y: -1 };
      return text(p.x + u.x * d, p.y + u.y * d, t, 15, ' font-style="italic"');
    }
    function ticks(p, q, n = 1) {
      const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, u = unit(sub(q, p)), nr = { x: -u.y, y: u.x };
      let s = '';
      for (let i = 0; i < n; i++) {
        const c = at(m, u, (i - (n - 1) / 2) * 4);
        s += ln(at(c, nr, -5), at(c, nr, 5));
      }
      return s;
    }
    function arrows(p, q, n = 1) {
      const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, u = unit(sub(q, p)), nr = { x: -u.y, y: u.x };
      let s = '';
      for (let i = 0; i < n; i++) {
        const tip = at(m, u, i * 6);
        const back = at(tip, u, -6);
        s += `<polyline points="${f1(at(back, nr, 4).x)},${f1(at(back, nr, 4).y)} ${f1(tip.x)},${f1(tip.y)} ${f1(at(back, nr, -4).x)},${f1(at(back, nr, -4).y)}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
      }
      return s;
    }
    // Arc for the angle at v between rays v->p and v->q, with an optional label.
    function arc(v, p, q, t, opts = {}) {
      const r = opts.r || 18, n = opts.n || 1;
      const a1 = ang(v, p);
      let d = ang(v, q) - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      let s = '';
      for (let i = 0; i < n; i++) {
        const rr = r + i * 4;
        const s1 = { x: v.x + rr * Math.cos(a1), y: v.y - rr * Math.sin(a1) };
        const s2 = { x: v.x + rr * Math.cos(a1 + d), y: v.y - rr * Math.sin(a1 + d) };
        s += `<path d="M${f1(s1.x)},${f1(s1.y)} A${rr},${rr} 0 0 ${d > 0 ? 0 : 1} ${f1(s2.x)},${f1(s2.y)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
      }
      if (t) {
        const mid = a1 + d / 2, lr = r + (n - 1) * 4 + (opts.lr || 13);
        s += text(v.x + lr * Math.cos(mid), v.y - lr * Math.sin(mid), t, 12.5);
      }
      return s;
    }
    function right(v, p, q, s = 10) {
      const u1 = unit(sub(p, v)), u2 = unit(sub(q, v));
      const a = at(v, u1, s), b = at(a, u2, s), c = at(v, u2, s);
      return `<polyline points="${f1(a.x)},${f1(a.y)} ${f1(b.x)},${f1(b.y)} ${f1(c.x)},${f1(c.y)}" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
    }
    // Point at distance r from c in direction deg (maths convention, y up).
    const polar = (c, r, deg) => ({ x: c.x + r * Math.cos(deg * Math.PI / 180), y: c.y - r * Math.sin(deg * Math.PI / 180) });
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const centroid = (...ps) => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length });
    // Apex of a triangle on base BC with base angles b and c (degrees).
    function apex(B, C, b, c) {
      const base = C.x - B.x, tb = Math.tan(b * Math.PI / 180), tc = Math.tan(c * Math.PI / 180);
      const x = base * tc / (tb + tc);
      return { x: B.x + x, y: B.y - x * tb };
    }
    return { seg, dashed, dot, text, label, ticks, arrows, arc, right, polar, mid, centroid, apex, unit, sub, at };
  })();


  // A labelled figure from named points. Segments, ticks and arrows name two
  // points ('AB'); arcs and right angles name three with the vertex in the
  // middle ('ABD' is the angle at B). The view box fits the points.
  function scene(spec) {
    const P = spec.P, pt = k => P[k];
    const names = Object.keys(P).filter(k => !(spec.hide || []).includes(k));
    const all = Object.values(P);
    const cen = spec.centre || GF.centroid(...all);
    let body = '';
    for (const s of spec.segs || []) body += GF.seg(pt(s[0]), pt(s[1]));
    for (const s of spec.dashed || []) body += GF.dashed(pt(s[0]), pt(s[1]));
    for (const [s, n] of spec.ticks || []) body += GF.ticks(pt(s[0]), pt(s[1]), n);
    for (const [s, n] of spec.arrows || []) body += GF.arrows(pt(s[0]), pt(s[1]), n);
    for (const [s, t, o] of spec.arcs || []) body += GF.arc(pt(s[1]), pt(s[0]), pt(s[2]), t, o || {});
    for (const s of spec.rights || []) body += GF.right(pt(s[1]), pt(s[0]), pt(s[2]));
    for (const k of names) body += GF.dot(P[k]) + GF.label(P[k], k, (spec.away && spec.away[k]) || cen);
    for (const [x, y, t] of spec.text || []) body += GF.text(x, y, t, 12);
    const xs = all.map(p => p.x), ys = all.map(p => p.y), pad = 26;
    const x0 = Math.floor(Math.min(...xs) - pad), y0 = Math.floor(Math.min(...ys) - pad);
    const w = Math.ceil(Math.max(...xs) + pad - x0), h = Math.ceil(Math.max(...ys) + pad - y0);
    const cap = spec.caption ? `<figcaption>${spec.caption}</figcaption>` : '';
    const aria = spec.caption ? ` aria-label="${String(spec.caption).replace(/[$"\\]/g, '')}"` : '';
    return `<figure class="qfig"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.min(w, 360)}" role="img"${aria}>${body}</svg>${cap}</figure>`;
  }

  // ---- Unit 0 geometry figures, shared by the generators and the lessons ----
  const FIG = {
    // Straight line ABC with ray BD; theta is the angle DBC.
    line(theta, labABD, labDBC) {
      const B = { x: 150, y: 120 };
      return scene({ P: { A: { x: 20, y: 120 }, B, C: { x: 280, y: 120 }, D: GF.polar(B, 95, theta) },
        segs: ['AC', 'BD'], away: { B: { x: 150, y: 60 } },
        arcs: [labABD && ['ABD', labABD, { r: 16 }], labDBC && ['DBC', labDBC, { r: 22 }]].filter(Boolean) });
    },
    // Lines AB and CD cross at O; theta is the angle AOC (= BOD). Labels by number 1-4.
    cross(theta, lab = {}) {
      const O = { x: 150, y: 100 };
      const P = { A: GF.polar(O, 110, 180), B: GF.polar(O, 110, 0), C: GF.polar(O, 105, 180 + theta), D: GF.polar(O, 105, theta), O };
      const arcs = [];
      if (lab[1]) arcs.push(['BOD', lab[1], { r: 16 }]);
      if (lab[2]) arcs.push(['DOA', lab[2], { r: 16 }]);
      if (lab[3]) arcs.push(['AOC', lab[3], { r: 16 }]);
      if (lab[4]) arcs.push(['COB', lab[4], { r: 16 }]);
      return scene({ P, segs: ['AB', 'CD'], arcs, away: { O: { x: 150, y: 60 } } });
    },
    // AB ∥ CD with transversal EF cutting AB at G and CD at H. theta = angle EGB.
    parallel(theta, arcs = []) {
      const t = Math.tan(theta * Math.PI / 180);
      const dx = Math.abs(t) > 1e-6 ? 90 / t : 0;
      const G = { x: 160 + dx / 2, y: 50 }, H = { x: 160 - dx / 2, y: 140 };
      const P = { A: { x: 20, y: 50 }, B: { x: 300, y: 50 }, C: { x: 20, y: 140 }, D: { x: 300, y: 140 },
        G, H, E: GF.polar(G, 42, theta), F: GF.polar(H, 42, theta + 180) };
      return scene({ P, segs: ['AB', 'CD', 'EF'], arrows: [['AB', 1], ['CD', 1]], arcs,
        away: { G: { x: G.x + 20, y: 30 }, H: { x: H.x - 20, y: 160 }, A: { x: 40, y: 0 }, B: { x: 280, y: 0 }, C: { x: 40, y: 400 }, D: { x: 280, y: 400 } } });
    },
    // Triangle ABC on base BC with base angles b and c. opts.ext extends BC to D.
    tri(b, c, opts = {}) {
      const B = { x: 30, y: 150 }, C = { x: 230, y: 150 };
      const A = GF.apex(B, C, b, c);
      const P = { A, B, C };
      const segs = ['AB', 'BC', 'CA'];
      if (opts.ext) { P.D = { x: Math.max(C.x, A.x) + 70, y: 150 }; segs.push('CD'); }
      const names = opts.names || {};
      const ren = {};
      for (const k of Object.keys(P)) ren[names[k] || k] = P[k];
      const m = k => names[k] || k;
      const map = s => s.split('').map(m).join('');
      return scene({ P: ren, segs: segs.map(map), ticks: (opts.ticks || []).map(([s, n]) => [map(s), n]),
        arcs: (opts.arcs || []).map(([s, t, o]) => [map(s), t, o]), caption: opts.caption,
        away: opts.ext ? { [m('C')]: { x: C.x, y: 100 } } : undefined });
    },
    // D on BC with AB = AD and AD = DC; b is angle B.
    isoPair(b, lab = {}) {
      const B = { x: 20, y: 160 }, D = { x: 150, y: 160 };
      const A = GF.apex(B, D, b, b);
      const ad = Math.hypot(A.x - D.x, A.y - D.y);
      const C = { x: D.x + ad, y: 160 };
      return scene({ P: { A, B, D, C }, segs: ['AB', 'AD', 'AC', 'BC'], ticks: [['AB', 1], ['AD', 1], ['DC', 1]],
        arcs: [lab.B && ['ABD', lab.B, { r: 18 }], lab.C && ['ACD', lab.C, { r: 22 }]].filter(Boolean),
        away: { D: { x: D.x, y: 100 } } });
    },
    // Kite ABCD with AB = AD and CB = CD, diagonal AC.
    kite(opts = {}) {
      const P = { A: { x: 40, y: 110 }, B: { x: 130, y: 40 }, C: { x: 290, y: 110 }, D: { x: 130, y: 180 } };
      return scene({ P, segs: ['AB', 'BC', 'CD', 'DA', 'AC'], ticks: [['AB', 1], ['AD', 1], ['CB', 2], ['CD', 2]],
        arcs: opts.arcs || [] });
    },
    // AE and BD cross at C. opts.par draws AB ∥ DE arrows.
    bowtie(opts = {}) {
      const C = { x: 160, y: 110 };
      const P = { A: { x: 40, y: 40 }, B: { x: 40, y: 175 }, C, D: { x: 280, y: 45 }, E: { x: 280, y: 180 } };
      // Make it a true point reflection through C so the marked facts hold.
      P.D = { x: 2 * C.x - P.B.x, y: 2 * C.y - P.B.y };
      P.E = { x: 2 * C.x - P.A.x, y: 2 * C.y - P.A.y };
      return scene({ P, segs: ['AE', 'BD', 'AB', 'DE'], ticks: opts.ticks || [], arrows: opts.arrows || [],
        arcs: opts.arcs || [], away: { C: { x: 160, y: 60 } } });
    },
    // Isosceles ABC (AB = AC) with AD ⊥ BC.
    isoAltitude() {
      const B = { x: 30, y: 160 }, C = { x: 250, y: 160 };
      const A = GF.apex(B, C, 62, 62), D = { x: A.x, y: 160 };
      return scene({ P: { A, B, C, D }, segs: ['AB', 'AC', 'BC', 'AD'], ticks: [['AB', 1], ['AC', 1]], rights: ['ADB'],
        away: { D: { x: D.x, y: 100 } } });
    },
    // Parallelogram ABCD (A bottom-left, anticlockwise). opts.diag draws diagonals meeting at the named point.
    para(opts = {}) {
      const sk = opts.skew != null ? opts.skew : 60, w = opts.w || 190, h = opts.h || 110;
      const P = { A: { x: 30, y: 30 + h }, B: { x: 30 + w, y: 30 + h }, C: { x: 30 + w + sk, y: 30 }, D: { x: 30 + sk, y: 30 } };
      const segs = ['AB', 'BC', 'CD', 'DA'];
      if (opts.diag) { P[opts.diag] = GF.mid(P.A, P.C); segs.push('AC', 'BD'); }
      const nm = opts.names || {}, map = x => x.split('').map(k => nm[k] || k).join('');
      const ren = Object.fromEntries(Object.entries(P).map(([k, v]) => [nm[k] || k, v]));
      return scene({ P: ren, segs: segs.map(map),
        arrows: (opts.arrows || []).map(([x, n]) => [map(x), n]), ticks: (opts.ticks || []).map(([x, n]) => [map(x), n]),
        arcs: (opts.arcs || []).map(([x, t, o]) => [map(x), t, o]), rights: (opts.rights || []).map(map) });
    },
    // Rhombus ABCD with diagonals meeting at O.
    rhombus(opts = {}) {
      // t is the angle ABO, so AO = BO tan t.
      const O = { x: 160, y: 110 }, bo = 80, ao = bo * Math.tan((opts.t || 40) * Math.PI / 180);
      const P = { A: { x: O.x - ao, y: O.y }, B: { x: O.x, y: O.y - bo }, C: { x: O.x + ao, y: O.y }, D: { x: O.x, y: O.y + bo }, O };
      return scene({ P, segs: ['AB', 'BC', 'CD', 'DA', 'AC', 'BD'], ticks: [['AB', 1], ['BC', 1], ['CD', 1], ['DA', 1]],
        arcs: opts.arcs || [], rights: opts.rights || [], away: { O: { x: 175, y: 125 } } });
    },
    // Triangle with the midpoints of two sides joined.
    midpoint(opts = {}) {
      const n = opts.names || {}, m = k => n[k] || k;
      const B = { x: 30, y: 170 }, C = { x: 290, y: 170 }, A = { x: 120, y: 30 };
      const D = GF.mid(A, B), E = GF.mid(A, C);
      const P = { [m('A')]: A, [m('B')]: B, [m('C')]: C, [m('D')]: D, [m('E')]: E };
      const map = s => s.split('').map(m).join('');
      return scene({ P, segs: ['AB', 'AC', 'BC', 'DE'].map(map),
        ticks: opts.noTicks ? (opts.ticks || []).map(([s, k]) => [map(s), k]) : [['AD', 1], ['DB', 1], ['AE', 2], ['EC', 2]].map(([s, k]) => [map(s), k]),
        arrows: (opts.arrows || []).map(([s, k]) => [map(s), k]), arcs: (opts.arcs || []).map(([s, t, o]) => [map(s), t, o]) });
    },
  };

  // ---- Sequences ----
  function genSeqLinear(kp) {
    const k = wantKp(2, kp);
    const a = Rnz(-8, 12), d = Rnz(-6, 8);
    const Tn = n => a + (n - 1) * d;
    if (k === 0) {
      const terms = [1, 2, 3, 4].map(Tn);
      return { type: 'tuple', vals: [Tn(5), Tn(6)], ans: `${Tn(5)}; ${Tn(6)}`, ansTex: `${Tn(5)};\\,${Tn(6)}`,
        prompt: `The first four terms of a linear sequence are $${terms.join(',\\;')}$. Write the next two terms.`,
        hint: 'A linear sequence has a constant first difference $d$.',
        steps: [`$d=${terms[1]}-(${terms[0]})=${d}$.`, `Fifth term: $${terms[3]}+(${d})=${Tn(5)}$.`, `Sixth term: $${Tn(5)}+(${d})=${Tn(6)}$.`] };
    }
    if (k === 1) {
      return { type: 'expr', var: 'n', sample: [1, 8], ans: `${a}+(n-1)*(${d})`, ansTex: `${d === 1 ? 'n' : d === -1 ? '-n' : d + 'n'}${sg(a - d)}`.replace(/^\+/, ''),
        prompt: `A linear sequence has first term $T_1=${a}$ and common difference $d=${d}$. Find a formula for $T_n$.`,
        hint: '$T_n=a+(n-1)d$.',
        steps: [`$T_n=${a}+(n-1)(${d})$.`, `Expand: $T_n=${d}n${sg(a - d)}$.`] };
    }
    const n = R(8, 20);
    return { type: 'num', val: n, ans: String(n), ansTex: String(n),
      prompt: `In the linear sequence $T_n=${a}+(n-1)(${d})$, which term is equal to $${Tn(n)}$?`,
      hint: 'Solve $a+(n-1)d=T_n$ for $n$.',
      steps: [`$${a}+(n-1)(${d})=${Tn(n)}$.`, `(n-1)(${d})=${Tn(n) - a}.`, `$n-1=${n - 1}$, so $n=${n}$.`] };
  }

  function genSeqQuadratic(kp) {
    const k = wantKp(1, kp);
    const a = Rnz(-3, 4), b = Rnz(-5, 6), c = R(-8, 10);
    const T = n => a * n * n + b * n + c;
    const terms = [1, 2, 3, 4, 5].map(T);
    const d1 = terms[1] - terms[0], d2 = (terms[2] - terms[1]) - d1;
    if (k === 0) {
      return { type: 'num', val: d2, ans: String(d2), ansTex: String(d2),
        prompt: `The first five terms of a quadratic sequence are $${terms.join(',\\;')}$. What is the constant second difference?`,
        hint: 'First differences, then the differences of those. For $T_n=an^2+bn+c$ the second difference is $2a$.',
        steps: [`First differences: $${terms[1]}-(${terms[0]})=${d1}$, then ${terms[2] - terms[1]}, ${terms[3] - terms[2]}.`, `Second difference: $2a=${d2}$.`] };
    }
    return { type: 'expr', var: 'n', sample: [1, 8], ans: `${a}*n^2+(${b})*n+(${c})`, ansTex: poly([a, b, c], 'n'),
      prompt: `A quadratic sequence begins $${terms[0]},\\;${terms[1]},\\;${terms[2]},\\;${terms[3]}$. Find $T_n=an^2+bn+c$.`,
      hint: 'The second difference is $2a$. Then use $T_1$ and $T_2$ to find $b$ and $c$.',
      steps: [`Second difference $2a=${d2}$, so $a=${a}$.`, `$T_1=a+b+c=${terms[0]}$ and $T_2=4a+2b+c=${terms[1]}$.`, `Solving gives $b=${b}$, $c=${c}$. So $T_n=${poly([a, b, c], 'n')}$.`] };
  }

  function genSeqArithmetic(kp) {
    const k = wantKp(2, kp);
    const a = Rnz(-6, 12), d = Rnz(-5, 7), n = R(6, 15);
    const Tn = a + (n - 1) * d;
    const Sn = n / 2 * (2 * a + (n - 1) * d);
    if (k === 0) {
      return { type: 'num', val: Tn, ans: String(Tn), ansTex: String(Tn),
        prompt: `An arithmetic sequence has $T_1=${a}$ and common difference $d=${d}$. Find $T_{${n}}$.`,
        hint: '$T_n=a+(n-1)d$.',
        steps: [`$T_{${n}}=${a}+(${n}-1)(${d})=${Tn}$.`] };
    }
    if (k === 1) {
      return { type: 'num', val: Sn, ans: String(Sn), ansTex: String(Sn),
        prompt: `Find $S_{${n}}$ for the arithmetic series with $T_1=${a}$ and $d=${d}$.`,
        hint: '$S_n=\\frac{n}{2}\\big(2a+(n-1)d\\big)$.',
        steps: [`$S_{${n}}=\\frac{${n}}{2}\\big(2(${a})+(${n}-1)(${d})\\big)=${Sn}$.`] };
    }
    // given Sn, find n (choose so n is integer, already is)
    return { type: 'num', val: n, ans: String(n), ansTex: String(n),
      prompt: `An arithmetic series has $T_1=${a}$ and $d=${d}$. How many terms are needed for the sum to be $${Sn}$?`,
      hint: 'Solve $\\frac{n}{2}(2a+(n-1)d)=S$ as a quadratic in $n$. Keep the positive integer root.',
      steps: [`$\\frac{n}{2}\\big(${2 * a}+(n-1)(${d})\\big)=${Sn}$.`, `This quadratic in $n$ has the positive integer solution $n=${n}$.`] };
  }

  function genSeqGeometric(kp) {
    const k = wantKp(2, kp);
    const a = pick([1, 2, 3, 4, 5, -2, -3]), r = pick([2, 3, -2, 1 / 2, 1 / 3, -1 / 2]);
    const n = r === 2 || r === -2 || r === 3 ? R(4, 6) : R(4, 8);
    const Tn = a * Math.pow(r, n - 1);
    const Sn = r === 1 ? n * a : a * (1 - Math.pow(r, n)) / (1 - r);
    const rTex = r === 1 / 2 ? '\\frac{1}{2}' : r === 1 / 3 ? '\\frac{1}{3}' : r === -1 / 2 ? '-\\frac{1}{2}' : String(r);
    const rTxt = r === 1 / 2 ? '1/2' : r === 1 / 3 ? '1/3' : r === -1 / 2 ? '-1/2' : String(r);
    if (k === 0) {
      const v = Number.isInteger(Tn) ? { v: Tn, txt: String(Tn), tex: String(Tn) } :
        frac(Math.round(Tn * (r === 1 / 3 ? 3 ** (n - 1) : 2 ** (n - 1))), r === 1 / 3 ? 3 ** (n - 1) : 2 ** (n - 1));
      // recompute exact for half/third ratios
      let ans = String(Tn), ansTex = String(Tn), val = Tn;
      if (r === 1 / 2 || r === -1 / 2) {
        const den = 2 ** (n - 1), num = a * (r < 0 && (n - 1) % 2 ? -1 : 1);
        const f = frac(num, den); ans = f.txt; ansTex = f.tex; val = f.v;
      } else if (r === 1 / 3) {
        const f = frac(a, 3 ** (n - 1)); ans = f.txt; ansTex = f.tex; val = f.v;
      }
      return { type: 'num', exact: true, val, ans, ansTex,
        prompt: `A geometric sequence has $T_1=${a}$ and $r=${rTex}$. Find $T_{${n}}$.`,
        hint: '$T_n=ar^{n-1}$.',
        steps: [`$T_{${n}}=${a}\\cdot(${rTex})^{${n - 1}}=${ansTex}$.`] };
    }
    if (k === 1) {
      let val = Sn, ans = String(Sn), ansTex = String(Sn);
      if (Math.abs(Sn - Math.round(Sn)) < 1e-9) { val = Math.round(Sn); ans = String(val); ansTex = ans; }
      else {
        // leave as rounded only if messy — prefer exact via formula display and tol
        return { type: 'num', val: Sn, ans: String(r2(Sn)), ansTex: String(r2(Sn)), tol: 0.01,
          prompt: `Find $S_{${n}}$ for the geometric series with $T_1=${a}$ and $r=${rTex}$.`,
          hint: '$S_n=\\dfrac{a(1-r^n)}{1-r}$ for $r\\ne 1$.',
          steps: [`$S_{${n}}=\\dfrac{${a}\\big(1-(${rTex})^{${n}}\\big)}{1-(${rTex})}=${r2(Sn)}$.`] };
      }
      return { type: 'num', exact: true, val, ans, ansTex,
        prompt: `Find $S_{${n}}$ for the geometric series with $T_1=${a}$ and $r=${rTex}$.`,
        hint: '$S_n=\\dfrac{a(1-r^n)}{1-r}$ for $r\\ne 1$.',
        steps: [`$S_{${n}}=\\dfrac{${a}\\big(1-(${rTex})^{${n}}\\big)}{1-(${rTex})}=${ansTex}$.`] };
    }
    return { type: 'num', exact: true, val: r, ans: rTxt, ansTex: rTex,
      prompt: `A geometric sequence has $T_1=${a}$ and $T_3=${a * r * r}$. Find the common ratio $r$ (give the value with the same sign as $T_2$ if $T_2$ is $ ${a * r} $).`,
      hint: '$T_3=ar^2$. There may be two square roots; use the given $T_2$ to choose the sign.',
      steps: [`$ar^2=${a * r * r}$, so $r^2=${r * r}$ and $r=\\pm ${Math.abs(r) === 1 / 2 ? '\\frac{1}{2}' : Math.abs(r)}$.`, `Matching $T_2=${a * r}$ gives $r=${rTex}$.`] };
  }

  function genSeqInfinite(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const a = pick([1, 2, 3, 4, 8, 9]), rNum = pick([1, 1, 2, 3]), rDen = pick([2, 3, 4, 5]);
      if (rNum >= rDen) return genSeqInfinite(0);
      const f = frac(a * rDen, rDen - rNum); // a/(1-r) = a / ((d-n)/d) = a d/(d-n)
      return { type: 'num', exact: true, val: f.v, ans: f.txt, ansTex: f.tex,
        prompt: `Find $S_\\infty$ of the geometric series with $T_1=${a}$ and $r=\\frac{${rNum}}{${rDen}}$.`,
        hint: 'The series converges because $|r|<1$. $S_\\infty=\\dfrac{a}{1-r}$.',
        steps: [`$\\left|\\frac{${rNum}}{${rDen}}\\right|<1$, so the series converges.`, `$S_\\infty=\\dfrac{${a}}{1-\\frac{${rNum}}{${rDen}}}=\\dfrac{${a}}{\\frac{${rDen - rNum}}{${rDen}}}=${f.tex}$.`] };
    }
    const a = R(2, 9), r = pick([2, 3, -2, 3 / 2]);
    const rTex = r === 3 / 2 ? '\\frac{3}{2}' : String(r);
    return { type: 'mc', options: [
      { tex: 'The series diverges, because $|r|\\ge 1$.', ok: true },
      { tex: `$S_\\infty=\\dfrac{${a}}{1-(${rTex})}$.`, ok: false },
      { tex: 'The series converges to $0$.', ok: false },
      { tex: `$S_\\infty=${a}$.`, ok: false },
    ], prompt: `A geometric series has $T_1=${a}$ and $r=${rTex}$. What is true?`,
      hint: '$S_\\infty$ exists only when $|r|<1$.',
      steps: [`$|r|=${Math.abs(r)}\\ge 1$, so the infinite series diverges.`, 'There is no finite $S_\\infty$.'],
      ans: 'diverges', ansTex: '\\text{diverges}' };
  }

  function genSeqSumProof(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const n = R(5, 12), a = R(2, 9), d = R(2, 6);
      const Sn = n / 2 * (2 * a + (n - 1) * d);
      return { type: 'num', val: Sn, ans: String(Sn), ansTex: String(Sn),
        prompt: `The sum of an arithmetic series can be written $S_n=\\frac{n}{2}(T_1+T_n)$. Use it to find $S_{${n}}$ if $T_1=${a}$ and $d=${d}$.`,
        hint: 'First find $T_n=a+(n-1)d$, then average the first and last terms and multiply by $n$. This is the usual derivation of the formula.',
        steps: [`$T_{${n}}=${a}+(${n}-1)(${d})=${a + (n - 1) * d}$.`, `$S_{${n}}=\\frac{${n}}{2}\\big(${a}+${a + (n - 1) * d}\\big)=${Sn}$.`, 'This is the same as $\\frac{n}{2}\\big(2a+(n-1)d\\big)$.'] };
    }
    const a = pick([1, 2, 3]), r = 2, n = R(5, 8);
    const Sn = a * (1 - Math.pow(r, n)) / (1 - r);
    return { type: 'num', val: Sn, ans: String(Sn), ansTex: String(Sn),
      prompt: `Starting from $S_n-rS_n=a-ar^n$, find $S_{${n}}$ for $a=${a}$ and $r=${r}$.`,
      hint: 'Factor $S_n(1-r)$ and divide. This is the usual derivation of the geometric sum formula.',
      steps: [`$S_n-rS_n=a(1-r^n)$.`, `$S_n=\\dfrac{a(1-r^n)}{1-r}=\\dfrac{${a}(1-${r}^{${n}})}{1-${r}}=${Sn}$.`] };
  }

  function genSeqMixed(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const kind = pick(['arithmetic', 'geometric', 'quadratic']);
      let terms, ok, hint, steps;
      if (kind === 'arithmetic') {
        const a = R(2, 10), d = R(2, 5); terms = [0, 1, 2, 3].map(i => a + i * d);
        ok = 'arithmetic'; hint = 'Look at the first differences.';
        steps = [`Differences: ${d}, ${d}, ${d}. Constant first difference, so the sequence is arithmetic.`];
      } else if (kind === 'geometric') {
        const a = pick([2, 3, 4]), r = pick([2, 3]); terms = [0, 1, 2, 3].map(i => a * r ** i);
        ok = 'geometric'; hint = 'Look at the ratio of successive terms.';
        steps = [`Ratios: ${r}, ${r}, ${r}. Constant ratio, so the sequence is geometric.`];
      } else {
        const T = n => n * n + n + 1; terms = [1, 2, 3, 4].map(T);
        ok = 'quadratic'; hint = 'If first differences change, try second differences.';
        const d = [terms[1] - terms[0], terms[2] - terms[1], terms[3] - terms[2]];
        steps = [`First differences: ${d.join(', ')}. Second differences: ${d[1] - d[0]}, ${d[2] - d[1]}. Constant second difference, so the sequence is quadratic.`];
      }
      const opts = ['arithmetic', 'geometric', 'quadratic', 'neither'].map(t => ({ tex: t, ok: t === ok }));
      return { type: 'mc', options: opts, prompt: `Classify the sequence $${terms.join(',\\;')},\\;\\dots$`, hint, steps, ans: ok, ansTex: ok };
    }
    // mixed: arithmetic of even terms or a concrete calculation
    const a = 2, d = 3, n = 8, Sn = n / 2 * (2 * a + (n - 1) * d);
    return { type: 'num', val: Sn, ans: String(Sn), ansTex: String(Sn),
      prompt: `The first $n$ terms of $2,\\,5,\\,8,\\,\\dots$ are added. Find $S_8$.`,
      hint: 'This is arithmetic with $a=2$, $d=3$.',
      steps: [`$S_8=\\frac{8}{2}\\big(2\\cdot 2+7\\cdot 3\\big)=${Sn}$.`] };
  }

  // ---- Algebra CAPS-only ----
  function genQuadK(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      // (x + 1/x)^2 = x^2 + 2 + 1/x^2, given x+1/x = m
      const m = Rnz(3, 7);
      const val = m * m - 2;
      return { type: 'num', val, ans: String(val), ansTex: String(val),
        prompt: `If $x+\\dfrac{1}{x}=${m}$ and $x\\ne 0$, find $x^2+\\dfrac{1}{x^2}$.`,
        hint: 'Square both sides: $\\left(x+\\frac{1}{x}\\right)^2=x^2+2+\\frac{1}{x^2}$.',
        steps: [`$\\left(x+\\frac{1}{x}\\right)^2=${m}^2=${m * m}$.`, `$x^2+2+\\frac{1}{x^2}=${m * m}$, so $x^2+\\frac{1}{x^2}=${val}$.`] };
    }
    const m = R(2, 6);
    // solve x + 1/x = m → x^2 - m x + 1 = 0, product 1, sum m
    const D = m * m - 4;
    return { type: 'set', exact: true, vals: [(m + Math.sqrt(D)) / 2, (m - Math.sqrt(D)) / 2],
      ans: `(${m}+sqrt(${D}))/2, (${m}-sqrt(${D}))/2`,
      ansTex: `x=\\dfrac{${m}\\pm\\sqrt{${D}}}{2}`,
      prompt: `Solve for $x$ if $x+\\dfrac{1}{x}=${m}$ and $x\\ne 0$.`,
      hint: 'Multiply through by $x$ to get a quadratic.',
      steps: [`$x^2+1=${m}x$, so $x^2-${m}x+1=0$.`, `$x=\\dfrac{${m}\\pm\\sqrt{${D}}}{2}$.`] };
  }

  function genNatureOfRoots(kp) {
    const k = wantKp(2, kp);
    if (k === 0) {
      const a = pick([1, 2, 1, 3]), b = Rnz(-8, 8), c = Rnz(-8, 8);
      const D = b * b - 4 * a * c;
      const nature = D > 0 ? 'two distinct real roots' : D === 0 ? 'one real repeated root' : 'no real roots';
      return { type: 'mc', options: [
        { tex: 'two distinct real roots', ok: D > 0 },
        { tex: 'one real repeated root', ok: D === 0 },
        { tex: 'no real roots', ok: D < 0 },
        { tex: 'infinitely many real roots', ok: false },
      ], prompt: `Describe the roots of $${poly([a, b, c])}=0$.`,
        hint: 'Compute the discriminant $\\Delta=b^2-4ac$.',
        steps: [`$\\Delta=${b}^2-4(${a})(${c})=${D}$.`, D > 0 ? '$\\Delta>0$: two distinct real roots.' : D === 0 ? '$\\Delta=0$: one real repeated root.' : '$\\Delta<0$: no real roots.'],
        ans: nature, ansTex: nature };
    }
    if (k === 1) {
      const m = R(3, 9);
      return { type: 'num', val: m * m, ans: String(m * m), ansTex: String(m * m),
        prompt: `Find the value of $t$ for which $x^2-${2 * m}x+t=0$ has equal roots.`,
        hint: 'Equal roots when $\\Delta=0$.',
        steps: [`$\\Delta=(${2 * m})^2-4(1)(t)=${4 * m * m}-4t$.`, `$\\Delta=0\\Rightarrow t=${m * m}$.`] };
    }
    const m = R(2, 6);
    return { type: 'region', var: 't', alts: [[{ lo: -Infinity, hi: m * m, li: false, hi_: false }]],
      ans: `t < ${m * m}`, ansTex: `t<${m * m}`,
      prompt: `Find all $t$ for which $x^2+${2 * m}x+t=0$ has two distinct real roots.`,
      hint: '$\\Delta>0$.',
      steps: [`$\\Delta=${(2 * m) ** 2}-4t=${4 * m * m}-4t$.`, `$\\Delta>0\\Rightarrow t<${m * m}$.`] };
  }

  function genSimultaneousNonlinear(kp) {
    const k = wantKp(1, kp);
    // line y = mx+c and parabola y = x^2 + px + q, choose intersection points
    const x1 = Rnz(-4, -1), x2 = R(1, 4);
    const m = Rnz(-3, 3), c = R(-6, 6);
    const y1 = m * x1 + c, y2 = m * x2 + c;
    // y = a x^2 + b x + d passing through both - use y = (x-x1)(x-x2) + line
    // simpler: x^2 = y, and y = mx+c → x^2 - m x - c = 0 with known roots
    if (k === 0) {
      const A = 1, B = -(x1 + x2), C = x1 * x2; // (x-x1)(x-x2)=0 from x^2 + Bx + C = y? 
      // System: y = x^2, y = m x + k with intersections x1,x2
      // x^2 = m x + k, so k = x1^2 - m x1, and x2 must satisfy. Set m so both work only if they're on same line.
      const mm = (x2 * x2 - x1 * x1) / (x2 - x1); // = x1+x2
      const kk = x1 * x1 - mm * x1;
      return { type: 'points', vars: ['x', 'y'],
        // Need to know points format
        pts: [[String(x1), String(x1 * x1)], [String(x2), String(x2 * x2)]], names: ['x', 'y'],
        ans: `(${x1}; ${x1 * x1}), (${x2}; ${x2 * x2})`,
        ansTex: `(${x1};\\,${x1 * x1}),\\;(${x2};\\,${x2 * x2})`,
        prompt: `Solve the system $$y=x^2,\\qquad y=${mm}x${sg(kk)}.$$`,
        hint: 'Substitute $y$ from the line into the parabola and factor the quadratic.',
        steps: [`$x^2=${mm}x${sg(kk)}$, so $x^2-${mm}x${sg(-kk)}=0$.`, `$(x-(${x1}))(x-(${x2}))=0$.`, `Points: $(${x1};\\,${x1 * x1})$ and $(${x2};\\,${x2 * x2})$.`] };
    }
    // product or sum of roots style: y=x^2+c and line
    const p = R(1, 5), q = R(1, 6);
    // x^2 + y^2 = r^2 and y = something simple? Keep line and circle later. Here: x+y=s, xy=p
    const s = p + q, prod = p * q;
    return { type: 'set', exact: true, vals: [p, q], ans: `${p}, ${q}`, ansTex: `x=${p},\\;y=${q}` ,
      prompt: `Solve for the pair $(x,y)$ if $x+y=${s}$ and $xy=${prod}$, with $x\\le y$. Give the two values $x$ and $y$.`,
      hint: '$x$ and $y$ are roots of $t^2-(x+y)t+xy=0$.',
      steps: [`$t^2-${s}t+${prod}=0=(t-${p})(t-${q})$.`, `$x=${p}$, $y=${q}$ (since $x\\le y$).`] };
  }

  // I'll fix nature-of-roots k===0 options and region/points types after looking at checkRegion/checkPoints.

  // ---- Finance ----
  function genGrowthDecay(kp) {
    const k = wantKp(2, kp);
    const P = pick([2000, 2500, 3000, 4000, 5000, 8000]);
    const i = pick([6, 8, 10, 12]) / 100;
    const n = pick([2, 3, 4, 5]);
    if (k === 0) {
      const A = P * (1 + i * n);
      return { type: 'num', val: A, ans: String(r2(A)), ansTex: money(A), tol: 0.01,
        prompt: `R${P} is invested at $${r2(i * 100)}\\%$ per annum simple interest for $${n}$ years. Find the accumulated amount.`,
        hint: '$A=P(1+in)$.',
        steps: [`$A=${P}\\big(1+${r2(i)}\\cdot${n}\\big)=${money(A)}$.`] };
    }
    if (k === 1) {
      const A = P * Math.pow(1 + i, n);
      return { type: 'num', val: A, ans: String(r2(A)), ansTex: money(A), tol: 0.05,
        prompt: `R${P} is invested at $${r2(i * 100)}\\%$ per annum compounded annually for $${n}$ years. Find the accumulated amount.`,
        hint: '$A=P(1+i)^n$.',
        steps: [`$A=${P}(1+${r2(i)})^{${n}}=${money(A)}$.`] };
    }
    const A = P * Math.pow(1 - i, n);
    return { type: 'num', val: A, ans: String(r2(A)), ansTex: money(A), tol: 0.05,
      prompt: `An asset bought for R${P} depreciates at $${r2(i * 100)}\\%$ per annum on the reducing-balance method for $${n}$ years. Find its book value.`,
      hint: '$A=P(1-i)^n$.',
      steps: [`$A=${P}(1-${r2(i)})^{${n}}=${money(A)}$.`] };
  }

  function genNominalEffective(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const nom = pick([8.4, 9.6, 12, 10.8]);
      const m = pick([4, 12]);
      const i = nom / 100 / m;
      const eff = (Math.pow(1 + i, m) - 1) * 100;
      return { type: 'num', val: eff, ans: String(r2(eff)), ansTex: r2(eff) + '\\%', tol: 0.02,
        prompt: `Convert a nominal rate of $${nom}\\%$ per annum compounded ${m === 12 ? 'monthly' : 'quarterly'} to an effective annual rate. Give the percentage, rounded to two decimal places.`,
        hint: '$1+i_{\\mathrm{eff}}=\\left(1+\\frac{i_{\\mathrm{nom}}}{m}\\right)^m$.',
        steps: [`$i_{\\mathrm{eff}}=\\left(1+\\frac{${nom / 100}}{${m}}\\right)^{${m}}-1$.`, `As a percentage: $${r2(eff)}\\%$.`] };
    }
    const eff = pick([10, 12, 8]);
    const m = 12;
    // (1+i/m)^m = 1+eff, i = m*((1+eff)^(1/m)-1)
    const nom = m * (Math.pow(1 + eff / 100, 1 / m) - 1) * 100;
    return { type: 'num', val: nom, ans: String(r2(nom)), ansTex: r2(nom) + '\\%', tol: 0.02,
      prompt: `An effective annual rate of $${eff}\\%$ is equivalent to what nominal rate per annum compounded monthly? Round to two decimal places.`,
      hint: 'Solve $\\left(1+\\frac{i_{\\mathrm{nom}}}{12}\\right)^{12}=1+i_{\\mathrm{eff}}$ for $i_{\\mathrm{nom}}$.',
      steps: [`$1+\\frac{i}{12}=(1.0${eff})^{1/12}$.`, `$i=${r2(nom)}\\%$.`] };
  }

  function genAnnuityFv(kp) {
    const k = wantKp(1, kp);
    const x = pick([500, 800, 1000, 1200]), i = pick([0.08, 0.1, 0.12]), n = pick([4, 5, 6]);
    const F = x * (Math.pow(1 + i, n) - 1) / i;
    if (k === 0) {
      return { type: 'num', val: F, ans: String(r2(F)), ansTex: money(F), tol: 0.1,
        prompt: `R${x} is deposited at the end of each year for $${n}$ years into an account that earns $${r2(i * 100)}\\%$ per annum compounded annually. Find the future value of the annuity.`,
        hint: '$F=x\\dfrac{(1+i)^n-1}{i}$.',
        steps: [`$F=${x}\\dfrac{(1+${r2(i)})^{${n}}-1}{${r2(i)}}=${money(F)}$.`] };
    }
    const target = Math.round(F / 50) * 50;
    // solve x from F = x * factor
    const factor = (Math.pow(1 + i, n) - 1) / i;
    const pay = target / factor;
    return { type: 'num', val: pay, ans: String(r2(pay)), ansTex: money(pay), tol: 0.1,
      prompt: `What equal annual payment, made at the end of each year for $${n}$ years, will grow to R${target} at $${r2(i * 100)}\\%$ per annum compounded annually?`,
      hint: 'Solve $F=x\\dfrac{(1+i)^n-1}{i}$ for $x$.',
      steps: [`$x=\\dfrac{${target}\\cdot ${r2(i)}}{(1+${r2(i)})^{${n}}-1}=${money(pay)}$.`] };
  }

  function genAnnuityPv(kp) {
    const k = wantKp(1, kp);
    const x = pick([800, 1000, 1500, 2000]), i = pick([0.08, 0.1, 0.12]), n = pick([4, 5, 6]);
    const P = x * (1 - Math.pow(1 + i, -n)) / i;
    if (k === 0) {
      return { type: 'num', val: P, ans: String(r2(P)), ansTex: money(P), tol: 0.1,
        prompt: `A loan is repaid by annual payments of R${x} at the end of each year for $${n}$ years. Interest is $${r2(i * 100)}\\%$ per annum compounded annually. Find the present value of the loan.`,
        hint: '$P=x\\dfrac{1-(1+i)^{-n}}{i}$.',
        steps: [`$P=${x}\\dfrac{1-(1+${r2(i)})^{-${n}}}{${r2(i)}}=${money(P)}$.`] };
    }
    // outstanding balance after k years: remaining n-k payments
    const paid = Math.min(2, n - 2);
    const bal = x * (1 - Math.pow(1 + i, -(n - paid))) / i;
    return { type: 'num', val: bal, ans: String(r2(bal)), ansTex: money(bal), tol: 0.1,
      prompt: `A loan is repaid by annual payments of R${x} for $${n}$ years at $${r2(i * 100)}\\%$ per annum compounded annually. Find the outstanding balance immediately after the $${paid}$th payment.`,
      hint: 'The balance equals the present value of the remaining ${n - paid} payments.',
      steps: [`${n - paid} payments remain.`, `$B=${x}\\dfrac{1-(1+${r2(i)})^{-${n - paid}}}{${r2(i)}}=${money(bal)}$.`] };
  }

  function genFinanceN(kp) {
    const k = wantKp(1, kp);
    const P = pick([2000, 4000, 5000]), i = pick([0.08, 0.1]), n = pick([3, 4, 5, 6]);
    if (k === 0) {
      const A = Math.round(P * Math.pow(1 + i, n));
      // n = log(A/P)/log(1+i) should be very close to n
      const nCalc = Math.log(A / P) / Math.log(1 + i);
      return { type: 'num', val: n, ans: String(n), ansTex: String(n), tol: 0.15,
        prompt: `R${P} grows to R${A} at $${r2(i * 100)}\\%$ per annum compounded annually. How many years does this take? Give $n$ as a whole number.`,
        hint: 'Solve $A=P(1+i)^n$ using logarithms: $n=\\log(A/P)/\\log(1+i)$.',
        steps: [`$n=\\dfrac{\\log(${A}/${P})}{\\log(1+${r2(i)})}\\approx${r2(nCalc)}$.`, `So $n=${n}$ years.`] };
    }
    const A1 = P * Math.pow(1.08, 4), A2 = P * (1 + 0.1 * 4);
    const better = A1 > A2 ? 'compound 8%' : 'simple 10%';
    return { type: 'mc', options: [
      { tex: `Compound interest at $8\\%$ for 4 years, amount ${money(A1)}`, ok: A1 > A2 },
      { tex: `Simple interest at $10\\%$ for 4 years, amount ${money(A2)}`, ok: A2 > A1 },
      { tex: 'The two amounts are always equal', ok: false },
      { tex: 'Simple interest is always better if the rate is higher', ok: false },
    ], prompt: `R${P} can be invested for $4$ years at $8\\%$ compounded annually, or at $10\\%$ simple interest. Which option gives the larger amount?`,
      hint: 'Compute both accumulated amounts and compare.',
      steps: [`Compound: $${P}(1.08)^4=${money(A1)}$.`, `Simple: $${P}(1+0.1\\cdot 4)=${money(A2)}$.`, `The larger is ${money(Math.max(A1, A2))}.`],
      ans: better, ansTex: better };
  }

  // ---- Functions / graphs ----
  function genHyperbola(kp) {
    const k = wantKp(1, kp);
    const a = pick([1, 2, -1, -2, 3]), p = Rnz(-4, 4), q = Rnz(-4, 4);
    if (k === 0) {
      return { type: 'fields', fields: [
        { label: 'p', name: 'p', ans: p },
        { label: 'q', name: 'q', ans: q },
      ], prompt: `The hyperbola $y=\\dfrac{${a}}{x${sg(p)}}${sg(q)}$ has vertical asymptote $x=-p$ and horizontal asymptote $y=q$. State $p$ and $q$.`,
        hint: 'The vertical asymptote is $x=-p$; the horizontal is $y=q$.',
        steps: [`Vertical: $x=${-p}$, so $p=${p}$.`, `Horizontal: $y=${q}$.`],
        ans: `${p}, ${q}`, ansTex: `p=${p},\\;q=${q}` };
    }
    const xInt = a / p !== 0 && p !== 0 ? frac(-a - q * p, q) : null;
    // x-intercept: 0 = a/(x+p)+q => a/(x+p)=-q => x+p = a/(-q) if q!==0
    if (q === 0) {
      return { type: 'mc', options: [
        { tex: 'There is no $x$-intercept (the graph never crosses the $x$-axis).', ok: true },
        { tex: `The $x$-intercept is $x=${-p}$.`, ok: false },
        { tex: 'The $x$-intercept is $x=0$.', ok: false },
        { tex: `The $y$-intercept is $y=${a}$.`, ok: false },
      ], prompt: `For $y=\\dfrac{${a}}{x${sg(p)}}$, which statement is true?`,
        hint: 'If $q=0$, $y=0$ would require $a=0$.',
        steps: ['$y=0$ would need the numerator to be $0$, but $a\\ne 0$. There is no $x$-intercept.'],
        ans: 'no x-intercept', ansTex: '\\text{no }x\\text{-intercept}' };
    }
    const xi = frac(-a - q * p, q); // 0=a/(x+p)+q => a = -q(x+p) => x = -a/q - p
    return { type: 'num', exact: true, val: xi.v, ans: xi.txt, ansTex: xi.tex,
      prompt: `Find the $x$-intercept of $y=\\dfrac{${a}}{x${sg(p)}}${sg(q)}$.`,
      hint: 'Set $y=0$ and solve for $x$.',
      steps: [`$0=\\dfrac{${a}}{x${sg(p)}}${sg(q)}$, so $\\dfrac{${a}}{x${sg(p)}}=${-q}$.`, `$x=${xi.tex}$.`] };
  }

  function genExpGraph(kp) {
    const k = wantKp(1, kp);
    const a = pick([2, 3, 1 / 2]), q = Rnz(-3, 3);
    const aTex = a === 1 / 2 ? '\\frac{1}{2}' : String(a);
    if (k === 0) {
      return { type: 'num', val: q, ans: String(q), ansTex: String(q),
        prompt: `The graph of $y=${aTex}^{x}${sg(q)}$ has a horizontal asymptote $y=\\dots$. State that value.`,
        hint: 'As $x\\to\\pm\\infty$, an exponential $a^x$ approaches $0$ on one side, so the asymptote is $y=q$.',
        steps: [`$y=${aTex}^{x}+(${q})$ approaches $y=${q}$.`] };
    }
    const yInt = 1 + q;
    return { type: 'num', val: yInt, ans: String(yInt), ansTex: String(yInt),
      prompt: `Find the $y$-intercept of $y=${aTex}^{x}${sg(q)}$.`,
      hint: 'Set $x=0$. $a^0=1$.',
      steps: [`$y=${aTex}^{0}${sg(q)}=1${sg(q)}=${yInt}$.`] };
  }

  function genLogGraph(kp) {
    const k = wantKp(1, kp);
    const a = pick([2, 3, 10]), q = R(-3, 3), p = Rnz(-3, 3);
    if (k === 0) {
      return { type: 'num', val: p, ans: String(p), ansTex: `x=${p}`,
        prompt: `The graph of $y=\\log_{${a}}(x${sg(-p)})${q ? sg(q) : ''} has a vertical asymptote. State its equation as the $x$-value of the asymptote.`,
        hint: 'The argument of the log is zero on the vertical asymptote: $x-p=0$.',
        steps: [`$x-${p}=0$, so $x=${p}$.`] };
    }
    // x-intercept: 0 = log_a(x-p)+q => log_a(x-p)=-q => x-p = a^{-q}
    const arg = Math.pow(a, -q);
    const xInt = arg + p;
    return { type: 'num', val: xInt, ans: String(xInt), ansTex: String(xInt), exact: arg === Math.round(arg),
      tol: 0.01,
      prompt: `Find the $x$-intercept of $y=\\log_{${a}}(x${sg(-p)})${q ? sg(q) : ''}.`,
      hint: 'Set $y=0$ and rewrite in exponential form.',
      steps: [`$\\log_{${a}}(x${sg(-p)})=${-q}$, so $x${sg(-p)}=${a}^{${-q}}=${arg}$.`, `$x=${xInt}$.`] };
  }

  function genCubicGraph(kp) {
    const k = wantKp(1, kp);
    const r1 = Rnz(-4, -1), r2 = 0, r3 = R(1, 4);
    // y = (x-r1)x(x-r3) = x^3 - (r1+r3)x^2 + r1 r3 x
    if (k === 0) {
      return { type: 'set', exact: true, vals: [r1, r2, r3], ans: `${r1}, 0, ${r3}`, ansTex: `x=${r1},\\;0,\\;${r3}`,
        prompt: `Find the $x$-intercepts of $y=(x${sg(-r1)})x(x${sg(-r3)})$.`,
        hint: 'A product is zero when one of the factors is zero.',
        steps: [`$x=${r1}$, $x=0$ or $x=${r3}$.`] };
    }
    const yInt = 0; // has x factor
    const lead = 1;
    return { type: 'mc', options: [
      { tex: 'The graph cuts the $x$-axis at three points and passes through the origin.', ok: true },
      { tex: 'The graph never cuts the $x$-axis.', ok: false },
      { tex: 'The graph is a parabola.', ok: false },
      { tex: `There is a horizontal asymptote $y=0$.`, ok: false },
    ], prompt: `Which statement is true of $y=(x${sg(-r1)})x(x${sg(-r3)})$?`,
      hint: 'A cubic of this form has three real intercepts and no asymptotes.',
      steps: [`Intercepts $x=${r1},\\,0,\\,${r3}$. It is a cubic, not a parabola, and polynomials have no horizontal asymptotes.`],
      ans: 'three intercepts through origin', ansTex: '\\text{three intercepts}' };
  }

  // ---- Calculus ----
  function genAvgGradient(kp) {
    const k = wantKp(1, kp);
    const a = Rnz(-3, 4), b = Rnz(-5, 5), c = R(-6, 6);
    const f = x => a * x * x + b * x + c;
    const x1 = R(-3, 1), x2 = x1 + R(1, 3);
    const g = (f(x2) - f(x1)) / (x2 - x1);
    if (k === 0) {
      return { type: 'num', exact: true, val: g, ans: String(g), ansTex: String(g),
        prompt: `Find the average gradient of $f(x)=${poly([a, b, c])}$ between $x=${x1}$ and $x=${x2}$.`,
        hint: 'Average gradient is $\\dfrac{f(x_2)-f(x_1)}{x_2-x_1}$.',
        steps: [`$f(${x1})=${f(x1)}$, $f(${x2})=${f(x2)}$.`, `$\\dfrac{${f(x2)}-(${f(x1)})}{${x2 - x1}}=${g}$.`] };
    }
    // limit of average gradient as h->0 for f=x^2 at x=2 is 4
    const x0 = R(1, 5);
    return { type: 'num', val: 2 * a * x0 + b, ans: String(2 * a * x0 + b), ansTex: String(2 * a * x0 + b),
      prompt: `For $f(x)=${poly([a, b, c])}$, the average gradient from $x=${x0}$ to $x=${x0}+h$ approaches which number as $h\\to 0$?`,
      hint: `This limit is $f'(${x0})$. For a quadratic, $f'(x)=${2 * a}x${sg(b)}$.`,
      steps: [`$\\dfrac{f(${x0}+h)-f(${x0})}{h}\\to f'(${x0})=${2 * a}(${x0})${sg(b)}=${2 * a * x0 + b}$.`] };
  }

  function genFirstPrinciples(kp) {
    const k = wantKp(2, kp);
    if (k === 0) {
      const a = Rnz(1, 5), x0 = R(-4, 4);
      const fp = 2 * a * x0;
      return { type: 'num', val: fp, ans: String(fp), ansTex: String(fp),
        prompt: `Use first principles to find $f'(${x0})$ if $f(x)=${a === 1 ? '' : a}x^2$.`,
        hint: "$f'(x)=\\lim_{h\\to 0}\\dfrac{f(x+h)-f(x)}{h}$. Expand the numerator and then let $h\\to 0$.",
        steps: [`$f(${x0}+h)-f(${x0})=${a}(${x0}+h)^2-${a}(${x0})^2=${a}(2(${x0})h+h^2)$.`, `$\\dfrac{f(${x0}+h)-f(${x0})}{h}=${2 * a * x0}+${a}h\\to ${fp}$ as $h\\to 0$.`] };
    }
    if (k === 1) {
      const a = pick([1, 2]), x0 = R(1, 3);
      const fp = 3 * a * x0 * x0;
      const coef = a === 1 ? '' : String(a);
      return { type: 'num', val: fp, ans: String(fp), ansTex: String(fp),
        prompt: `Use first principles to find $f'(${x0})$ if $f(x)=${coef}x^3$.`,
        hint: 'Expand $(x+h)^3=x^3+3x^2h+3xh^2+h^3$.',
        steps: [`$f(${x0}+h)-f(${x0})=${a}\\big(3(${x0})^2h+3(${x0})h^2+h^3\\big)$.`, `Divide by $h$ and let $h\\to 0$: $f'(${x0})=${fp}$.`] };
    }
    const x0 = pick([1, 2, 1 / 2]);
    const fp = -1 / (x0 * x0);
    const xTex = x0 === 1 / 2 ? '\\frac{1}{2}' : String(x0);
    const f = frac(-1, x0 === 1 / 2 ? 1 : x0 * x0); // for 1/2, -1/(1/4)=-4
    const val = fp;
    const ans = x0 === 1 / 2 ? '-4' : frac(-1, x0 * x0).txt;
    const ansTex = x0 === 1 / 2 ? '-4' : frac(-1, x0 * x0).tex;
    return { type: 'num', exact: true, val, ans, ansTex,
      prompt: `Use first principles to find $f'\\left(${xTex}\\right)$ if $f(x)=\\dfrac{1}{x}$.`,
      hint: '$f(x+h)-f(x)=\\dfrac{1}{x+h}-\\dfrac{1}{x}=\\dfrac{-h}{x(x+h)}$.',
      steps: [`$\\dfrac{f(x+h)-f(x)}{h}=\\dfrac{-1}{x(x+h)}\\to -\\dfrac{1}{x^2}$ as $h\\to 0$.`, `$f'\\left(${xTex}\\right)=${ansTex}$.`] };
  }

  function genPowerRule(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const a = Rnz(-4, 5), n = R(2, 6), b = Rnz(-5, 5);
      const deriv = Array(n).fill(0);
      deriv[0] = a * n;
      deriv[n - 1] = b;
      return { type: 'expr', var: 'x', sample: [0.5, 2.5], ans: `${a * n}*x^${n - 1}+(${b})`,
        ansTex: poly(deriv),
        prompt: `Differentiate $f(x)=${a}x^{${n}}${sg(b)}x$.`,
        hint: "If $f(x)=ax^n$ then $f'(x)=anx^{n-1}$.",
        steps: [`$f'(x)=${poly(deriv)}$.`] };
    }
    // rewrite root or 1/x^n
    const n = pick([2, 3, 4]);
    return { type: 'expr', var: 'x', sample: [1, 3], ans: `${-n}*x^${-n - 1}`,
      ansTex: `-${n}x^{-${n + 1}}`,
      prompt: `Differentiate $f(x)=\\dfrac{1}{x^{${n}}}$ after rewriting it as a power.`,
      hint: '$x^{-n}$ differentiates to $-n x^{-n-1}$.',
      steps: [`$f(x)=x^{-${n}}$.`, `$f'(x)=-${n}x^{-${n + 1}}$.`] };
  }

  function genTangentCalc(kp) {
    const k = wantKp(1, kp);
    const a = pick([1, 2, -1]), b = Rnz(-4, 4), c = R(-6, 6), x0 = R(-3, 3);
    // f = a x^2 + b x + c, f' = 2a x + b, tangent: y - f(x0) = f'(x0)(x-x0)
    const fp = 2 * a * x0 + b, y0 = a * x0 * x0 + b * x0 + c;
    if (k === 0) {
      // ask gradient of tangent
      return { type: 'num', val: fp, ans: String(fp), ansTex: String(fp),
        prompt: `Find the gradient of the tangent to $f(x)=${poly([a, b, c])}$ at $x=${x0}$.`,
        hint: "The gradient is $f'(a)$ at $x=a$.",
        steps: [`$f'(x)=${2 * a}x${sg(b)}$.`, `$f'(${x0})=${fp}$.`] };
    }
    // y-intercept of the tangent line: y = fp x + q, q = y0 - fp x0
    const q = y0 - fp * x0;
    return { type: 'eqn', lhs: 'y', rhs: `${fp}*x+(${q})`, vars: ['x', 'y'],
      ans: `y=${fp}x${sg(q)}`, ansTex: `y=${fp}x${sg(q)}`,
      prompt: `Find the equation of the tangent to $f(x)=${poly([a, b, c])}$ at $x=${x0}$.`,
      hint: 'A point on the tangent is $(a,f(a))$, and the gradient is $f\'(a)$.',
      steps: [`$f(${x0})=${y0}$, $f'(${x0})=${fp}$.`, `$y-${y0}=${fp}(x-${x0})$, so $y=${fp}x${sg(q)}$.`] };
  }

  function genCubicDerivative(kp) {
    const k = wantKp(1, kp);
    // f = x^3 + p x^2 + q x, choose turning points at integers
    const r = Rnz(-3, -1), s = R(1, 4);
    // f' = 3(x-r)(x-s) = 3(x^2-(r+s)x+rs), f = x^3 - 3(r+s)/2? Wait
    // f' = 3x^2 - 3(r+s)x + 3rs, f = x^3 - (3/2)(r+s)x^2 + 3rs x  -- half integer if r+s odd
    // pick r,s same parity so r+s even
    const r2 = R(-3, 0), s2 = r2 + 2 * R(1, 3);
    const A = -(3 / 2) * (r2 + s2); // may be int
    if (Math.abs(A - Math.round(A)) > 1e-9) return genCubicDerivative(kp);
    const B = 3 * r2 * s2;
    const ftex = poly([1, A, B, 0]);
    if (k === 0) {
      return { type: 'set', exact: true, vals: [r2, s2], ans: `${r2}, ${s2}`, ansTex: `x=${r2},\\;x=${s2}`,
        prompt: `Find the $x$-values of the stationary points of $f(x)=${ftex}$.`,
        hint: 'Solve $f\'(x)=0$.',
        steps: [`$f'(x)=3x^2${sg(2 * A)}x${sg(B)}$.`, `$f'(x)=3(x-(${r2}))(x-(${s2}))=0$, so $x=${r2}$ or $x=${s2}$.`] };
    }
    // nature at the left turning point: second derivative 6x + 2A, or first derivative sign
    const f2left = 6 * r2 + 2 * A;
    const nature = f2left > 0 ? 'local minimum' : 'local maximum';
    return { type: 'mc', options: [
      { tex: `A local maximum at $x=${r2}$`, ok: nature === 'local maximum' },
      { tex: `A local minimum at $x=${r2}$`, ok: nature === 'local minimum' },
      { tex: `A point of inflection only, not stationary, at $x=${r2}$`, ok: false },
      { tex: `No stationary point at $x=${r2}$`, ok: false },
    ], prompt: `For $f(x)=${ftex}$, what happens at $x=${r2}$?`,
      hint: "$f''(x)$ (or a sign chart of $f'$) tells a local max from a local min.",
      steps: [`$f''(x)=6x${sg(2 * A)}$, so $f''(${r2})=${f2left}$.`, f2left > 0 ? 'Positive: local minimum.' : 'Negative: local maximum.'],
      ans: nature, ansTex: nature };
  }

  function genDerivativeGraph(kp) {
    const k = wantKp(1, kp);
    const a = R(1, 4);
    // f(x)=(x-a)^2 = x^2 - 2a x + a^2, f' = 2x-2a, zero at a, negative left, positive right
    if (k === 0) {
      return { type: 'num', val: a, ans: String(a), ansTex: String(a),
        prompt: `$f(x)=(x-${a})^2$. Where does the graph of $y=f'(x)$ cut the $x$-axis?`,
        hint: "$f'(x)=2(x-a)$.",
        steps: [`$f'(x)=2x-${2 * a}$.`, `$f'(x)=0$ at $x=${a}$.`] };
    }
    return { type: 'mc', options: [
      { tex: `$f'(x)<0$ for $x<${a}$ and $f'(x)>0$ for $x>${a}$`, ok: true },
      { tex: `$f'(x)>0$ for all $x$`, ok: false },
      { tex: `$f'(x)<0$ for all $x\\ne ${a}$`, ok: false },
      { tex: `$f'(x)$ is a horizontal line`, ok: false },
    ], prompt: `For $f(x)=(x-${a})^2$, which statement about $f'$ is true?`,
      hint: 'A turning point that is a minimum has $f\'$ changing from negative to positive.',
      steps: [`$f'(x)=2(x-${a})$.`, `This is negative when $x<${a}$ and positive when $x>${a}$.`],
      ans: 'sign change - to +', ansTex: 'f\'\\text{ changes from }-\\text{ to }+' };
  }

  function genOptimisation(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const P = pick([20, 24, 32, 36, 40]);
      // rectangle perimeter P, max area A=x*(P/2-x), A'=P/2-2x=0, x=P/4, square, A=(P/4)^2
      const side = P / 4, A = side * side;
      return { type: 'num', val: A, ans: String(A), ansTex: String(A),
        prompt: `A rectangle has perimeter $${P}$. What is its maximum possible area?`,
        hint: 'Let one side be $x$. Then $A=x\\big(\\frac{P}{2}-x\\big)$. Differentiate and set $A\'=0$.',
        steps: [`$A=x\\big(${P / 2}-x\\big)$, $A'=${P / 2}-2x=0$, so $x=${side}$.`, `The maximum area is $${side}\\times${side}=${A}$.`] };
    }
    const lo = R(2, 5), hi = lo + R(6, 12);
    // open at x=lo and x=hi, wire? Number is split into two positives x+(s-x)=s, product max at half
    const s = lo + hi; // not used
    // A box from a 12cm square, corners x, volume x(12-2x)^2, messy.
    // Simpler: number = 20 = x+(20-x), product max 100
    const s2 = pick([10, 16, 20, 24]);
    const maxP = (s2 / 2) * (s2 / 2);
    return { type: 'num', val: maxP, ans: String(maxP), ansTex: String(maxP),
      prompt: `Two non-negative numbers add to $${s2}$. What is their maximum possible product?`,
      hint: 'Let the numbers be $x$ and $s-x$. Then $P=x(s-x)$. Set $P\'=0$.',
      steps: [`$P=x(${s2}-x)$, $P'=${s2}-2x=0$, so $x=${s2 / 2}$.`, `The maximum product is $${maxP}$.`] };
  }

  // ---- Probability / counting ----
  function genVenn(kp) {
    const k = wantKp(1, kp);
    const a = pick([0.3, 0.4, 0.5, 0.6]), b = pick([0.2, 0.3, 0.4, 0.5]), both = pick([0.1, 0.15, 0.2]);
    if (both >= Math.min(a, b) - 1e-9) return genVenn(kp);
    if (k === 0) {
      const u = a + b - both;
      return { type: 'num', val: u, ans: dec(u), ansTex: dec(u), exact: false, tol: 0.001,
        prompt: `If $P(A)=${a}$, $P(B)=${b}$ and $P(A\\cap B)=${both}$, find $P(A\\cup B)$.`,
        hint: '$P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$.',
        steps: [`$P(A\\cup B)=${a}+${b}-${both}=${r2(u)}$.`] };
    }
    const comp = r2(1 - a);
    return { type: 'num', val: comp, ans: String(comp), ansTex: String(comp), tol: 0.001,
      prompt: `If $P(A)=${a}$, find $P(A')$.`,
      hint: "$P(A')=1-P(A)$.",
      steps: [`$P(A')=1-${a}=${comp}$.`] };
  }

  function genDepIndep(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const a = pick([0.2, 0.25, 0.4, 0.5]), b = pick([0.2, 0.4, 0.5]);
      const p = a * b;
      return { type: 'num', val: p, ans: dec(p), ansTex: dec(p), tol: 0.001,
        prompt: `Events $A$ and $B$ are independent, with $P(A)=${a}$ and $P(B)=${b}$. Find $P(A\\cap B)$.`,
        hint: 'Independent events satisfy $P(A\\cap B)=P(A)P(B)$.',
        steps: [`$P(A\\cap B)=${a}\\times${b}=${r2(p)}$.`] };
    }
    // without replacement:  bag of R red and B blue, two draws, P both red
    const red = pick([3, 4, 5]), blue = pick([2, 3, 4, 5]), tot = red + blue;
    const p = (red / tot) * ((red - 1) / (tot - 1));
    const f = frac(red * (red - 1), tot * (tot - 1));
    return { type: 'num', exact: true, val: f.v, ans: f.txt, ansTex: f.tex,
      prompt: `A bag contains $${red}$ red and $${blue}$ blue balls. Two balls are drawn without replacement. Find the probability that both are red.`,
      hint: 'The second probability is a new fraction, because one red ball has already been removed.',
      steps: [`$P=\\dfrac{${red}}{${tot}}\\times\\dfrac{${red - 1}}{${tot - 1}}=${f.tex}$.`] };
  }

  function genTreesTables(kp) {
    const k = wantKp(1, kp);
    const p = pick([0.2, 0.3, 0.4]), q = pick([0.1, 0.2, 0.25]);
    // two stage: P(A)=p, then P(B|A)=q, find P(A and B)
    if (k === 0) {
      const v = p * q;
      return { type: 'num', val: v, ans: dec(v), ansTex: dec(v), tol: 0.001,
        prompt: `On a tree diagram, $P(A)=${p}$ and $P(B\\mid A)=${q}$. Find $P(A\\cap B)$.`,
        hint: 'Multiply along the branches: $P(A\\cap B)=P(A)\\,P(B\\mid A)$.',
        steps: [`$P(A\\cap B)=${p}\\times${q}=${r2(v)}$.`] };
    }
    // two-way table: 80 people, 30 like tea, 40 like coffee, 15 like both. P(tea only)
    const n = pick([80, 100, 60]), tea = pick([25, 30, 35]), coffee = pick([30, 40, 45]), both = pick([10, 12, 15]);
    if (both > tea || both > coffee || tea + coffee - both > n) return genTreesTables(kp);
    const teaOnly = tea - both;
    const f = frac(teaOnly, n);
    return { type: 'num', exact: true, val: f.v, ans: f.txt, ansTex: f.tex,
      prompt: `In a group of $${n}$ people, $${tea}$ like tea, $${coffee}$ like coffee and $${both}$ like both. A person is chosen at random. Find the probability that the person likes tea but not coffee.`,
      hint: 'Tea only is $n(\\text{tea})-n(\\text{both})$.',
      steps: [`Tea only: $${tea}-${both}=${teaOnly}$.`, `$P=\\dfrac{${teaOnly}}{${n}}=${f.tex}$.`] };
  }

  function genCounting(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const a = R(3, 6), b = R(2, 5);
      const v = a * b;
      return { type: 'num', val: v, ans: String(v), ansTex: String(v),
        prompt: `A menu has $${a}$ starters and $${b}$ mains. How many two-course meals (one starter and one main) are possible?`,
        hint: 'The fundamental counting principle: multiply the choices.',
        steps: [`$${a}\\times${b}=${v}$.`] };
    }
    const n = pick([4, 5, 6, 7]);
    let fact = 1; for (let i = 2; i <= n; i++) fact *= i;
    return { type: 'num', val: fact, ans: String(fact), ansTex: String(fact),
      prompt: `In how many orders can $${n}$ distinct books be arranged on a shelf?`,
      hint: '$n$ distinct objects can be arranged in $n!$ ways.',
      steps: [`$${n}!=${fact}$.`] };
  }

  function genWordArrangements(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const words = [['MATHS', 5, 1], ['PRIME', 5, 1], ['LOGS', 4, 1], ['CUBIC', 5, 1]];
      const [w, n] = pick(words);
      let fact = 1; for (let i = 2; i <= n; i++) fact *= i;
      return { type: 'num', val: fact, ans: String(fact), ansTex: String(fact),
        prompt: `How many distinct arrangements of the letters of ${w} are there? (All letters are different.)`,
        hint: 'For $n$ distinct letters the number is $n!$.',
        steps: [`$${n}!=${fact}$.`] };
    }
    const words = [['LEVEL', 5, 2, 2], ['STATS', 5, 2, 2], ['TEETH', 5, 2, 1]];
    // LEVEL: L2 E2 V1 → 5!/(2!2!)=30; STATS: S2 T2 A1=30; TEETH: T2 E2 H1=30
    const [w, n, r1, r2] = pick([['LEVEL', 5, 2, 2], ['STATS', 5, 2, 2], ['TOOTS', 5, 2, 2]]);
    const val = 30;
    return { type: 'num', val, ans: '30', ansTex: '30',
      prompt: `How many distinct arrangements of the letters of ${w} are there?`,
      hint: 'Divide $n!$ by the factorial of each repeated letter\'s frequency.',
      steps: [`$${n}!/(2!\\,2!)=120/4=30$.`] };
  }

  function genCountProb(kp) {
    const k = wantKp(1, kp);
    const n = pick([5, 6, 7]);
    let fact = 1; for (let i = 2; i <= n; i++) fact *= i;
    if (k === 0) {
      // n people in a row, P(two particular stand together) = 2*(n-1)! / n! = 2/n
      const f = frac(2, n);
      return { type: 'num', exact: true, val: f.v, ans: f.txt, ansTex: f.tex,
        prompt: `$${n}$ distinct people line up at random. Find the probability that two particular people stand next to each other.`,
        hint: 'Treat the pair as a single block ($2(n-1)!$ arrangements) over $n!$ equally likely lines.',
        steps: [`Favourable: $2\\cdot${n - 1}!=${2 * fact / n}$. Total: $${n}!=${fact}$.`, `$P=\\dfrac{2}{${n}}=${f.tex}$.`] };
    }
    const f = frac(1, n);
    return { type: 'num', exact: true, val: f.v, ans: f.txt, ansTex: f.tex,
      prompt: `$${n}$ distinct people line up at random. Find the probability that a particular person is at the left-hand end.`,
      hint: 'That person is equally likely to be in any of the $n$ positions.',
      steps: [`$P=\\dfrac{1}{${n}}$.`] };
  }

  // ---- Statistics ----
  function fiveNum(list) {
    const a = list.slice().sort((x, y) => x - y);
    const mid = arr => arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
    const n = a.length, half = Math.floor(n / 2);
    const lower = a.slice(0, n % 2 ? half : half);
    const upper = a.slice(n % 2 ? half + 1 : half);
    return { min: a[0], q1: mid(lower), med: mid(a), q3: mid(upper), max: a[a.length - 1], sorted: a };
  }
  function genFiveNumber(kp) {
    const k = wantKp(1, kp);
    const base = [2, 4, 5, 7, 8, 10, 12, 15, 18];
    const shift = R(0, 5);
    const data = base.map(x => x + shift);
    const fn = fiveNum(data);
    if (k === 0) {
      return { type: 'tuple', vals: [fn.min, fn.q1, fn.med, fn.q3, fn.max],
        ans: `${fn.min}; ${fn.q1}; ${fn.med}; ${fn.q3}; ${fn.max}`,
        ansTex: `${fn.min};\\,${fn.q1};\\,${fn.med};\\,${fn.q3};\\,${fn.max}`,
        prompt: `Find the five-number summary (minimum, $Q_1$, median, $Q_3$, maximum) of $$${data.join(',\\;')}$$.`,
        hint: 'Order the data. The median splits the list. $Q_1$ is the median of the lower half, $Q_3$ of the upper half (do not include the overall median in a half when $n$ is odd).',
        steps: [`Ordered: $${fn.sorted.join(',\\;')}$.`, `$Q_1=${fn.q1}$, median $=${fn.med}$, $Q_3=${fn.q3}$.`, `Summary: $${fn.min},\\,${fn.q1},\\,${fn.med},\\,${fn.q3},\\,${fn.max}$.`] };
    }
    const iqr = fn.q3 - fn.q1;
    return { type: 'num', val: iqr, ans: String(iqr), ansTex: String(iqr),
      prompt: `The five-number summary of a data set is $${fn.min},\\,${fn.q1},\\,${fn.med},\\,${fn.q3},\\,${fn.max}$. Find the interquartile range.`,
      hint: '$\\mathrm{IQR}=Q_3-Q_1$.',
      steps: [`$\\mathrm{IQR}=${fn.q3}-${fn.q1}=${iqr}$.`] };
  }

  function genHistograms(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      // generated bar heights; ask for a frequency in a class
      const freqs = [4, 6, 8, 5, 2];
      const i = R(0, 4);
      const lo = 10 * i, hi = lo + 10;
      const fig = svg(320, 160, (() => {
        let b = '<line x1="30" y1="130" x2="300" y2="130" stroke="currentColor"/><line x1="30" y1="20" x2="30" y2="130" stroke="currentColor"/>';
        freqs.forEach((f, j) => {
          const x = 40 + j * 50, h = f * 10;
          b += `<rect x="${x}" y="${130 - h}" width="40" height="${h}" fill="none" stroke="currentColor"/>`;
          b += N(x + 20, 148, String(10 * j), 0);
        });
        b += N(300, 148, '50', 0) + N(16, 20, 'f', 0);
        return b;
      })(), 'Histogram of equal-width classes $0$--, $10$--, $\\dots$');
      return { type: 'num', val: freqs[i], ans: String(freqs[i]), ansTex: String(freqs[i]),
        prompt: fig + `The histogram uses equal class widths of $10$. What is the frequency of the class $${lo}\\le x<${hi}$?`,
        hint: 'With equal class widths, frequency is the height of the bar.',
        steps: [`The bar for $${lo}$ to $${hi}$ has height $${freqs[i]}$.`] };
    }
    // skewness from a 5-number: if med closer to Q1, skewed right typically? Actually if med-Q1 < Q3-med, tail to the right.
    const left = pick([true, false]);
    const fn = left
      ? { min: 1, q1: 2, med: 3, q3: 7, max: 12 } // med-Q1=1, Q3-med=4, skewed right
      : { min: 1, q1: 5, med: 9, q3: 10, max: 11 }; // skewed left
    const ans = left ? 'skewed right (positively)' : 'skewed left (negatively)';
    return { type: 'mc', options: [
      { tex: 'skewed right (a longer tail to the right)', ok: left },
      { tex: 'skewed left (a longer tail to the left)', ok: !left },
      { tex: 'perfectly symmetric', ok: false },
      { tex: 'you can read a normal-curve percentage from the standard deviation alone', ok: false },
    ], prompt: `A data set has five-number summary $${fn.min},\\,${fn.q1},\\,${fn.med},\\,${fn.q3},\\,${fn.max}$. How is it skewed?`,
      hint: 'Compare $Q_3-\\mathrm{median}$ with $\\mathrm{median}-Q_1$. A longer upper half is skewed right. Do not invoke the normal curve.',
      steps: [`$\\mathrm{median}-Q_1=${fn.med - fn.q1}$, $Q_3-\\mathrm{median}=${fn.q3 - fn.med}$.`, left ? 'The upper half is longer: skewed right.' : 'The lower half is longer: skewed left.'],
      ans, ansTex: ans };
  }

  function genVarianceSd(kp) {
    const k = wantKp(1, kp);
    const data = pick([[2, 4, 6, 8], [1, 3, 5, 7, 9], [4, 4, 6, 10]]);
    const n = data.length, mean = data.reduce((a, b) => a + b, 0) / n;
    const popVar = data.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
    const sd = Math.sqrt(popVar);
    if (k === 0) {
      return { type: 'num', val: popVar, ans: String(popVar), ansTex: String(popVar), exact: Number.isInteger(popVar), tol: 0.01,
        prompt: `Find the population variance $\\sigma^2$ of $$${data.join(',\\;')}$$.`,
        hint: 'CAPS uses $\\sigma^2=\\dfrac{1}{n}\\sum(x-\\bar x)^2$ (the population formula on the calculator).',
        steps: [`$\\bar x=${mean}$.`, `$\\sigma^2=\\dfrac{1}{${n}}\\sum(x-\\bar x)^2=${popVar}$.`] };
    }
    const lo = mean - sd, hi = mean + sd;
    const count = data.filter(x => x > lo - 1e-9 && x < hi + 1e-9).length;
    return { type: 'num', val: count, ans: String(count), ansTex: String(count),
      prompt: `For the data $$${data.join(',\\;')}$$, how many observations lie in the interval $(\\bar x-\\sigma,\\bar x+\\sigma)$?`,
      hint: 'First find $\\bar x$ and $\\sigma$, then count the points strictly? Include the endpoints in CAPS counting of this interval — count every data value that falls inside or on the endpoints.',
      steps: [`$\\bar x=${mean}$, $\\sigma=${r2(sd)}$.`, `The interval is $(${r2(lo)},\\,${r2(hi)})$.`, `${count} of the ${n} values fall in it.`] };
  }

  function genScatterLs(kp) {
    const k = wantKp(1, kp);
    // points with exact integer least-squares
    const pts = pick([
      [[1, 2], [2, 4], [3, 6]], // y=2x
      [[1, 1], [2, 3], [3, 5]], // y=2x-1
      [[0, 4], [1, 3], [2, 2]], // y=4-x
    ]);
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p[0], 0) / n;
    const my = pts.reduce((a, p) => a + p[1], 0) / n;
    const B = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
    const A = my - B * mx;
    const list = pts.map(p => `(${p[0]};\\,${p[1]})`).join(',\\;');
    if (k === 0) {
      return { type: 'num', val: B, ans: String(B), ansTex: String(B),
        prompt: `Find the gradient $B$ of the least-squares line $\\hat y=A+Bx$ for the points $${list}$.`,
        hint: '$B=\\dfrac{\\sum(x-\\bar x)(y-\\bar y)}{\\sum(x-\\bar x)^2}$.',
        steps: [`$\\bar x=${mx}$, $\\bar y=${my}$.`, `$B=${B}$.`] };
    }
    const x0 = pts[pts.length - 1][0] + 1;
    const est = A + B * x0;
    return { type: 'num', val: est, ans: String(est), ansTex: String(est),
      prompt: `The least-squares line for $${list}$ is $\\hat y=${A}+${B}x$. Estimate $y$ at $x=${x0}$. Say in a step whether this is interpolation or extrapolation.`,
      hint: 'Substitute into $\\hat y=A+Bx$. Estimating past the data is extrapolation.',
      steps: [`$\\hat y=${A}+${B}(${x0})=${est}$.`, `$x=${x0}$ lies outside the data $x$-range, so this is extrapolation.`] };
  }

  function genCorrelation(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const r = pick([0.95, -0.92, 0.15, -0.2, 1, 0]);
      let ok, why;
      if (r === 1) { ok = 'perfect positive linear relationship'; why = '$r=1$ is a perfect positive linear relationship.'; }
      else if (r === 0) { ok = 'no linear relationship'; why = '$r=0$ means no linear relationship (there could still be a non-linear one).'; }
      else if (r >= 0.8) { ok = 'strong positive linear relationship'; why = '$r$ close to $1$: strong positive linear relationship.'; }
      else if (r <= -0.8) { ok = 'strong negative linear relationship'; why = '$r$ close to $-1$: strong negative linear relationship.'; }
      else { ok = 'weak linear relationship'; why = '$r$ close to $0$: little linear relationship.'; }
      const labels = ['perfect positive linear relationship', 'strong positive linear relationship', 'strong negative linear relationship', 'weak linear relationship', 'no linear relationship'];
      const options = labels.map(t => ({ tex: t, ok: t === ok }));
      // keep 4
      const keep = options.filter(o => o.ok).concat(options.filter(o => !o.ok)).slice(0, 4);
      return { type: 'mc', options: keep,
        prompt: `A scatter plot of paired data has correlation coefficient $r=${r}$. Which description is best?`,
        hint: '$r$ lies between $-1$ and $1$. Close to $\\pm 1$ is strong and linear; close to $0$ is weak linear.',
        steps: [why], ans: ok, ansTex: ok };
    }
    return { type: 'mc', options: [
      { tex: 'Correlation by itself does not mean that one variable causes the other.', ok: true },
      { tex: 'If $r$ is close to $1$, then $x$ must cause $y$.', ok: false },
      { tex: 'If $r=0$, the two variables are independent in every sense.', ok: false },
      { tex: '$r$ can be larger than $1$ for a very strong relationship.', ok: false },
    ], prompt: 'Which statement about the correlation coefficient $r$ is correct?',
      hint: 'Association is not the same as causation. $|r|\\le 1$.',
      steps: ['$r$ measures linear association only. It does not, on its own, establish a causal link, and it cannot exceed $1$ in absolute value.'],
      ans: 'not causation', ansTex: '\\text{correlation }\\ne\\text{ causation}' };
  }

  // ---- Analytic geometry ----
  function genMidpointDistance(kp) {
    const k = wantKp(1, kp);
    const x1 = R(-6, 6), y1 = R(-6, 6), x2 = R(-6, 6), y2 = R(-6, 6);
    if (x1 === x2 && y1 === y2) return genMidpointDistance(kp);
    if (k === 0) {
      const mx = frac(x1 + x2, 2), my = frac(y1 + y2, 2);
      return { type: 'points', pts: [[mx.txt, my.txt]], names: ['x', 'y'],
        ans: `(${mx.txt}; ${my.txt})`, ansTex: `(${mx.tex};\\,${my.tex})`,
        prompt: `Find the midpoint of $A(${x1};\\,${y1})$ and $B(${x2};\\,${y2})$.`,
        hint: 'Midpoint $\\left(\\dfrac{x_1+x_2}{2},\\dfrac{y_1+y_2}{2}\\right)$.',
        steps: [`$x=\\dfrac{${x1}+(${x2})}{2}=${mx.tex}$, $y=\\dfrac{${y1}+(${y2})}{2}=${my.tex}$.`] };
    }
    const d2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const s = sqrtSimp(d2);
    const ans = s.inn === 1 ? String(s.out) : (s.out === 1 ? `sqrt(${s.inn})` : `${s.out}sqrt(${s.inn})`);
    const ansTex = s.inn === 1 ? String(s.out) : (s.out === 1 ? `\\sqrt{${s.inn}}` : `${s.out}\\sqrt{${s.inn}}`);
    return { type: 'num', exact: true, val: Math.sqrt(d2), ans, ansTex, reject: 'radical',
      prompt: `Find the distance $AB$ if $A(${x1};\\,${y1})$ and $B(${x2};\\,${y2})$. Simplify any radical.`,
      hint: '$d=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$.',
      steps: [`$d=\\sqrt{(${x2}-(${x1}))^2+(${y2}-(${y1}))^2}=\\sqrt{${d2}}=${ansTex}$.`] };
  }
  function sqrtSimp(n) {
    let out = 1, inn = n;
    for (let f = 2; f * f <= inn; f++) while (inn % (f * f) === 0) { inn /= f * f; out *= f; }
    return { out, inn };
  }

  function genInclination(kp) {
    const k = wantKp(1, kp);
    // nice angles: 0, 45, 135, 30, 60
    const choices = [
      { m: 1, th: 45 }, { m: 0, th: 0 }, { m: -1, th: 135 },
      { m: Math.sqrt(3), th: 60, mTex: '\\sqrt{3}', mAns: 'sqrt(3)' },
      { m: 1 / Math.sqrt(3), th: 30, mTex: '\\frac{1}{\\sqrt{3}}', mAns: '1/sqrt(3)' },
    ];
    const c = pick(choices);
    if (k === 0) {
      const mTex = c.mTex || String(c.m);
      return { type: 'num', val: c.th, ans: String(c.th), ansTex: `${c.th}^\\circ`, deg: true, exact: true,
        prompt: `A line has gradient $m=${mTex}$. Find its inclination $\\theta$, in degrees, with $0^\\circ\\le\\theta<180^\\circ$.`,
        hint: '$m=\\tan\\theta$. If $m<0$, $\\theta$ is in the second quadrant.',
        steps: c.m >= 0
          ? [`$\\tan\\theta=${mTex}$, so $\\theta=${c.th}^\\circ$.`]
          : [`$\\tan\\theta=-1$, and $\\theta$ is obtuse, so $\\theta=180^\\circ-45^\\circ=135^\\circ$.`] };
    }
    // parallel / perp: line m1, another through a point
    const m1 = pick([2, -3, 1 / 2]);
    const wantPerp = Math.random() < 0.5;
    const m2 = wantPerp ? frac(-1, m1 === 1 / 2 ? 1 / 2 : m1) : { v: m1, txt: String(m1), tex: String(m1) };
    if (m1 === 1 / 2 && !wantPerp) {
      return { type: 'num', exact: true, val: 0.5, ans: '1/2', ansTex: '\\frac{1}{2}',
        prompt: 'A line is parallel to $y=\\frac{1}{2}x+3$. What is its gradient?',
        hint: 'Parallel lines have equal gradients.',
        steps: ['Parallel lines have the same gradient, $\\frac{1}{2}$.'] };
    }
    if (wantPerp) {
      const ans = m1 === 1 / 2 ? frac(-1, 1 / 2) : frac(-1, m1);
      // frac(-1, 0.5) may be messy - handle 1/2 separately
      const val = -1 / m1, txt = m1 === 2 ? '-1/2' : m1 === -3 ? '1/3' : m1 === 0.5 ? '-2' : String(val);
      const tex = m1 === 2 ? '-\\frac{1}{2}' : m1 === -3 ? '\\frac{1}{3}' : m1 === 0.5 ? '-2' : String(val);
      return { type: 'num', exact: true, val, ans: txt, ansTex: tex,
        prompt: `A line is perpendicular to a line of gradient $${m1 === 0.5 ? '\\frac{1}{2}' : m1}$. What is its gradient?`,
        hint: 'Perpendicular lines: $m_1 m_2=-1$.',
        steps: [`$m_2=-\\dfrac{1}{${m1 === 0.5 ? '\\frac{1}{2}' : m1}}=${tex}$.`] };
    }
    return { type: 'num', exact: true, val: m1, ans: String(m1), ansTex: String(m1),
      prompt: `A line is parallel to $y=${m1}x+2$. What is its gradient?`,
      hint: 'Parallel lines have equal gradients.',
      steps: [`The gradient is still $${m1}$.`] };
  }

  function genTangentsCircle(kp) {
    const k = wantKp(1, kp);
    // circle x^2+y^2=r^2, tangent at (a,b) is a x + b y = r^2, with a^2+b^2=r^2
    const triples = [[3, 4, 5], [5, 12, 13], [0, 4, 4], [8, 0, 8], [6, 8, 10]];
    const [a, b, r] = pick(triples);
    if (k === 0) {
      // condition: line y = mx + c vs x^2+y^2=r^2, tangent iff distance from centre = r
      // Use: point (a,b) on the circle. Confirm a^2+b^2=r^2 and ask r^2.
      return { type: 'num', val: r * r, ans: String(r * r), ansTex: String(r * r),
        prompt: `The point $(${a};\\,${b})$ lies on the circle $x^2+y^2=r^2$. Find $r^2$.`,
        hint: 'Substitute the point into the circle equation.',
        steps: [`$${a}^2+${b}^2=${a * a + b * b}$, so $r^2=${r * r}$.`] };
    }
    const ansTex = b === 0 ? `${a}x=${r * r}` : a === 0 ? `${b}y=${r * r}` : `${a}x${sg(b)}y=${r * r}`;
    const rhs = `${a}*x+(${b})*y-(${r * r})`;
    return { type: 'eqn', lhs: `${a}*x+(${b})*y`, rhs: String(r * r), vars: ['x', 'y'],
      ans: ansTex, ansTex,
      prompt: `Find the equation of the tangent to $x^2+y^2=${r * r}$ at $(${a};\\,${b})$.`,
      hint: 'For $x^2+y^2=r^2$, the tangent at $(x_1;y_1)$ is $x_1 x+y_1 y=r^2$.',
      steps: [`The point is on the circle because $${a}^2+${b}^2=${r * r}$.`, `Tangent: $${ansTex}$.`] };
  }

  function genCollinearProof(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const t = R(2, 5);
      const A = [0, 0], B = [t, 2 * t], C = [2 * t, 4 * t];
      return { type: 'mc', options: [
        { tex: `Yes: $m_{AB}=m_{BC}=2$, so $A$, $B$ and $C$ are collinear.`, ok: true },
        { tex: 'No: the gradients $m_{AB}$ and $m_{BC}$ are different.', ok: false },
        { tex: 'You would need the distances $AB$ and $BC$ to be equal.', ok: false },
        { tex: 'Three points are never collinear if one is the origin.', ok: false },
      ], prompt: `Are $A(${A[0]};\\,${A[1]})$, $B(${B[0]};\\,${B[1]})$ and $C(${C[0]};\\,${C[1]})$ collinear?`,
        hint: 'Points are collinear if the gradients of $AB$ and $BC$ are equal (or a vector argument).',
        steps: [`$m_{AB}=\\dfrac{${B[1]}-${A[1]}}{${B[0]}-${A[0]}}=2$, $m_{BC}=\\dfrac{${C[1]}-${B[1]}}{${C[0]}-${B[0]}}=2$.`, 'Equal gradients and a shared point, so the points are collinear.'],
        ans: 'collinear', ansTex: '\\text{collinear}' };
    }
    // midpoint of diagonals of parallelogram / midpoint theorem in coord form
    const A = [0, 0], B = [R(2, 6), 0], D = [R(1, 4), R(2, 5)], C = [B[0] + D[0], B[1] + D[1]];
    const mAC = [frac(C[0], 2), frac(C[1], 2)], mBD = [frac(B[0] + D[0], 2), frac(B[1] + D[1], 2)];
    return { type: 'points', pts: [[mAC[0].txt, mAC[1].txt]], names: ['x', 'y'],
      ans: `(${mAC[0].txt}; ${mAC[1].txt})`, ansTex: `(${mAC[0].tex};\\,${mAC[1].tex})`,
      prompt: `$ABCD$ is a parallelogram with $A(0;\\,0)$, $B(${B[0]};\\,0)$, $D(${D[0]};\\,${D[1]})$ and $C(${C[0]};\\,${C[1]})$. Find the midpoint of $AC$.`,
      hint: 'The diagonals of a parallelogram bisect each other, so the midpoint of $AC$ equals the midpoint of $BD$.',
      steps: [`Midpoint of $AC$: $\\left(\\dfrac{${C[0]}}{2};\\,\\dfrac{${C[1]}}{2}\\right)=(${mAC[0].tex};\\,${mAC[1].tex})$.`, `Midpoint of $BD$ is the same, as expected.`] };
  }

  function genAgeoRiders(kp) {
    const k = wantKp(1, kp);
    // combined: A,B given, find radius of circle with diameter AB (half of AB), or centre = midpoint
    const A = [R(-4, -1), R(-3, 3)], B = [R(1, 5), R(-3, 3)];
    const mx = frac(A[0] + B[0], 2), my = frac(A[1] + B[1], 2);
    if (k === 0) {
      return { type: 'points', pts: [[mx.txt, my.txt]], names: ['x', 'y'],
        ans: `(${mx.txt}; ${my.txt})`, ansTex: `(${mx.tex};\\,${my.tex})`,
        prompt: `$AB$ is a diameter of a circle, with $A(${A[0]};\\,${A[1]})$ and $B(${B[0]};\\,${B[1]})$. Find the centre of the circle.`,
        hint: 'The centre is the midpoint of the diameter.',
        steps: [`Centre $=\\left(\\dfrac{${A[0]}+${B[0]}}{2};\\,\\dfrac{${A[1]}+${B[1]}}{2}\\right)=(${mx.tex};\\,${my.tex})$.`] };
    }
    const d2 = (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2;
    const r2 = d2 / 4;
    return { type: 'num', val: r2, ans: String(r2), ansTex: String(r2), exact: d2 % 4 === 0, tol: 0.01,
      prompt: `$AB$ is a diameter of a circle, with $A(${A[0]};\\,${A[1]})$ and $B(${B[0]};\\,${B[1]})$. Find $r^2$, the square of the radius.`,
      hint: 'The radius is half the diameter. It is often easiest to compute $r^2=\\dfrac{AB^2}{4}$.',
      steps: [`$AB^2=${d2}$, so $r^2=\\dfrac{${d2}}{4}=${r2}$.`] };
  }

  // ---- Trigonometry ----
  function genAreaRule(kp) {
    const k = wantKp(1, kp);
    const a = pick([5, 6, 7, 8, 10]), b = pick([4, 5, 6, 9]), C = pick([30, 45, 60, 90, 150]);
    const area = 0.5 * a * b * Math.sin(C * Math.PI / 180);
    if (k === 0) {
      let ans = String(r2(area)), ansTex = String(r2(area)), exact = false, val = area;
      if (C === 90) { val = 0.5 * a * b; ans = String(val); ansTex = (a * b % 2 === 0) ? String(val) : frac(a * b, 2).tex; exact = true; if (a * b % 2) ans = frac(a * b, 2).txt; }
      else if (C === 30) { val = a * b / 4; ans = (a * b % 4 === 0) ? String(val) : frac(a * b, 4).txt; ansTex = (a * b % 4 === 0) ? String(val) : frac(a * b, 4).tex; exact = true; }
      else if (C === 150) { val = a * b / 4; ans = (a * b % 4 === 0) ? String(val) : frac(a * b, 4).txt; ansTex = (a * b % 4 === 0) ? String(val) : frac(a * b, 4).tex; exact = true; }
      else if (C === 45 || C === 60) {
        const coef = C === 45 ? frac(a * b, 4) : frac(a * b, 4); // 0.5 ab *(sqrt2/2)= ab sqrt2/4; 0.5 ab * sqrt3/2 = ab sqrt3/4
        const s = C === 45 ? '2' : '3';
        ans = (a * b % 4 === 0 ? (a * b / 4 === 1 ? '' : String(a * b / 4)) : ((a * b / 2) % 2 === 1 ? `${a * b}/4` : `${a * b / 2}/2`)) + `sqrt(${s})`;
        // cleaner:
        const f = frac(a * b, 4);
        ans = f.d === 1 && f.n === 1 ? `sqrt(${s})` : f.d === 1 ? `${f.n}sqrt(${s})` : `${f.txt}sqrt(${s})`.replace('/', '/');
        if (f.d !== 1) ans = `(${f.txt})sqrt(${s})`;
        ansTex = f.d === 1 && f.n === 1 ? `\\sqrt{${s}}` : f.d === 1 ? `${f.n}\\sqrt{${s}}` : `${f.tex}\\sqrt{${s}}`;
        val = area; exact = true;
      }
      return { type: 'num', exact, val, ans, ansTex, deg: true,
        prompt: `In $\\triangle ABC$, $a=${b}$, $b=${a}$ and $\\hat C=${C}^\\circ$. Find the area of the triangle.`,
        hint: 'Area $=\\frac12 ab\\sin C$. Use the two sides that include the angle.',
        steps: [`Area $=\\dfrac12(${a})(${b})\\sin ${C}^\\circ=${ansTex}$.`] };
    }
    // find a side from area
    const area2 = 0.5 * a * b * Math.sin(30 * Math.PI / 180); // C=30, area=ab/4
    return { type: 'num', exact: true, val: b, ans: String(b), ansTex: String(b), deg: true,
      prompt: `The area of $\\triangle ABC$ is $${a * b / 4}$, $a=${a}$ and $\\hat C=30^\\circ$. Find $b$ (the side next to $\\hat C$, other than $a$).`,
      hint: '$\\mathrm{Area}=\\frac12 ab\\sin C$.',
      steps: [`$\\dfrac12(${a})b\\sin 30^\\circ=\\dfrac{${a * b}}{4}$.`, `$\\dfrac12(${a})b\\cdot\\dfrac12=\\dfrac{${a * b}}{4}$, so $b=${b}$.`] };
  }

  function genTrigGraphsDeg(kp) {
    const k = wantKp(1, kp);
    const A = pick([2, 3, -2]), B = pick([1, 2, 3]);
    if (k === 0) {
      const per = 360 / B;
      return { type: 'fields', fields: [
        { label: '\\text{amplitude}', name: 'amplitude', ans: Math.abs(A) },
        { label: '\\text{period}', name: 'period', ans: per },
      ], prompt: `For $y=${A}\\sin(${B}x)$ with $x$ in degrees, state the amplitude and the period.`,
        hint: 'Amplitude is $|A|$. Period of $\\sin(Bx)$ is $360^\\circ/|B|$.',
        steps: [`Amplitude $=|${A}|=${Math.abs(A)}$.`, `Period $=\\dfrac{360^\\circ}{${B}}=${per}^\\circ$.`],
        ans: `${Math.abs(A)}, ${per}`, ansTex: `${Math.abs(A)},\\;${per}^\\circ` };
    }
    return { type: 'mc', options: [
      { tex: 'The period of $y=\\tan x$ is $180^\\circ$, and there are vertical asymptotes at $x=90^\\circ+180^\\circ k$.', ok: true },
      { tex: 'The period of $y=\\tan x$ is $360^\\circ$.', ok: false },
      { tex: '$y=\\tan x$ has amplitude $1$.', ok: false },
      { tex: '$y=\\tan x$ is defined at $x=90^\\circ$.', ok: false },
    ], prompt: 'Which statement about $y=\\tan x$ (degrees) is correct?',
      hint: '$\\tan x=\\sin x/\\cos x$ is undefined where $\\cos x=0$. Its fundamental period is $180^\\circ$.',
      steps: ['$\\tan(x+180^\\circ)=\\tan x$, and $\\tan x$ is undefined at $90^\\circ+180^\\circ k$. Amplitude is not used for $y=\\tan x$.'],
      ans: 'period 180, asymptotes', ansTex: 'T=180^\\circ' };
  }

  function genReduction(kp) {
    const k = wantKp(1, kp);
    const th = pick([20, 25, 35, 40, 50]);
    if (k === 0) {
      const kind = pick(['sin180', 'cos180', 'sin90', 'cos90']);
      let prompt, ans, steps, ansTex;
      if (kind === 'sin180') {
        prompt = `Write $\\sin(${180 - th}^\\circ)$ in terms of $\\sin ${th}^\\circ$ or $\\cos ${th}^\\circ$.`;
        ans = `sin(${th})`; ansTex = `\\sin ${th}^\\circ`;
        steps = [`$\\sin(180^\\circ-\\theta)=\\sin\\theta$, so $\\sin(${180 - th}^\\circ)=\\sin ${th}^\\circ$.`];
      } else if (kind === 'cos180') {
        prompt = `Write $\\cos(${180 - th}^\\circ)$ in terms of $\\sin ${th}^\\circ$ or $\\cos ${th}^\\circ$.`;
        ans = `-cos(${th})`; ansTex = `-\\cos ${th}^\\circ`;
        steps = [`$\\cos(180^\\circ-\\theta)=-\\cos\\theta$, so $\\cos(${180 - th}^\\circ)=-\\cos ${th}^\\circ$.`];
      } else if (kind === 'sin90') {
        prompt = `Write $\\sin(${90 + th}^\\circ)$ in terms of $\\sin ${th}^\\circ$ or $\\cos ${th}^\\circ$.`;
        ans = `cos(${th})`; ansTex = `\\cos ${th}^\\circ`;
        steps = [`$\\sin(90^\\circ+\\theta)=\\cos\\theta$, so $\\sin(${90 + th}^\\circ)=\\cos ${th}^\\circ$.`];
      } else {
        prompt = `Write $\\cos(${90 - th}^\\circ)$ in terms of $\\sin ${th}^\\circ$ or $\\cos ${th}^\\circ$.`;
        ans = `sin(${th})`; ansTex = `\\sin ${th}^\\circ`;
        steps = [`$\\cos(90^\\circ-\\theta)=\\sin\\theta$, so $\\cos(${90 - th}^\\circ)=\\sin ${th}^\\circ$.`];
      }
      return { type: 'expr', var: 'x', sample: [0.2, 1.2], ans, ansTex, deg: true,
        // use a dummy var? these are numeric expressions in a constant angle - type expr with no x will fail.
        // Better: type num by evaluating, or type expr with the trig of th as a number
        // Switch to asking the exact value when th is not special... Can't without leaving in terms of sin/cos.
        // Use type='expr' but the answer doesn't contain x. check expr samples x in [lo,hi] and compares ev(ans) which is constant.
        // ev(parse('sin(40)')) needs DEG=true and will be constant. ev(parse('sin(x)')) would vary. Our ans is sin(40) without x. Good if DEG is set.
        prompt, hint: 'Use a reduction formula to an acute angle in the first quadrant, watching the sign (CAST).',
        steps };
    }
    // negative angle
    return { type: 'expr', var: 'x', sample: [0.2, 1.2], ans: `-sin(${th})`, ansTex: `-\\sin ${th}^\\circ`, deg: true,
      prompt: `Write $\\sin(-${th}^\\circ)$ in terms of $\\sin ${th}^\\circ$ or $\\cos ${th}^\\circ$.`,
      hint: '$\\sin(-\\theta)=-\\sin\\theta$ (odd). $\\cos(-\\theta)=\\cos\\theta$ (even).',
      steps: [`$\\sin(-${th}^\\circ)=-\\sin ${th}^\\circ$.`] };
  }

  function genGeneralSolution(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const cases = [
        { eq: '\\sin\\theta=\\dfrac{1}{2}', fams: [{ base: 30, period: 360 }, { base: 150, period: 360 }], tex: '\\theta=30^\\circ+360^\\circ k\\text{ or }\\theta=150^\\circ+360^\\circ k' },
        { eq: '\\cos\\theta=\\dfrac{1}{2}', fams: [{ base: 60, period: 360 }, { base: 300, period: 360 }], tex: '\\theta=60^\\circ+360^\\circ k\\text{ or }\\theta=300^\\circ+360^\\circ k' },
        { eq: '\\tan\\theta=1', fams: [{ base: 45, period: 180 }], tex: '\\theta=45^\\circ+180^\\circ k' },
        { eq: '\\sin\\theta=0', fams: [{ base: 0, period: 180 }], tex: '\\theta=180^\\circ k' },
      ];
      const c = pick(cases);
      return { type: 'trig', deg: true, fams: c.fams, ans: c.tex, ansTex: c.tex,
        prompt: `Find the general solution, in degrees, of $${c.eq}$. Let $k\\in\\mathbb{Z}$.`,
        hint: 'Find the reference angle, list the solutions in one full rotation (or $180^\\circ$ for tangent), then add the period.',
        steps: [`The solutions are $${c.tex}$, $k\\in\\mathbb{Z}$.`] };
    }
    // with a reduction: sin(2θ)=1/2 or cos θ = -1/2
    const c = { eq: '\\cos\\theta=-\\dfrac{1}{2}', fams: [{ base: 120, period: 360 }, { base: 240, period: 360 }], tex: '\\theta=120^\\circ+360^\\circ k\\text{ or }\\theta=240^\\circ+360^\\circ k' };
    return { type: 'trig', deg: true, fams: c.fams, ans: c.tex, ansTex: c.tex,
      prompt: `Find the general solution, in degrees, of $${c.eq}$. Let $k\\in\\mathbb{Z}$.`,
      hint: '$\\cos$ is negative in the second and third quadrants. Reference angle $60^\\circ$.',
      steps: [`Reference angle $60^\\circ$, so $\\theta=180^\\circ-60^\\circ=120^\\circ$ or $\\theta=180^\\circ+60^\\circ=240^\\circ$.`, `General solution: $${c.tex}$.`] };
  }

  function genGraphIntersections(kp) {
    const k = wantKp(1, kp);
    // y=sin x and y = 1/2 on [0,360)
    if (k === 0) {
      return { type: 'set', exact: true, vals: [30, 150], ans: '30, 150', ansTex: '30^\\circ,\\;150^\\circ', deg: true,
        prompt: `Find the $x$-coordinates in $[0^\\circ,360^\\circ)$ where $y=\\sin x$ and $y=\\dfrac12$ meet.`,
        hint: 'Solve $\\sin x=\\frac12$ on that interval.',
        steps: [`$x=30^\\circ$ or $x=150^\\circ$ in $[0^\\circ,360^\\circ)$.`] };
    }
    return { type: 'set', exact: true, vals: [45, 225], ans: '45, 225', ansTex: '45^\\circ,\\;225^\\circ', deg: true,
      prompt: `Find the $x$-coordinates in $[0^\\circ,360^\\circ)$ where $y=\\tan x$ and $y=1$ meet.`,
      hint: '$\\tan x=1$ at $45^\\circ$ and $45^\\circ+180^\\circ$. Watch the asymptote at $90^\\circ$.',
      steps: [`$x=45^\\circ$ or $x=225^\\circ$.`] };
  }


  function genTrig2d(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const opp30 = pick([3, 4, 5, 6]);
      const hyp = 2 * opp30;
      return { type: 'num', exact: true, val: hyp, ans: String(hyp), ansTex: String(hyp), deg: true,
        prompt: `In right-angled $\\triangle ABC$ with $\\hat B=90^\\circ$ and $\\hat C=30^\\circ$, the side opposite $30^\\circ$ is $${opp30}$. Find the hypotenuse.`,
        hint: 'In a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle the side opposite $30^\\circ$ is half the hypotenuse.',
        steps: [`Hypotenuse $=2\\times${opp30}=${hyp}$.`] };
    }
    // cosine rule, 60 degrees, integer sides: 5, 5, 5 equilateral, or 5, 8, angle 60?
    // c^2 = a^2+b^2-2ab cos C, C=60, cos=1/2, c^2=a^2+b^2-ab. Use a=b=5, c=5.
    const a = pick([5, 6, 8]), C = 60;
    const c2 = a * a + a * a - a * a; // a^2
    return { type: 'num', exact: true, val: a, ans: String(a), ansTex: String(a), deg: true,
      prompt: `In $\\triangle ABC$, $a=${a}$, $b=${a}$ and $\\hat C=60^\\circ$. Find $c$.`,
      hint: 'The cosine rule: $c^2=a^2+b^2-2ab\\cos C$. Two sides equal and included $60^\\circ$ make an equilateral triangle.',
      steps: [`$c^2=${a}^2+${a}^2-2(${a})(${a})\\cos 60^\\circ=${a * a}+${a * a}-${a * a}=${a * a}$.`, `$c=${a}$.`] };
  }

  function genTrig3d(kp) {
    const k = wantKp(1, kp);
    // vertical pole, shadow, angle of elevation
    const h = pick([6, 8, 10, 12]), ang = pick([30, 45, 60]);
    const hyp = ang === 30 ? 2 * h : ang === 45 ? h * Math.sqrt(2) : h * 2 / Math.sqrt(3);
    // actually: tan(ang)=h/d, d = h / tan
    const d = ang === 30 ? h * Math.sqrt(3) : ang === 45 ? h : h / Math.sqrt(3);
    if (k === 0) {
      let ans, ansTex, val = d, exact = true;
      if (ang === 45) { ans = String(h); ansTex = String(h); }
      else if (ang === 30) { ans = h === 1 ? 'sqrt(3)' : `${h}sqrt(3)`; ansTex = h === 1 ? '\\sqrt{3}' : `${h}\\sqrt{3}`; }
      else { const f = frac(h, 1); ans = h === 3 ? 'sqrt(3)' : `(${h})/sqrt(3)`; /* rationalise */ ans = h % 3 === 0 ? (h / 3 === 1 ? 'sqrt(3)' : `${h / 3}sqrt(3)`) : `${h}sqrt(3)/3`;
        ansTex = h % 3 === 0 ? (h / 3 === 1 ? '\\sqrt{3}' : `${h / 3}\\sqrt{3}`) : `\\dfrac{${h}\\sqrt{3}}{3}`; }
      const fig = svg(260, 160,
        L(30, 130, 230, 130) + L(30, 130, 30, 130 - 80) + L(30, 130 - 80, 200, 130) +
        N(16, 130 - 40, 'h') + N(120, 148, 'd', 0) + N(150, 80, ang + '°'),
        'A vertical pole of height $h$ and its shadow on level ground.');
      return { type: 'num', exact, val, ans, ansTex, deg: true,
        prompt: fig + `A vertical pole of height $${h}$ m stands on level ground. The angle of elevation of the top of the pole from a point on the ground is $${ang}^\\circ$. Find the distance from that point to the foot of the pole.`,
        hint: '$\\tan\\theta=\\dfrac{\\text{opposite}}{\\text{adjacent}}=\\dfrac{h}{d}$.',
        steps: [`$\\tan ${ang}^\\circ=\\dfrac{${h}}{d}$, so $d=${ansTex}$.`] };
    }
    // 3D: two angles, find height from two distances? Or a square base, angle of elevation to a corner.
    const side = pick([4, 6, 8]);
    // square side s, height h, elevation from a base corner to top of adjacent vertical is 45, then h=s
    return { type: 'num', exact: true, val: side, ans: String(side), ansTex: String(side), deg: true,
      prompt: `A vertical mast stands at one corner of a horizontal square courtyard of side $${side}$ m. From an adjacent corner of the square, the angle of elevation of the top of the mast is $45^\\circ$. Find the height of the mast.`,
      hint: 'The adjacent corner is $${side}$ m from the foot of the mast, on level ground. $\\tan 45^\\circ=1=h/s$.',
      steps: [`$\\tan 45^\\circ=1=\\dfrac{h}{${side}}$, so $h=${side}$.`] };
  }

  // ---- Euclidean geometry: computed diagrams + statement/reason ----
  function reasons(list) {
    return list.map(r => ({ id: r[0], text: r[1] }));
  }
  function statements(list) {
    return list.map(s => ({ id: s[0], text: s[1] }));
  }

  // Unit 0 geometry revision, in the order of Siyavula Grade 10 (CC BY):
  // angles, parallel lines, triangles, isosceles, congruence, quadrilaterals,
  // midpoint theorem. Reasons use the CAPS forms.
  const deg = v => `${v}^\\circ`;
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const angNum = (val, prompt, hint, steps) => ({ type: 'num', val, ans: String(val), ansTex: deg(val), deg: true, prompt, hint, steps });
  const lenNum = (val, prompt, hint, steps) => ({ type: 'num', val, ans: String(val), ansTex: `${val}\\text{ cm}`, prompt, hint, steps });
  const signed = n => n < 0 ? ` - ${-n}` : ` + ${n}`;

  function eucAngles() {
    const v = R(0, 2);
    if (v === 0) {
      const t = pick([100, 110, 115, 120, 125, 130, 140, 145]);
      return angNum(180 - t, FIG.line(180 - t, `${t}°`, '?') +
        `$ABC$ is a straight line and $A\\hat BD=${deg(t)}$. Find $D\\hat BC$.`,
      'Angles that sit side by side on a straight line add up to $180^\\circ$.',
      [`$D\\hat BC=180^\\circ-${deg(t)}=${deg(180 - t)}$ (∠s on a str line).`]);
    }
    if (v === 1) {
      const t = pick([40, 50, 55, 65, 70, 75]);
      if (Math.random() < 0.5) {
        return angNum(t, FIG.cross(t, { 3: `${t}°`, 1: '?' }) +
          `Straight lines $AB$ and $CD$ cross at $O$. $A\\hat OC=${deg(t)}$. Find $B\\hat OD$.`,
        'When two straight lines cross, the angles opposite each other are equal.',
        [`$B\\hat OD=A\\hat OC=${deg(t)}$ (vert opp ∠s).`]);
      }
      return angNum(180 - t, FIG.cross(t, { 3: `${t}°`, 2: '?' }) +
        `Straight lines $AB$ and $CD$ cross at $O$. $A\\hat OC=${deg(t)}$. Find $A\\hat OD$.`,
      '$A\\hat OC$ and $A\\hat OD$ sit side by side on the straight line $CD$.',
      [`$A\\hat OD=180^\\circ-${deg(t)}=${deg(180 - t)}$ (∠s on a str line).`]);
    }
    const x = pick([20, 25, 30, 35, 40]), a = pick([5, 10, 15]), b = x - a;
    return angNum(x, FIG.cross(2 * x + a, { 1: `2x+${a}°`, 3: `3x−${b}°` }) +
      `Straight lines $AB$ and $CD$ cross at $O$. $\\hat O_1=2x+${deg(a)}$ and $\\hat O_3=3x-${deg(b)}$. Find $x$.`,
    '$\\hat O_1$ and $\\hat O_3$ are vertically opposite, so they are equal. Set them equal and solve.',
    [`$3x-${deg(b)}=2x+${deg(a)}$ (vert opp ∠s).`, `$x=${deg(a)}+${deg(b)}=${deg(x)}$.`]);
  }

  function eucParallel() {
    const v = R(0, 3);
    if (v === 0) {
      const t = pick([55, 60, 65, 70, 75, 110, 115, 120]);
      return angNum(t, FIG.parallel(t, [['EGB', `${t}°`], ['GHD', '?']]) +
        `$AB\\parallel CD$ and $EF$ cuts $AB$ at $G$ and $CD$ at $H$. $E\\hat GB=${deg(t)}$. Find $G\\hat HD$.`,
      '$E\\hat GB$ and $G\\hat HD$ sit in the same position at each crossing: corresponding angles.',
      [`$G\\hat HD=E\\hat GB=${deg(t)}$ (corresp ∠s; $AB\\parallel CD$).`]);
    }
    if (v === 1) {
      const t = pick([105, 110, 115, 120, 125, 130]);
      return angNum(t, FIG.parallel(t, [['AGH', `${t}°`], ['GHD', '?']]) +
        `$AB\\parallel CD$ and $EF$ cuts $AB$ at $G$ and $CD$ at $H$. $A\\hat GH=${deg(t)}$. Find $G\\hat HD$.`,
      'The two angles are between the parallel lines, on opposite sides of $EF$: alternate angles (a Z shape).',
      [`$G\\hat HD=A\\hat GH=${deg(t)}$ (alt ∠s; $AB\\parallel CD$).`]);
    }
    if (v === 2) {
      const t = pick([105, 110, 115, 120, 125, 130]);
      return angNum(180 - t, FIG.parallel(t, [['AGH', `${t}°`], ['CHG', '?']]) +
        `$AB\\parallel CD$ and $EF$ cuts $AB$ at $G$ and $CD$ at $H$. $A\\hat GH=${deg(t)}$. Find $G\\hat HC$.`,
      'Both angles are between the parallel lines on the same side of $EF$: co-interior angles add up to $180^\\circ$.',
      [`$G\\hat HC=180^\\circ-${deg(t)}=${deg(180 - t)}$ (co-int ∠s; $AB\\parallel CD$).`]);
    }
    const x = pick([28, 30, 32, 34, 36]), a = pick([10, 20]), b = 180 - 5 * x - a;
    const bg = 2 * x + a;
    return angNum(x, FIG.parallel(180 - bg, [['BGH', `2x+${a}°`], ['GHD', `3x${b < 0 ? '−' + (-b) : '+' + b}°`]]) +
      `$AB\\parallel CD$. $B\\hat GH=2x+${deg(a)}$ and $G\\hat HD=3x${signed(b)}^\\circ$. Find $x$.`,
    '$B\\hat GH$ and $G\\hat HD$ are co-interior angles, so they add up to $180^\\circ$.',
    [`$(2x+${deg(a)})+(3x${signed(b)}^\\circ)=180^\\circ$ (co-int ∠s; $AB\\parallel CD$).`, `$5x=${deg(180 - a - b)}$, so $x=${deg(x)}$.`]);
  }

  function eucTriangle() {
    const v = R(0, 2);
    if (v === 0) {
      const a = pick([40, 48, 52, 64, 70]), b = pick([55, 62, 68, 77]), c = 180 - a - b;
      return angNum(c, FIG.tri(b, c, { arcs: [['BAC', `${a}°`], ['ABC', `${b}°`], ['ACB', '?']] }) +
        `In $\\triangle ABC$, $\\hat A=${deg(a)}$ and $\\hat B=${deg(b)}$. Find $\\hat C$.`,
      'The three angles inside a triangle add up to $180^\\circ$.',
      [`$\\hat C=180^\\circ-${deg(a)}-${deg(b)}=${deg(c)}$ (sum of ∠s in △).`]);
    }
    if (v === 1) {
      const p = pick([35, 40, 45, 50]), q = pick([60, 65, 70, 75]);
      return angNum(p + q, FIG.tri(q, 180 - p - q, { ext: true, names: { A: 'P', B: 'Q', C: 'R', D: 'S' }, arcs: [['BAC', `${p}°`], ['ABC', `${q}°`], ['ACD', '?']] }) +
        `In $\\triangle PQR$, side $QR$ is extended to $S$. $\\hat P=${deg(p)}$ and $\\hat Q=${deg(q)}$. Find $P\\hat RS$.`,
      'An exterior angle of a triangle equals the sum of the two interior angles opposite it.',
      [`$P\\hat RS=${deg(p)}+${deg(q)}=${deg(p + q)}$ (ext ∠ of △).`]);
    }
    const a = pick([10, 20, 30]), b = pick([10, 20]), x = a + b;
    return angNum(x, FIG.tri(x + a, 180 - (3 * x - b), { ext: true, arcs: [['BAC', 'x'], ['ABC', `x+${a}°`], ['ACD', `3x−${b}°`]] }) +
      `In $\\triangle ABC$, $BC$ is extended to $D$. $\\hat A=x$, $\\hat B=x+${deg(a)}$ and $A\\hat CD=3x-${deg(b)}$. Find $x$.`,
    'The exterior angle $A\\hat CD$ equals $\\hat A+\\hat B$.',
    [`$3x-${deg(b)}=x+(x+${deg(a)})$ (ext ∠ of △).`, `$x=${deg(a)}+${deg(b)}=${deg(x)}$.`]);
  }

  function eucIsosceles() {
    const v = R(0, 3);
    if (v === 0) {
      const b = pick([50, 55, 65, 70, 75]), a = 180 - 2 * b;
      return angNum(a, FIG.tri(b, b, { ticks: [['AB', 1], ['AC', 1]], arcs: [['ABC', `${b}°`], ['BAC', '?']] }) +
        `In $\\triangle ABC$, $AB=AC$ and $\\hat B=${deg(b)}$. Find $\\hat A$.`,
      'The angles opposite the equal sides are equal, so $\\hat C=\\hat B$. Then use the angle sum.',
      [`$\\hat C=\\hat B=${deg(b)}$ (∠s opp equal sides).`, `$\\hat A=180^\\circ-2\\times${deg(b)}=${deg(a)}$ (sum of ∠s in △).`]);
    }
    if (v === 1) {
      const p = pick([24, 36, 40, 44, 52, 80, 96]), q = (180 - p) / 2;
      return angNum(q, FIG.tri(q, q, { names: { A: 'P', B: 'Q', C: 'R' }, ticks: [['AB', 1], ['AC', 1]], arcs: [['BAC', `${p}°`], ['ABC', '?']] }) +
        `In $\\triangle PQR$, $PQ=PR$ and $\\hat P=${deg(p)}$. Find $\\hat Q$.`,
      '$\\hat Q=\\hat R$ because they are opposite the equal sides. Together they make $180^\\circ-\\hat P$.',
      [`$\\hat Q=\\hat R$ (∠s opp equal sides).`, `$\\hat Q+\\hat R=180^\\circ-${deg(p)}=${deg(180 - p)}$ (sum of ∠s in △).`, `$\\hat Q=${deg(180 - p)}\\div 2=${deg(q)}$.`]);
    }
    if (v === 2) {
      const b = pick([60, 64, 70, 72, 76, 80]), c = b / 2;
      return angNum(c, FIG.isoPair(b, { B: `${b}°`, C: '?' }) +
        `$D$ lies on $BC$ with $AB=AD$ and $AD=DC$. $\\hat B=${deg(b)}$. Find $\\hat C$.`,
      'Work in $\\triangle ABD$ first, then cross the straight line at $D$ into $\\triangle ADC$.',
      [`$A\\hat DB=\\hat B=${deg(b)}$ (∠s opp equal sides; $AB=AD$).`, `$A\\hat DC=180^\\circ-${deg(b)}=${deg(180 - b)}$ (∠s on a str line).`,
        `$D\\hat AC=\\hat C$ (∠s opp equal sides; $AD=DC$).`, `$\\hat C=(180^\\circ-${deg(180 - b)})\\div 2=${deg(c)}$ (sum of ∠s in △).`]);
    }
    const b = pick([50, 55, 65, 70]), a = 180 - 2 * b;
    return { type: 'geom',
      statements: statements([['s1', 'AB = AC'], ['s2', `∠C = ∠B = ${b}°`], ['s3', `∠A = ${a}°`], ['s4', 'AB ∥ BC'], ['s5', `∠A = ${b}°`]]),
      reasons: reasons([['r1', 'given'], ['r2', '∠s opp equal sides'], ['r3', 'sum of ∠s in △'], ['r4', 'vert opp ∠s'], ['r5', 'alt ∠s']]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: FIG.tri(b, b, { ticks: [['AB', 1], ['AC', 1]], arcs: [['ABC', `${b}°`]] }) +
        `In $\\triangle ABC$, $AB=AC$ and $\\hat B=${deg(b)}$. Prove that $\\hat A=${deg(a)}$. Add each statement with its reason, in order.`,
      hint: 'Start with what you are given. Then the angles opposite the equal sides. Then the angle sum.',
      steps: ['$AB=AC$ (given).', `$\\hat C=\\hat B=${deg(b)}$ (∠s opp equal sides).`, `$\\hat A=180^\\circ-2\\times${deg(b)}=${deg(a)}$ (sum of ∠s in △).`],
      ans: `${a} degrees`, ansTex: deg(a) };
  }

  const CONG = {
    SSS: () => ({ fig: FIG.kite(), tri: ['ABC', 'ADC'], info: '$AB=AD$ and $CB=CD$.',
      rows: [['AB = AD', 'given'], ['CB = CD', 'given'], ['AC = AC', 'common'], ['△ABC ≡ △ADC', 'SSS']] }),
    SAS: () => ({ fig: FIG.bowtie({ ticks: [['AC', 1], ['CE', 1], ['BC', 2], ['CD', 2]] }), tri: ['ABC', 'EDC'], info: '$AE$ and $BD$ cross at $C$, with $AC=CE$ and $BC=CD$.',
      rows: [['AC = EC', 'given'], ['∠ACB = ∠ECD', 'vert opp ∠s'], ['BC = DC', 'given'], ['△ABC ≡ △EDC', 'SAS']] }),
    AAS: () => ({ fig: FIG.bowtie({ ticks: [['BC', 1], ['CD', 1]], arrows: [['AB', 1], ['DE', 1]] }), tri: ['ABC', 'EDC'], info: '$AE$ and $BD$ cross at $C$, $AB\\parallel DE$ and $BC=CD$.',
      rows: [['∠ABC = ∠EDC', 'alt ∠s; AB ∥ DE'], ['∠ACB = ∠ECD', 'vert opp ∠s'], ['BC = DC', 'given'], ['△ABC ≡ △EDC', 'AAS']] }),
    RHS: () => ({ fig: FIG.isoAltitude(), tri: ['ADB', 'ADC'], info: '$AB=AC$ and $AD\\perp BC$.',
      rows: [['∠ADB = ∠ADC = 90°', 'given'], ['AB = AC', 'given'], ['AD = AD', 'common'], ['△ADB ≡ △ADC', 'RHS']] }),
  };

  function eucCongruence() {
    const v = R(0, 2);
    const test = pick(Object.keys(CONG)), c = CONG[test]();
    if (v === 0) {
      const opts = shuffle(['SSS', 'SAS', 'AAS', 'RHS']).map(t => ({ tex: t, ok: t === test }));
      return { type: 'mc', options: opts,
        prompt: c.fig + `${c.info} Which test proves $\\triangle ${c.tri[0]}\\equiv\\triangle ${c.tri[1]}$?`,
        hint: 'List the three equal parts you can justify (given, common, vert opp ∠s, alt ∠s). Then match the pattern: three sides, two sides with the angle between them, two angles and a side, or right angle, hypotenuse and side.',
        steps: c.rows.slice(0, 3).map(([s, r]) => `${s} (${r}).`).concat([`So $\\triangle ${c.tri[0]}\\equiv\\triangle ${c.tri[1]}$ (${test}).`]),
        ans: test, ansTex: `\\text{${test}}` };
    }
    if (v === 1) {
      const opts = shuffle(['AAA', 'SSS', 'SAS', 'RHS']).map(t => ({ tex: t, ok: t === 'AAA' }));
      return { type: 'mc', options: opts,
        prompt: FIG.tri(60, 50, { arcs: [['ABC', '60°'], ['ACB', '50°'], ['BAC', '70°']] }) +
          'Which of these is <b>not</b> a test for congruent triangles?',
        hint: 'Two triangles can have the same three angles and still be different sizes.',
        steps: ['Equal angles fix the shape but not the size, so AAA does not prove congruence.', 'SSS, SAS (included angle) and RHS are all valid tests.'],
        ans: 'AAA', ansTex: '\\text{AAA}' };
    }
    const st = c.rows.map(([s], i) => ['s' + (i + 1), s]);
    const rs = c.rows.map(([, r], i) => ['r' + (i + 1), r]);
    const distractS = test === 'RHS' ? 'BD = AB' : '∠A = ∠B';
    const distractR = test === 'SSS' ? 'AAA' : 'SSS';
    const uniqR = [...new Map(rs.map(([id, t]) => [t, id])).entries()].map(([t, id]) => [id, t]);
    return { type: 'geom',
      statements: statements(st.concat([['s9', distractS]])),
      reasons: reasons(uniqR.concat([['r9', distractR]])),
      chain: c.rows.map(([, r], i) => ({ statement: 's' + (i + 1), reason: uniqR.find(([, t]) => t === r)[0] })),
      prompt: c.fig + `${c.info} Prove that $\\triangle ${c.tri[0]}\\equiv\\triangle ${c.tri[1]}$. Add each statement with its reason, in order.`,
      hint: 'Write the three matching parts first, each with its reason, then the congruence with the name of the test.',
      steps: c.rows.map(([s, r]) => `${s} (${r}).`),
      ans: `${c.tri[0]} congruent ${c.tri[1]} (${test})`, ansTex: `\\triangle ${c.tri[0]}\\equiv\\triangle ${c.tri[1]}` };
  }

  function eucQuads() {
    const v = R(0, 2);
    if (v === 0) {
      const a = pick([58, 64, 72, 108, 112, 116, 124]);
      if (Math.random() < 0.5) {
        return angNum(a, FIG.para({ arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]], arcs: [['BAD', `${a}°`], ['DCB', '?']], skew: a > 90 ? -50 : 60 }) +
          `$ABCD$ is a parallelogram and $\\hat A=${deg(a)}$. Find $\\hat C$.`,
        'Opposite angles of a parallelogram are equal.',
        [`$\\hat C=\\hat A=${deg(a)}$ (opp ∠s of ||m).`]);
      }
      return angNum(180 - a, FIG.para({ arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]], arcs: [['BAD', `${a}°`], ['CBA', '?']], skew: a > 90 ? -50 : 60 }) +
        `$ABCD$ is a parallelogram and $\\hat A=${deg(a)}$. Find $\\hat B$.`,
      '$\\hat A$ and $\\hat B$ are co-interior angles between the parallel sides $AD$ and $BC$.',
      [`$\\hat B=180^\\circ-${deg(a)}=${deg(180 - a)}$ (co-int ∠s; $AD\\parallel BC$).`]);
    }
    if (v === 1) {
      const a = R(1, 4), x = R(3, 8), b = x + a, pr = 2 * (x + b);
      return lenNum(pr, FIG.para({ diag: 'T', names: { A: 'P', B: 'Q', C: 'R', D: 'S' }, arrows: [['AB', 1], ['DC', 1], ['AD', 2], ['BC', 2]] }) +
        `$PQRS$ is a parallelogram with diagonals meeting at $T$. $PT=2x+${a}$ cm and $TR=x+${b}$ cm. Find the length of $PR$.`,
      'The diagonals of a parallelogram bisect each other, so $PT=TR$.',
      [`$2x+${a}=x+${b}$ (diags of ||m).`, `$x=${x}$, so $PT=TR=${x + b}$ cm.`, `$PR=2\\times${x + b}=${pr}$ cm.`]);
    }
    const t = pick([22, 28, 32, 36, 38]);
    if (Math.random() < 0.5) {
      return angNum(90 - t, FIG.rhombus({ t, arcs: [['ABO', `${t}°`], ['BAO', '?']], rights: ['AOB'] }) +
        `$ABCD$ is a rhombus with diagonals meeting at $O$. $A\\hat BO=${deg(t)}$. Find $B\\hat AO$.`,
      'The diagonals of a rhombus cross at $90^\\circ$. Then use the angle sum in $\\triangle AOB$.',
      [`$A\\hat OB=90^\\circ$ (diags of rhombus).`, `$B\\hat AO=180^\\circ-90^\\circ-${deg(t)}=${deg(90 - t)}$ (sum of ∠s in △).`]);
    }
    return angNum(2 * t, FIG.rhombus({ t, arcs: [['ABO', `${t}°`], ['ADC', '?']] }) +
      `$ABCD$ is a rhombus with diagonals meeting at $O$. $A\\hat BO=${deg(t)}$. Find $A\\hat DC$.`,
    'A diagonal of a rhombus cuts the corner angles in half. A rhombus is a parallelogram, so opposite angles are equal.',
    [`$A\\hat BC=2\\times${deg(t)}=${deg(2 * t)}$ (diags of rhombus).`, `$A\\hat DC=A\\hat BC=${deg(2 * t)}$ (opp ∠s of ||m).`]);
  }

  function eucMidpoint() {
    const v = R(0, 2);
    if (v === 0) {
      const bc = pick([8, 10, 12, 14, 16, 18, 22]);
      return lenNum(bc / 2, FIG.midpoint() +
        `In $\\triangle ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$. $BC=${bc}$ cm. Find $DE$.`,
      'The segment joining the midpoints of two sides is parallel to the third side and half as long.',
      [`$DE=\\frac12 BC$ (midpt theorem).`, `$DE=\\frac12\\times${bc}=${bc / 2}$ cm.`]);
    }
    if (v === 1) {
      const b = pick([52, 58, 64, 68, 72]);
      return angNum(b, FIG.midpoint({ arcs: [['ABC', `${b}°`], ['ADE', '?']] }) +
        `In $\\triangle ABC$, $D$ and $E$ are the midpoints of $AB$ and $AC$. $A\\hat BC=${deg(b)}$. Find $A\\hat DE$.`,
      'First show $DE\\parallel BC$. Then $A\\hat DE$ and $A\\hat BC$ are corresponding angles.',
      [`$DE\\parallel BC$ (midpt theorem).`, `$A\\hat DE=A\\hat BC=${deg(b)}$ (corresp ∠s; $DE\\parallel BC$).`]);
    }
    const pt = pick([4, 5, 6, 7]), st = pick([3, 4, 5, 6]);
    const names = { A: 'P', B: 'Q', C: 'R', D: 'S', E: 'T' };
    if (Math.random() < 0.5) {
      return lenNum(2 * pt, FIG.midpoint({ names, noTicks: true, ticks: [['AD', 1], ['DB', 1]], arrows: [['DE', 1], ['BC', 1]] }) +
        `In $\\triangle PQR$, $S$ is the midpoint of $PQ$. A line through $S$ parallel to $QR$ meets $PR$ at $T$. $PT=${pt}$ cm. Find $PR$.`,
      'A line through the midpoint of one side, parallel to a second side, cuts the third side in half.',
      [`$PT=TR$ (converse midpt theorem).`, `$PR=2\\times${pt}=${2 * pt}$ cm.`]);
    }
    return lenNum(2 * st, FIG.midpoint({ names, noTicks: true, ticks: [['AD', 1], ['DB', 1]], arrows: [['DE', 1], ['BC', 1]] }) +
      `In $\\triangle PQR$, $S$ is the midpoint of $PQ$. A line through $S$ parallel to $QR$ meets $PR$ at $T$. $ST=${st}$ cm. Find $QR$.`,
    'First use the converse to show $T$ is the midpoint of $PR$. Then the midpoint theorem gives $ST=\\frac12 QR$.',
    [`$PT=TR$ (converse midpt theorem).`, `$ST=\\frac12 QR$ (midpt theorem).`, `$QR=2\\times${st}=${2 * st}$ cm.`]);
  }

  // The topic keeps its three knowledge points. Each one now teaches several
  // small steps, and its practice draws from those steps, weighted towards the
  // idea the knowledge point is named after.
  const EUC0 = [
    [eucAngles, eucParallel, eucTriangle, eucIsosceles, eucIsosceles],
    [eucCongruence, eucCongruence, eucQuads],
    [eucMidpoint],
  ];
  function genEucRevision(kp) {
    const k = wantKp(EUC0.length - 1, kp);
    const q = pick(EUC0[k])();
    q.genRev = 'euc0-v2';
    return q;
  }

  function genEucChords(kp) {
    const k = wantKp(1, kp);
    // radius 6, chord 8, distance from centre?  r^2 = d^2 + (half chord)^2, 36=d^2+16, d=sqrt20?
    const r = pick([5, 10, 13]), half = pick([3, 4, 5, 12]);
    if (half >= r) return genEucChords(kp);
    const d2 = r * r - half * half;
    const s = sqrtSimp(d2);
    if (k === 0) {
      const ans = s.inn === 1 ? String(s.out) : (s.out === 1 ? `sqrt(${s.inn})` : `${s.out}sqrt(${s.inn})`);
      const ansTex = s.inn === 1 ? String(s.out) : (s.out === 1 ? `\\sqrt{${s.inn}}` : `${s.out}\\sqrt{${s.inn}}`);
      const fig = svg(240, 200, C(120, 100, 70) + L(120, 100, 120, 100 + 40) + L(80, 140, 160, 140) +
        P(120, 100) + P(120, 140) + N(120, 92, 'O') + N(120, 152, 'M', 0) + N(80, 140, 'A') + N(160, 140, 'B'),
        'O is the centre, $OM\\perp AB$, $M$ on $AB$');
      return { type: 'num', exact: true, val: Math.sqrt(d2), ans, ansTex,
        prompt: fig + `O is the centre of a circle of radius $${r}$. Chord $AB=${2 * half}$ and $OM\\perp AB$ with $M$ on $AB$. Find $OM$.`,
        hint: 'The perpendicular from the centre to a chord bisects the chord. Then use Pythagoras in $\\triangle OMA$.',
        steps: [`$AM=\\frac12 AB=${half}$ (line from centre $\\perp$ to a chord bisects the chord).`, `$OM=\\sqrt{${r}^2-${half}^2}=${ansTex}$.`] };
    }
    // converse: M midpoint, conclude OM perp AB — geom chain
    return { type: 'geom',
      statements: statements([['s1', 'AM = MB'], ['s2', 'OM ⊥ AB'], ['s3', 'OA = OB'], ['s4', 'AB = OM']]),
      reasons: reasons([['r1', 'given'], ['r2', 'line from centre to midpt of chord'], ['r3', 'radii'], ['r4', 'vert opp ∠s']]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's3', reason: 'r3' }, { statement: 's2', reason: 'r2' }],
      prompt: svg(240, 200, C(120, 100, 70) + L(120, 100, 120, 140) + L(80, 140, 160, 140) +
        P(120, 100) + P(120, 140) + N(120, 92, 'O') + N(120, 155, 'M', 0) + N(80, 140, 'A') + N(160, 140, 'B'),
        'O is the centre and M is the midpoint of chord AB') +
        'O is the centre of the circle and $M$ is the midpoint of chord $AB$. Prove that $OM\\perp AB$. Write the chain in order.',
      hint: 'OA and OB are radii, so triangle OAB is isosceles, or use the theorem: the line from the centre to the midpoint of a chord is perpendicular to the chord.',
      steps: ['$AM=MB$ (given).', '$OA=OB$ (radii).', '$OM\\perp AB$ (line from the centre to the midpoint of a chord is perpendicular to the chord).'],
      ans: 'OM perp AB', ansTex: 'OM\\perp AB' };
  }

  function genEucCyclic(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const centre = pick([40, 50, 80, 100, 120]);
      const circ = centre / 2;
      const fig = svg(240, 200, C(120, 110, 70) + P(120, 110) + N(120, 100, 'O') +
        (() => {
          const A = pt(120, 110, 70, 110), B = pt(120, 110, 70, 20), C = pt(120, 110, 70, 250);
          return xy(pt(120, 110, 0, 0), A) + xy(pt(120, 110, 0, 0), B) + L(A.x, A.y, C.x, C.y) + L(B.x, B.y, C.x, C.y) +
            N(A.x, A.y, 'A', -10) + N(B.x, B.y, 'B', -10) + N(C.x, C.y, 'C', 16);
        })(),
        'O is the centre; A and B are on the circle');
      return { type: 'num', val: circ, ans: String(circ), ansTex: `${circ}^\\circ`, deg: true,
        prompt: fig + `$O$ is the centre of the circle and $\\hat{AOB}=${centre}^\\circ$. $C$ is a point on the circumference on the major arc. Find $\\hat{ACB}$.`,
        hint: 'The angle at the centre is twice the angle at the circumference, standing on the same arc.',
        steps: [`$\\hat{ACB}=\\frac12\\hat{AOB}=\\frac12\\times${centre}^\\circ=${circ}^\\circ$ ($\\angle$ at the centre $=2\\angle$ at the circumference, same arc $AB$).`] };
    }
    const opp = pick([70, 80, 85, 100, 110]);
    const other = 180 - opp;
    const fig = svg(240, 200, C(120, 110, 70) +
      (() => {
        const A = pt(120, 110, 70, 200), B = pt(120, 110, 70, 110), C = pt(120, 110, 70, 20), D = pt(120, 110, 70, 290);
        return L(A.x, A.y, B.x, B.y) + L(B.x, B.y, C.x, C.y) + L(C.x, C.y, D.x, D.y) + L(D.x, D.y, A.x, A.y) +
          N(A.x, A.y + 14, 'A', 0) + N(B.x + 10, B.y, 'B') + N(C.x, C.y - 10, 'C', 0) + N(D.x - 10, D.y, 'D');
      })(), 'ABCD is cyclic');
    return { type: 'geom',
      statements: statements([
        ['s1', 'ABCD is a cyclic quadrilateral'],
        ['s2', `∠A = ${opp}°`],
        ['s3', `∠C = ${other}°`],
        ['s4', `∠B = ${opp}°`],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'opp ∠s of cyclic quad'],
        ['r4', '∠ at the centre = 2∠ at the circumference'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `ABCD is a cyclic quadrilateral and $\\hat A=${opp}^\\circ$. Prove that $\\hat C=${other}^\\circ$.`,
      hint: 'Opposite angles of a cyclic quadrilateral are supplementary.',
      steps: [
        'ABCD is cyclic (given).',
        `$\\hat A=${opp}^\\circ$ (given).`,
        `$\\hat C=180^\\circ-${opp}^\\circ=${other}^\\circ$ (opp $\\angle$s of cyclic quad).`,
      ],
      ans: `${other} degrees`, ansTex: `${other}^\\circ` };
  }

  function genEucTanChord(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      return { type: 'num', val: 90, ans: '90', ansTex: '90^\\circ', deg: true,
        prompt: svg(240, 200, C(110, 110, 70) + P(110, 110) + N(110, 100, 'O') +
          L(110, 110, 180, 110) + L(180, 30, 180, 190) + P(180, 110) + N(190, 110, 'T') + N(190, 40, 'line'),
          'OT is a radius, the line is a tangent at T') +
          '$OT$ is a radius and the line is a tangent to the circle at $T$. Find $\\hat{OTP}$ if $P$ is a point on the tangent.',
        hint: 'A tangent is perpendicular to the radius at the point of contact.',
        steps: ['$OT\\perp$ tangent at $T$ (tangent $\\perp$ radius).', '$\\hat{OTP}=90^\\circ$.'] };
    }
    const alt = pick([30, 35, 40, 50, 55]);
    const fig = svg(250, 210, C(120, 120, 70) +
      (() => {
        const T = pt(120, 120, 70, 10), A = pt(120, 120, 70, 130), B = pt(120, 120, 70, 230);
        const tx1 = T.x + 40, ty1 = T.y - 80, tx2 = T.x - 30, ty2 = T.y + 60;
        return L(tx1, ty1, tx2, ty2) + L(T.x, T.y, A.x, A.y) + L(A.x, A.y, B.x, B.y) + L(B.x, B.y, T.x, T.y) +
          P(T.x, T.y) + P(A.x, A.y) + P(B.x, B.y) + N(T.x + 8, T.y, 'T') + N(A.x - 8, A.y, 'A') + N(B.x, B.y + 16, 'B', 0);
      })(), 'The line is a tangent at T; TA is a chord');
    return { type: 'geom',
      statements: statements([
        ['s1', 'The line is a tangent at T'],
        ['s2', `∠TBA = ${alt}°`],
        ['s3', `∠TAB = ${alt}°`],
        ['s4', 'OT ⊥ tangent at T'],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'tan-chord theorem'],
        ['r4', 'tan ⊥ radius'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `The line is a tangent at $T$ and $TA$ is a chord. The angle in the alternate segment $\\hat{TBA}=${alt}^\\circ$. Prove that $\\hat{TAB}=${alt}^\\circ$.`,
      hint: 'The tan-chord theorem: the angle between a tangent and a chord equals the angle in the alternate segment.',
      steps: [
        'The line is a tangent at $T$ (given).',
        `$\\hat{TBA}=${alt}^\\circ$ (given).`,
        `$\\hat{TAB}=${alt}^\\circ$ (tan-chord theorem).`,
      ],
      ans: `${alt} degrees`, ansTex: `${alt}^\\circ` };
  }

  function genEucProportion(kp) {
    const k = wantKp(1, kp);
    const AD = pick([3, 4, 5]), DB = pick([6, 8, 10]);
    const AE = pick([2, 3, 4]);
    if (AD === 0) return genEucProportion(kp);
    const EC = frac(AE * DB, AD);
    const fig = svg(260, 170,
      L(40, 150, 220, 150) + L(40, 150, 130, 30) + L(220, 150, 130, 30) +
      L(85, 90, 175, 90) +
      N(40, 160, 'B', 0) + N(220, 160, 'C', 0) + N(130, 22, 'A', 0) + N(75, 88, 'D') + N(185, 88, 'E'),
      '$DE\\parallel BC$');
    if (k === 0) {
      return { type: 'num', exact: true, val: EC.v, ans: EC.txt, ansTex: EC.tex,
        prompt: fig + `In $\\triangle ABC$, $DE\\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. $AD=${AD}$, $DB=${DB}$ and $AE=${AE}$. Find $EC$.`,
        hint: 'A line parallel to one side of a triangle divides the other two sides in the same ratio.',
        steps: [`$\\dfrac{AD}{DB}=\\dfrac{AE}{EC}$ ($DE\\parallel BC$, proportional intercepts).`, `$\\dfrac{${AD}}{${DB}}=\\dfrac{${AE}}{EC}$, so $EC=${EC.tex}$.`] };
    }
    return { type: 'geom',
      statements: statements([
        ['s1', 'D is on AB and E is on AC'],
        ['s2', 'AD/DB = AE/EC'],
        ['s3', 'DE ∥ BC'],
        ['s4', 'DE = ½ BC'],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'converse of proportional intercepts'],
        ['r4', 'midpoint theorem'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `In $\\triangle ABC$, $D$ is on $AB$ and $E$ is on $AC$ with $\\dfrac{AD}{DB}=\\dfrac{AE}{EC}$. Prove that $DE\\parallel BC$.`,
      hint: 'The converse of the proportional-intercepts theorem: if the sides are divided in the same ratio, then $DE\\parallel BC$.',
      steps: [
        '$D$ is on $AB$ and $E$ is on $AC$ (given).',
        '$\\dfrac{AD}{DB}=\\dfrac{AE}{EC}$ (given).',
        '$DE\\parallel BC$ (converse of proportional intercepts).',
      ],
      ans: 'DE // BC', ansTex: 'DE\\parallel BC' };
  }

  function genEucSimilar(kp) {
    const k = wantKp(1, kp);
    const fig = svg(260, 170,
      L(40, 150, 220, 150) + L(40, 150, 130, 30) + L(220, 150, 130, 30) + L(85, 90, 175, 90) +
      N(40, 160, 'B', 0) + N(220, 160, 'C', 0) + N(130, 22, 'A', 0) + N(75, 88, 'D') + N(185, 88, 'E'),
      '$DE\\parallel BC$');
    if (k === 0) {
      return { type: 'geom',
        statements: statements([
          ['s1', 'DE ∥ BC'],
          ['s2', '∠ADE = ∠ABC'],
          ['s3', '∠AED = ∠ACB'],
          ['s4', '△ADE ~ △ABC'],
        ]),
        reasons: reasons([
          ['r1', 'given'],
          ['r2', 'corr ∠s, DE ∥ BC'],
          ['r3', 'corr ∠s, DE ∥ BC'],
          ['r4', 'AAA similarity'],
        ]),
        chain: [
          { statement: 's1', reason: 'r1' },
          { statement: 's2', reason: 'r2' },
          { statement: 's3', reason: 'r3' },
          { statement: 's4', reason: 'r4' },
        ],
        prompt: fig + `In $\\triangle ABC$, $DE\\parallel BC$ with $D$ on $AB$ and $E$ on $AC$. Prove that $\\triangle ADE\\sim\\triangle ABC$.`,
        hint: 'Corresponding angles are equal because $DE\\parallel BC$. Then use AAA similarity.',
        steps: [
          '$DE\\parallel BC$ (given).',
          '$\\hat{ADE}=\\hat{ABC}$ (corr $\\angle$s, $DE\\parallel BC$).',
          '$\\hat{AED}=\\hat{ACB}$ (corr $\\angle$s, $DE\\parallel BC$).',
          '$\\triangle ADE\\sim\\triangle ABC$ (AAA).',
        ],
        ans: 'ADE ~ ABC', ansTex: '\\triangle ADE\\sim\\triangle ABC' };
    }
    const scale = pick([2, 3, 2]), small = pick([4, 5, 6]);
    const big = small * scale;
    return { type: 'num', val: big, ans: String(big), ansTex: String(big),
      prompt: fig + `$\\triangle ADE\\sim\\triangle ABC$ with scale factor $${scale}$ (from the smaller triangle to the larger). If $DE=${small}$, find $BC$.`,
      hint: 'Corresponding sides of similar triangles are in the same ratio.',
      steps: [`$\\dfrac{BC}{DE}=${scale}$, so $BC=${scale}\\times${small}=${big}$.`] };
  }

  function riderPrompt(title, fig, body) {
    return fig + body;
  }

  function genEucCircleRiders(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const centre = pick([80, 100, 120]), atCirc = centre / 2;
      const fig = svg(250, 210, C(120, 115, 70) + P(120, 115) + N(120, 105, 'O') +
        (() => {
          const A = pt(120, 115, 70, 20), B = pt(120, 115, 70, 160), C = pt(120, 115, 70, 250);
          return L(120, 115, A.x, A.y) + L(120, 115, B.x, B.y) + L(A.x, A.y, C.x, C.y) + L(B.x, B.y, C.x, C.y) +
            N(A.x + 8, A.y, 'A') + N(B.x - 8, B.y, 'B') + N(C.x, C.y + 14, 'C', 0);
        })(), 'O is the centre');
      return { type: 'geom',
        statements: statements([
          ['s1', 'O is the centre'],
          ['s2', `∠AOB = ${centre}°`],
          ['s3', `∠ACB = ${atCirc}°`],
          ['s4', `∠ACB = ${centre}°`],
        ]),
        reasons: reasons([
          ['r1', 'given'],
          ['r2', 'given'],
          ['r3', '∠ at the centre = 2∠ at the circumference'],
          ['r4', 'opp ∠s of cyclic quad'],
        ]),
        chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
        prompt: fig + `$O$ is the centre and $\\hat{AOB}=${centre}^\\circ$. $C$ lies on the major arc. Prove that $\\hat{ACB}=${atCirc}^\\circ$.`,
        hint: 'The angle at the centre is twice the angle at the circumference, standing on the same arc.',
        steps: [
          '$O$ is the centre (given).',
          `$\\hat{AOB}=${centre}^\\circ$ (given).`,
          `$\\hat{ACB}=\\frac12\\times${centre}^\\circ=${atCirc}^\\circ$ ($\\angle$ at the centre $=2\\angle$ at the circumference).`,
        ],
        ans: `${atCirc} degrees`, ansTex: `${atCirc}^\\circ` };
    }
    const a = pick([70, 80, 85]);
    const c = 180 - a;
    const fig = svg(240, 200, C(120, 110, 70) +
      (() => {
        const A = pt(120, 110, 70, 200), B = pt(120, 110, 70, 110), C = pt(120, 110, 70, 20), D = pt(120, 110, 70, 290);
        return L(A.x, A.y, B.x, B.y) + L(B.x, B.y, C.x, C.y) + L(C.x, C.y, D.x, D.y) + L(D.x, D.y, A.x, A.y) +
          N(A.x, A.y + 14, 'A', 0) + N(B.x + 10, B.y, 'B') + N(C.x, C.y - 10, 'C', 0) + N(D.x - 10, D.y, 'D');
      })(), 'ABCD is cyclic');
    return { type: 'geom',
      statements: statements([
        ['s1', 'ABCD is a cyclic quadrilateral'],
        ['s2', `∠A = ${a}°`],
        ['s3', `∠C = ${c}°`],
        ['s4', `∠C = ${a}°`],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'opp ∠s of cyclic quad'],
        ['r4', 'tan-chord theorem'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `In cyclic quadrilateral $ABCD$, $\\hat A=${a}^\\circ$. Prove that $\\hat C=${c}^\\circ$.`,
      hint: 'Opposite angles of a cyclic quadrilateral add to $180^\\circ$.',
      steps: [
        'ABCD is cyclic (given).',
        `$\\hat A=${a}^\\circ$ (given).`,
        `$\\hat C=180^\\circ-${a}^\\circ=${c}^\\circ$ (opp $\\angle$s of cyclic quad).`,
      ],
      ans: `${c} degrees`, ansTex: `${c}^\\circ` };
  }

  function genEucSimilarRiders(kp) {
    const k = wantKp(1, kp);
    const p = pick([4, 6, 8]), q = 2 * p, r = pick([3, 5, 6]);
    const unk = 2 * r;
    const fig = svg(260, 170,
      L(40, 150, 220, 150) + L(40, 150, 130, 30) + L(220, 150, 130, 30) + L(85, 90, 175, 90) +
      N(40, 160, 'B', 0) + N(220, 160, 'C', 0) + N(130, 22, 'A', 0) + N(75, 88, 'D') + N(185, 88, 'E'),
      '$DE\\parallel BC$');
    if (k === 0) {
      return { type: 'num', val: unk, ans: String(unk), ansTex: String(unk),
        prompt: fig + `$DE\\parallel BC$, $AD=${p}$, $AB=${q}$ and $DE=${r}$. Find $BC$.`,
        hint: '$\\triangle ADE\\sim\\triangle ABC$ (corresponding angles, $DE\\parallel BC$). Sides are in the ratio $AD/AB$.',
        steps: [`Scale factor $\\dfrac{AB}{AD}=\\dfrac{${q}}{${p}}=${q / p}$.`, `$BC=${q / p}\\times${r}=${unk}$.`] };
    }
    return { type: 'geom',
      statements: statements([
        ['s1', '△ADE ~ △ABC'],
        ['s2', 'AD/AB = 1/2'],
        ['s3', `DE = ${p}`],
        ['s4', 'DE ∥ BC'],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'corresponding sides of similar △s'],
        ['r4', 'midpoint theorem'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `$\\triangle ADE\\sim\\triangle ABC$ with $\\dfrac{AD}{AB}=\\dfrac{1}{2}$ and $BC=${unk}$. Prove that $DE=${p}$.`,
      hint: 'Corresponding sides of similar triangles are in the same ratio.',
      steps: [
        '$\\triangle ADE\\sim\\triangle ABC$ (given).',
        '$\\dfrac{AD}{AB}=\\dfrac{1}{2}$ (given).',
        `$DE=\\frac12\\times${unk}=${p}$ (corresponding sides of similar $\\triangle$s).`,
      ],
      ans: String(p), ansTex: String(p) };
  }

  function genEucMixed(kp) {
    const k = wantKp(1, kp);
    if (k === 0) {
      const alt = pick([28, 32, 36, 40]);
      const centre = 2 * alt;
      const fig = svg(250, 210, C(120, 120, 70) + P(120, 120) + N(120, 110, 'O') +
        (() => {
          const T = pt(120, 120, 70, 10), A = pt(120, 120, 70, 140), B = pt(120, 120, 70, 230);
          const tx1 = T.x + 40, ty1 = T.y - 80, tx2 = T.x - 30, ty2 = T.y + 60;
          return L(120, 120, T.x, T.y) + L(120, 120, A.x, A.y) + L(tx1, ty1, tx2, ty2) + L(T.x, T.y, A.x, A.y) +
            L(A.x, A.y, B.x, B.y) + L(B.x, B.y, T.x, T.y) +
            P(T.x, T.y) + P(A.x, A.y) + N(T.x + 8, T.y, 'T') + N(A.x - 8, A.y, 'A') + N(B.x, B.y + 16, 'B', 0);
        })(), 'The line is a tangent at T; O is the centre');
      return { type: 'geom',
        statements: statements([
          ['s1', 'The line is a tangent at T and O is the centre'],
          ['s2', `∠TOA = ${centre}°`],
          ['s3', `The angle in the alternate segment is ${alt}°`],
          ['s4', `The angle between the tangent and chord TA is ${alt}°`],
        ]),
        reasons: reasons([
          ['r1', 'given'],
          ['r2', 'given'],
          ['r3', '∠ at the centre = 2∠ at the circumference'],
          ['r4', 'tan-chord theorem'],
        ]),
        chain: [
          { statement: 's1', reason: 'r1' },
          { statement: 's2', reason: 'r2' },
          { statement: 's3', reason: 'r3' },
          { statement: 's4', reason: 'r4' },
        ],
        prompt: fig + `A tangent touches the circle at $T$. Chord $TA$ subtends $\\hat{TOA}=${centre}^\\circ$ at the centre $O$. Prove that the angle between the tangent and the chord $TA$ is $${alt}^\\circ$.`,
        hint: 'The angle at the circumference on the same arc is half the angle at the centre. The tan-chord theorem then equals that angle in the alternate segment.',
        steps: [
          'The line is a tangent at $T$ and $O$ is the centre (given).',
          `$\\hat{TOA}=${centre}^\\circ$ (given).`,
          `Angle in the alternate segment $=\\frac12\\times${centre}^\\circ=${alt}^\\circ$ ($\\angle$ at the centre $=2\\angle$ at the circumference).`,
          `Angle between tangent and chord $=${alt}^\\circ$ (tan-chord theorem).`,
        ],
        ans: `${alt} degrees`, ansTex: `${alt}^\\circ` };
    }
    const mid = pick([6, 8, 10]);
    const fig = svg(260, 170,
      L(40, 150, 220, 150) + L(40, 150, 130, 30) + L(220, 150, 130, 30) + L(85, 90, 175, 90) +
      N(40, 160, 'B', 0) + N(220, 160, 'C', 0) + N(130, 22, 'A', 0) + N(75, 88, 'D') + N(185, 88, 'E'),
      '$D$ and $E$ are midpoints');
    return { type: 'geom',
      statements: statements([
        ['s1', 'D and E are midpoints of AB and AC'],
        ['s2', `DE = ${mid}`],
        ['s3', `BC = ${2 * mid}`],
        ['s4', 'DE ⊥ BC'],
      ]),
      reasons: reasons([
        ['r1', 'given'],
        ['r2', 'given'],
        ['r3', 'midpoint theorem'],
        ['r4', 'tan ⊥ radius'],
      ]),
      chain: [{ statement: 's1', reason: 'r1' }, { statement: 's2', reason: 'r2' }, { statement: 's3', reason: 'r3' }],
      prompt: fig + `In $\\triangle ABC$, $D$ and $E$ are midpoints of $AB$ and $AC$, and $DE=${mid}$. Prove that $BC=${2 * mid}$.`,
      hint: 'The midpoint theorem: the segment joining the midpoints of two sides is parallel to the third side and half as long.',
      steps: [
        '$D$ and $E$ are midpoints of $AB$ and $AC$ (given).',
        `$DE=${mid}$ (given).`,
        `$BC=2\\times DE=${2 * mid}$ (midpoint theorem).`,
      ],
      ans: String(2 * mid), ansTex: String(2 * mid) };
  }

  const GENERATORS = {
    'seq-linear': genSeqLinear,
    'seq-quadratic': genSeqQuadratic,
    'seq-arithmetic': genSeqArithmetic,
    'seq-geometric': genSeqGeometric,
    'seq-infinite': genSeqInfinite,
    'seq-sum-proof': genSeqSumProof,
    'seq-mixed': genSeqMixed,
    'quad-k': genQuadK,
    'nature-of-roots': genNatureOfRoots,
    'simultaneous-nonlinear': genSimultaneousNonlinear,
    'growth-decay': genGrowthDecay,
    'nominal-effective': genNominalEffective,
    'annuity-fv': genAnnuityFv,
    'annuity-pv': genAnnuityPv,
    'finance-n': genFinanceN,
    'hyperbola': genHyperbola,
    'exp-graph': genExpGraph,
    'log-graph': genLogGraph,
    'cubic-graph': genCubicGraph,
    'avg-gradient': genAvgGradient,
    'first-principles': genFirstPrinciples,
    'power-rule': genPowerRule,
    'tangent-calc': genTangentCalc,
    'cubic-derivative': genCubicDerivative,
    'derivative-graph': genDerivativeGraph,
    'optimisation': genOptimisation,
    'venn': genVenn,
    'dep-indep': genDepIndep,
    'trees-tables': genTreesTables,
    'counting': genCounting,
    'word-arrangements': genWordArrangements,
    'count-prob': genCountProb,
    'five-number': genFiveNumber,
    'histograms': genHistograms,
    'variance-sd': genVarianceSd,
    'scatter-ls': genScatterLs,
    'correlation': genCorrelation,
    'midpoint-distance': genMidpointDistance,
    'inclination': genInclination,
    'tangents-circle': genTangentsCircle,
    'collinear-proof': genCollinearProof,
    'ageo-riders': genAgeoRiders,
    'area-rule': genAreaRule,
    'trig-graphs-deg': genTrigGraphsDeg,
    'reduction': genReduction,
    'general-solution': genGeneralSolution,
    'graph-intersections': genGraphIntersections,
    'trig-2d': genTrig2d,
    'trig-3d': genTrig3d,
    'euc-revision': genEucRevision,
    'euc-chords': genEucChords,
    'euc-cyclic': genEucCyclic,
    'euc-tan-chord': genEucTanChord,
    'euc-proportion': genEucProportion,
    'euc-similar': genEucSimilar,
    'euc-circle-riders': genEucCircleRiders,
    'euc-similar-riders': genEucSimilarRiders,
    'euc-mixed': genEucMixed,
  };
  const BRANCHED = Object.fromEntries(Object.entries(GENERATORS).map(([id, fn]) => {
    // peek max kp by convention: try wantKp range encoded in first line of each function is not available;
    // use a conservative 4 and let wantKp clamp. For coverage we set explicit counts below.
    return [id, 2];
  }));
  const BRANCHED_COUNTS = {
    'seq-linear': 3, 'seq-quadratic': 2, 'seq-arithmetic': 3, 'seq-geometric': 3,
    'seq-infinite': 2, 'seq-sum-proof': 2, 'seq-mixed': 2,
    'quad-k': 2, 'nature-of-roots': 3, 'simultaneous-nonlinear': 2,
    'growth-decay': 3, 'nominal-effective': 2, 'annuity-fv': 2, 'annuity-pv': 2, 'finance-n': 2,
    'hyperbola': 2, 'exp-graph': 2, 'log-graph': 2, 'cubic-graph': 2,
    'avg-gradient': 2, 'first-principles': 3, 'power-rule': 2, 'tangent-calc': 2,
    'cubic-derivative': 2, 'derivative-graph': 2, 'optimisation': 2,
    'venn': 2, 'dep-indep': 2, 'trees-tables': 2, 'counting': 2, 'word-arrangements': 2, 'count-prob': 2,
    'five-number': 2, 'histograms': 2, 'variance-sd': 2, 'scatter-ls': 2, 'correlation': 2,
    'midpoint-distance': 2, 'inclination': 2, 'tangents-circle': 2, 'collinear-proof': 2, 'ageo-riders': 2,
    'area-rule': 2, 'trig-graphs-deg': 2, 'reduction': 2, 'general-solution': 2, 'graph-intersections': 2,
    'trig-2d': 2, 'trig-3d': 2,
    'euc-revision': 3, 'euc-chords': 2, 'euc-cyclic': 2, 'euc-tan-chord': 2, 'euc-proportion': 2,
    'euc-similar': 2, 'euc-circle-riders': 2, 'euc-similar-riders': 2, 'euc-mixed': 2,
  };
  Object.assign(BRANCHED, BRANCHED_COUNTS);


  function attach(skm) {
    if (!skm) return;
    for (const [id, gen] of Object.entries(GENERATORS)) {
      if (skm[id]) skm[id].gen = gen;
      else skm[id] = { id, gen };
    }
  }

  const CapsGen = { GENERATORS, BRANCHED, attach, wantKp, FIG, GF, scene };
  if (typeof module !== 'undefined' && module.exports) module.exports = CapsGen;
  root.CapsGen = CapsGen;
})(typeof globalThis !== 'undefined' ? globalThis : this);
