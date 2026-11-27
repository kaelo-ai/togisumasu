'use strict';
// Curriculum metadata for staged knowledge points, key prerequisites and
// manual encompassing weights. Seeded idempotently into SQLite on startup.
// Knowledge-point names and splits are derived from existing notes and
// generator branches. No new question content is invented here.

const ALGEBRA_KPS = {
  'exp-int': [
    { name: 'Combine exponents of a common base', keyPrereq: null },
    { name: 'Negative exponents and signs', keyPrereq: null },
    { name: 'A power of a quotient', keyPrereq: null },
  ],
  'exp-rat': [
    { name: 'Positive rational exponents', keyPrereq: 'exp-int' },
    { name: 'Negative rational exponents', keyPrereq: 'exp-int' },
  ],
  'radicals': [
    { name: 'Simplify a radical', keyPrereq: 'exp-rat' },
    { name: 'Rationalise a monomial denominator', keyPrereq: 'exp-rat' },
    { name: 'Rationalise with a conjugate', keyPrereq: 'exp-rat' },
  ],
  'poly-mult': [
    { name: 'Distribute a monomial', keyPrereq: 'exp-int' },
    { name: 'Multiply two binomials', keyPrereq: 'exp-int' },
    { name: 'Multiply a binomial and a trinomial', keyPrereq: 'exp-int' },
  ],
  'factoring': [
    { name: 'Simple trinomials', keyPrereq: 'poly-mult' },
    { name: 'Trinomials with a leading coefficient', keyPrereq: 'poly-mult' },
    { name: 'Difference of squares', keyPrereq: 'poly-mult' },
    { name: 'A common factor then a trinomial', keyPrereq: 'poly-mult' },
  ],
  'rational-expr': [
    { name: 'Simplify a rational expression', keyPrereq: 'factoring' },
    { name: 'Multiply or divide rational expressions', keyPrereq: 'factoring' },
  ],
  'complex': [
    { name: 'Add and subtract complex numbers', keyPrereq: 'radicals' },
    { name: 'Multiply complex numbers', keyPrereq: 'radicals' },
    { name: 'Divide complex numbers', keyPrereq: 'radicals' },
  ],
  'linear-eq': [
    { name: 'Two-step linear equations', keyPrereq: null },
    { name: 'Variables on both sides and brackets', keyPrereq: null },
  ],
  'literal': [
    { name: 'Rearrange a formula for a given variable', keyPrereq: 'linear-eq' },
  ],
  'quad-factor': [
    { name: 'Solve a quadratic by factoring', keyPrereq: 'factoring' },
    { name: 'Equations that factor after a rearrangement', keyPrereq: 'factoring' },
  ],
  'complete-square': [
    { name: 'Complete the square and solve', keyPrereq: 'linear-eq' },
  ],
  'quad-formula': [
    { name: 'Apply the quadratic formula', keyPrereq: 'radicals' },
  ],
  'discriminant': [
    { name: 'Two distinct real roots', keyPrereq: 'quad-formula' },
    { name: 'A repeated real root', keyPrereq: 'quad-formula' },
    { name: 'No real roots', keyPrereq: 'quad-formula' },
  ],
  'radical-eq': [
    { name: 'Solve and check a radical equation', keyPrereq: 'quad-factor' },
  ],
  'abs-eq': [
    { name: 'Linear absolute-value equations', keyPrereq: 'linear-eq' },
    { name: 'Harder absolute-value equations', keyPrereq: 'linear-eq' },
  ],
  'linear-ineq': [
    { name: 'Solve a linear inequality', keyPrereq: 'linear-eq' },
  ],
  'poly-ineq': [
    { name: 'Solve a polynomial inequality', keyPrereq: 'quad-factor' },
  ],
  'abs-ineq': [
    { name: 'Solve an absolute-value inequality', keyPrereq: 'abs-eq' },
  ],
  'lines': [
    { name: 'Gradient and intercept form', keyPrereq: 'linear-eq' },
    { name: 'A line from two points or a condition', keyPrereq: 'linear-eq' },
  ],
  'circles': [
    { name: 'Equation of a circle', keyPrereq: 'lines' },
  ],
  'func-eval': [
    { name: 'Evaluate a linear or polynomial function', keyPrereq: null },
    { name: 'Evaluate a rational or piecewise function', keyPrereq: null },
    { name: 'Read a value from a description', keyPrereq: null },
  ],
  'domain': [
    { name: 'Domain of a polynomial or root', keyPrereq: 'func-eval' },
    { name: 'Domain of a rational function', keyPrereq: 'func-eval' },
    { name: 'Combined domain restrictions', keyPrereq: 'func-eval' },
  ],
  'composition': [
    { name: 'Compose two functions', keyPrereq: 'func-eval' },
    { name: 'Decompose or evaluate a composition', keyPrereq: 'func-eval' },
  ],
  'inverse': [
    { name: 'Find an inverse algebraically', keyPrereq: 'literal' },
    { name: 'Verify or restrict an inverse', keyPrereq: 'literal' },
    { name: 'Read an inverse from values', keyPrereq: 'func-eval' },
  ],
  'vertex': [
    { name: 'Vertex form and the turning point', keyPrereq: 'complete-square' },
  ],
  'transform': [
    { name: 'Shift, stretch and reflect a graph', keyPrereq: 'func-eval' },
  ],
  'asymptotes': [
    { name: 'Identify asymptotes', keyPrereq: 'rational-expr' },
    { name: 'Use asymptotes to sketch or describe', keyPrereq: 'rational-expr' },
  ],
  'remainder': [
    { name: 'Remainder and factor theorems', keyPrereq: 'poly-mult' },
  ],
  'zeros': [
    { name: 'Find the zeros of a polynomial', keyPrereq: 'factoring' },
    { name: 'Build a polynomial from its zeros', keyPrereq: 'factoring' },
  ],
  'log-eval': [
    { name: 'Logarithms of integer powers of the base', keyPrereq: 'exp-rat' },
    { name: 'Change of base', keyPrereq: 'exp-rat' },
    { name: 'Natural logs', keyPrereq: 'exp-rat' },
    { name: 'A fractional base', keyPrereq: 'exp-rat' },
  ],
  'log-props': [
    { name: 'Product and quotient laws', keyPrereq: 'log-eval' },
    { name: 'Power law and mixed expansions', keyPrereq: 'log-eval' },
    { name: 'Condense an expression into one log', keyPrereq: 'log-eval' },
  ],
  'exp-eq': [
    { name: 'Same-base exponential equations', keyPrereq: 'exp-int' },
    { name: 'Equations that need a log', keyPrereq: 'log-eval' },
    { name: 'Equations after a substitution', keyPrereq: 'exp-int' },
  ],
  'log-eq': [
    { name: 'Solve a logarithmic equation', keyPrereq: 'log-props' },
    { name: 'Equations with more than one log', keyPrereq: 'log-props' },
  ],
  'interest': [
    { name: 'Compound interest', keyPrereq: 'exp-eq' },
    { name: 'Continuous compounding', keyPrereq: 'exp-eq' },
    { name: 'Solve for time or the rate', keyPrereq: 'log-eval' },
  ],
  'systems': [
    { name: 'Solve a linear system', keyPrereq: 'linear-eq' },
  ],
  'deg-rad': [
    { name: 'Convert between degrees and radians', keyPrereq: null },
    { name: 'Arc length and related measures', keyPrereq: null },
  ],
  'unit-circle': [
    { name: 'Coordinates on the unit circle', keyPrereq: 'deg-rad' },
  ],
  'special-angles': [
    { name: 'Exact values of special angles', keyPrereq: 'unit-circle' },
    { name: 'Related angles and signs', keyPrereq: 'unit-circle' },
  ],
  'right-tri': [
    { name: 'Find the opposite from the hypotenuse', keyPrereq: 'special-angles' },
    { name: 'Find the adjacent from the hypotenuse', keyPrereq: 'special-angles' },
    { name: 'Find a side from tangent', keyPrereq: 'special-angles' },
    { name: 'Find the hypotenuse from sine', keyPrereq: 'special-angles' },
  ],
  'inv-trig': [
    { name: 'Evaluate an inverse trig expression', keyPrereq: 'special-angles' },
  ],
  'trig-graphs': [
    { name: 'Amplitude, period and shift', keyPrereq: 'special-angles' },
  ],
  'basic-identities': [
    { name: 'Reciprocal and Pythagorean identities', keyPrereq: 'special-angles' },
  ],
  'identities': [
    { name: 'Prove or simplify a trig identity', keyPrereq: 'basic-identities' },
  ],
  'sum-diff': [
    { name: 'Angle-sum and difference formulae', keyPrereq: 'basic-identities' },
  ],
  'double-angle': [
    { name: 'Double-angle formulae', keyPrereq: 'sum-diff' },
    { name: 'Half-angle or mixed double-angle work', keyPrereq: 'sum-diff' },
  ],
  'trig-eq': [
    { name: 'Solve a trig equation on an interval', keyPrereq: 'special-angles' },
  ],
  'oblique': [
    { name: 'Sine and cosine rules', keyPrereq: 'right-tri' },
    { name: 'The ambiguous case and applications', keyPrereq: 'right-tri' },
  ],
};

// Topic-level key prerequisites (used when a knowledge point does not name one).
// Multi-hop entries are the interesting case: the skill actually being used
// may sit behind the direct prerequisite.
const TOPIC_KEY_PREREQS = {
  'exp-rat': ['exp-int'],
  'radicals': ['exp-rat'],
  'poly-mult': ['exp-int'],
  'factoring': ['poly-mult'],
  'rational-expr': ['factoring'],
  'complex': ['radicals'],
  'literal': ['linear-eq'],
  'quad-factor': ['factoring'],
  'complete-square': ['linear-eq'],
  'quad-formula': ['radicals'],
  'discriminant': ['quad-formula'],
  'radical-eq': ['quad-factor'],
  'abs-eq': ['linear-eq'],
  'linear-ineq': ['linear-eq'],
  'poly-ineq': ['quad-factor'],
  'abs-ineq': ['abs-eq'],
  'lines': ['linear-eq'],
  'circles': ['lines'],
  'domain': ['func-eval'],
  'composition': ['func-eval'],
  'inverse': ['literal'],
  'vertex': ['complete-square'],
  'transform': ['func-eval'],
  'asymptotes': ['rational-expr'],
  'remainder': ['poly-mult'],
  'zeros': ['factoring'],
  'log-eval': ['exp-rat'],
  'log-props': ['log-eval'],
  'exp-eq': ['exp-int'],
  'log-eq': ['log-props'],
  'interest': ['exp-eq'],
  'systems': ['linear-eq'],
  'unit-circle': ['deg-rad'],
  'special-angles': ['unit-circle'],
  'right-tri': ['special-angles'],
  'inv-trig': ['special-angles'],
  'trig-graphs': ['special-angles'],
  'basic-identities': ['special-angles'],
  'identities': ['basic-identities'],
  'sum-diff': ['basic-identities'],
  'double-angle': ['sum-diff'],
  'trig-eq': ['special-angles'],
  'oblique': ['right-tri'],
  // CAPS-only (remediation still runs even when the topic is in fallback mode)
  'midpoint-distance': ['lines'],
  'growth-decay': ['exp-int'],
  'area-rule': ['oblique'],
  'quad-k': ['quad-factor'],
  'nature-of-roots': ['quad-formula'],
  'simultaneous-nonlinear': ['systems'],
  'seq-quadratic': ['seq-linear'],
  'seq-arithmetic': ['seq-linear'],
  'seq-geometric': ['seq-linear'],
  'seq-infinite': ['seq-geometric'],
  'seq-sum-proof': ['seq-arithmetic'],
  'seq-mixed': ['seq-arithmetic'],
  'hyperbola': ['transform'],
  'exp-graph': ['exp-int'],
  'log-graph': ['log-eval'],
  'cubic-graph': ['zeros'],
  'nominal-effective': ['growth-decay'],
  'annuity-fv': ['growth-decay'],
  'annuity-pv': ['annuity-fv'],
  'finance-n': ['log-eval'],
  'avg-gradient': ['lines'],
  'first-principles': ['avg-gradient'],
  'power-rule': ['first-principles'],
  'tangent-calc': ['power-rule'],
  'cubic-derivative': ['power-rule'],
  'derivative-graph': ['cubic-derivative'],
  'optimisation': ['cubic-derivative'],
  'dep-indep': ['venn'],
  'trees-tables': ['dep-indep'],
  'counting': ['venn'],
  'word-arrangements': ['counting'],
  'count-prob': ['counting'],
  'histograms': ['five-number'],
  'variance-sd': ['five-number'],
  'scatter-ls': ['lines'],
  'correlation': ['scatter-ls'],
  'inclination': ['lines'],
  'tangents-circle': ['circles'],
  'collinear-proof': ['midpoint-distance'],
  'ageo-riders': ['tangents-circle'],
  'trig-graphs-deg': ['special-angles'],
  'reduction': ['special-angles'],
  'general-solution': ['double-angle'],
  'graph-intersections': ['trig-graphs-deg'],
  'trig-2d': ['area-rule'],
  'trig-3d': ['trig-2d'],
  'euc-chords': ['euc-revision'],
  'euc-cyclic': ['euc-chords'],
  'euc-tan-chord': ['euc-cyclic'],
  'euc-proportion': ['euc-revision'],
  'euc-similar': ['euc-proportion'],
  'euc-circle-riders': ['euc-tan-chord'],
  'euc-similar-riders': ['euc-similar'],
  'euc-mixed': ['euc-circle-riders'],
};

// Manual encompassing weights (advanced → simpler). Only list edges that
// should not use the default direct-prerequisite weight.
const ENCOMPASSING = [
  // The quadratic formula always practises a square root of a discriminant.
  { from: 'quad-formula', to: 'radicals', weight: 0.9, source: 'manual' },
  { from: 'quad-formula', to: 'discriminant', weight: 0.6, source: 'manual' },
  // Completing the square is mostly linear rearrangement plus a square.
  { from: 'complete-square', to: 'linear-eq', weight: 0.85, source: 'manual' },
  { from: 'vertex', to: 'complete-square', weight: 0.8, source: 'manual' },
  { from: 'interest', to: 'exp-eq', weight: 0.85, source: 'manual' },
  { from: 'interest', to: 'log-eval', weight: 0.5, source: 'manual' },
  { from: 'log-eq', to: 'log-props', weight: 0.9, source: 'manual' },
  { from: 'identities', to: 'basic-identities', weight: 0.95, source: 'manual' },
  { from: 'double-angle', to: 'sum-diff', weight: 0.85, source: 'manual' },
  { from: 'trig-eq', to: 'special-angles', weight: 0.8, source: 'manual' },
  { from: 'zeros', to: 'factoring', weight: 0.85, source: 'manual' },
  { from: 'poly-ineq', to: 'quad-factor', weight: 0.8, source: 'manual' },
  { from: 'radical-eq', to: 'quad-factor', weight: 0.7, source: 'manual' },
  { from: 'oblique', to: 'right-tri', weight: 0.6, source: 'manual' },
  // CAPS finance and calculus use earlier skills implicitly.
  { from: 'annuity-fv', to: 'growth-decay', weight: 0.85, source: 'manual' },
  { from: 'annuity-pv', to: 'annuity-fv', weight: 0.8, source: 'manual' },
  { from: 'finance-n', to: 'log-eval', weight: 0.75, source: 'manual' },
  { from: 'first-principles', to: 'rational-expr', weight: 0.55, source: 'manual' },
  { from: 'tangent-calc', to: 'lines', weight: 0.7, source: 'manual' },
  { from: 'tangent-calc', to: 'power-rule', weight: 0.9, source: 'manual' },
];

// Generator branches that honour an optional knowledge-point index.
// Topics not listed still get staged lessons (one knowledge point, example
// then variants) when they have a generator; the bank is not filtered by KP.
const BRANCHED = {
  'exp-int': 3,
  'exp-rat': 2,
  'radicals': 3,
  'poly-mult': 3,
  'factoring': 4,
  'complex': 3,
  'discriminant': 3,
  'lines': 2,
  'func-eval': 3,
  'domain': 3,
  'inverse': 3,
  'log-eval': 4,
  'log-props': 3,
  'exp-eq': 3,
  'interest': 3,
  'right-tri': 4,
};

function kpId(topicId, position) {
  return topicId + '.kp' + position;
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lesson_kps (
      id         TEXT PRIMARY KEY,
      topic_id   TEXT NOT NULL,
      position   INTEGER NOT NULL,
      name       TEXT NOT NULL,
      key_prereq TEXT,
      staged     INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS lesson_kps_topic ON lesson_kps(topic_id, position);
    CREATE TABLE IF NOT EXISTS topic_key_prereqs (
      topic_id   TEXT NOT NULL,
      prereq_id  TEXT NOT NULL,
      kp_id      TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (topic_id, prereq_id, kp_id)
    );
    CREATE TABLE IF NOT EXISTS encompassing (
      from_id TEXT NOT NULL,
      to_id   TEXT NOT NULL,
      weight  REAL NOT NULL,
      source  TEXT NOT NULL DEFAULT 'manual',
      PRIMARY KEY (from_id, to_id)
    );
  `);
}

function seed(db) {
  schema(db);
  const topicIds = new Set(db.prepare('SELECT id FROM topics').all().map(r => r.id));
  const upsertKp = db.prepare(`
    INSERT INTO lesson_kps (id, topic_id, position, name, key_prereq, staged)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      key_prereq = excluded.key_prereq,
      staged = excluded.staged,
      position = excluded.position
  `);
  const delKp = db.prepare('DELETE FROM lesson_kps WHERE topic_id = ? AND id = ?');
  const existingKps = db.prepare('SELECT id, topic_id FROM lesson_kps').all();

  const wantKp = new Set();
  db.exec('BEGIN');
  try {
    for (const [topicId, kps] of Object.entries(ALGEBRA_KPS)) {
      if (!topicIds.has(topicId)) continue;
      kps.forEach((kp, i) => {
        const id = kpId(topicId, i);
        wantKp.add(id);
        const key = kp.keyPrereq && topicIds.has(kp.keyPrereq) ? kp.keyPrereq : null;
        upsertKp.run(id, topicId, i, kp.name, key);
      });
    }
    for (const row of existingKps) {
      if (row.id.startsWith('fallback:') ) continue;
      if (ALGEBRA_KPS[row.topic_id] && !wantKp.has(row.id)) delKp.run(row.topic_id, row.id);
    }

    db.prepare('DELETE FROM topic_key_prereqs').run();
    const insKey = db.prepare('INSERT OR IGNORE INTO topic_key_prereqs (topic_id, prereq_id, kp_id) VALUES (?, ?, ?)');
    for (const [topicId, pres] of Object.entries(TOPIC_KEY_PREREQS)) {
      if (!topicIds.has(topicId)) continue;
      for (const pre of pres) if (topicIds.has(pre)) insKey.run(topicId, pre, '');
    }
    for (const [topicId, kps] of Object.entries(ALGEBRA_KPS)) {
      if (!topicIds.has(topicId)) continue;
      kps.forEach((kp, i) => {
        if (kp.keyPrereq && topicIds.has(kp.keyPrereq)) insKey.run(topicId, kp.keyPrereq, kpId(topicId, i));
      });
    }

    const insEnc = db.prepare(`
      INSERT INTO encompassing (from_id, to_id, weight, source) VALUES (?, ?, ?, ?)
      ON CONFLICT(from_id, to_id) DO UPDATE SET
        weight = excluded.weight,
        source = excluded.source
    `);
    for (const e of ENCOMPASSING) {
      if (!topicIds.has(e.from) || !topicIds.has(e.to)) continue;
      insEnc.run(e.from, e.to, e.weight, e.source || 'manual');
    }
  db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function coverage(db) {
  const topics = db.prepare('SELECT id, name, source FROM topics WHERE status = ?').all('active');
  const kps = db.prepare('SELECT topic_id, COUNT(*) AS n FROM lesson_kps GROUP BY topic_id').all();
  const kpCount = new Map(kps.map(r => [r.topic_id, r.n]));
  const core = require('./public/core.js');
  const hasGen = id => !!(core.SKM[id] && typeof core.SKM[id].gen === 'function');
  const staged = [];
  const fallback = [];
  for (const t of topics) {
    const n = kpCount.get(t.id) || 0;
    const gen = hasGen(t.id);
    if (gen && n >= 1) staged.push({ id: t.id, name: t.name, kps: n, branched: BRANCHED[t.id] || (n > 1 ? n : 0), gen: true });
    else fallback.push({ id: t.id, name: t.name, kps: n, gen, reason: gen ? 'no-kps' : 'no-generator' });
  }
  return {
    topicCount: topics.length,
    staged: staged.length,
    fallback: fallback.length,
    branched: staged.filter(s => (BRANCHED[s.id] || 0) > 1).length,
    stagedTopics: staged,
    gaps: fallback,
  };
}

function loadForCourse(db, topicIds) {
  const ids = new Set(topicIds);
  const kps = db.prepare('SELECT * FROM lesson_kps ORDER BY topic_id, position, id').all()
    .filter(r => ids.has(r.topic_id));
  const keys = db.prepare('SELECT * FROM topic_key_prereqs').all()
    .filter(r => ids.has(r.topic_id) && ids.has(r.prereq_id));
  const enc = db.prepare('SELECT * FROM encompassing').all()
    .filter(r => ids.has(r.from_id) && ids.has(r.to_id));
  const kpsBy = new Map();
  for (const k of kps) {
    const list = kpsBy.get(k.topic_id) || [];
    list.push({
      id: k.id,
      position: k.position,
      name: k.name,
      keyPrereq: k.key_prereq || null,
      staged: !!k.staged,
    });
    kpsBy.set(k.topic_id, list);
  }
  const keyBy = new Map();
  for (const k of keys) {
    if (k.kp_id) continue;
    const list = keyBy.get(k.topic_id) || [];
    list.push(k.prereq_id);
    keyBy.set(k.topic_id, list);
  }
  return {
    kpsBy,
    keyBy,
    encompassing: enc.map(e => ({ from: e.from_id, to: e.to_id, weight: e.weight, source: e.source })),
  };
}

module.exports = {
  ALGEBRA_KPS, TOPIC_KEY_PREREQS, ENCOMPASSING, BRANCHED,
  kpId, schema, seed, coverage, loadForCourse,
};
