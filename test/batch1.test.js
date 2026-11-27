'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const core = require('../public/core.js');
const Mastery = require('../public/mastery.js');
const CapsGen = require('../public/caps-gen.js');
const { CAPS_KPS } = require('../caps-kps.js');
const data = require('../mastery-data.js');
const questions = require('../questions.js');
const catalog = require('../catalog.js');

const CAPS_ONLY = [
  'seq-linear', 'midpoint-distance', 'euc-revision', 'growth-decay', 'five-number', 'venn', 'area-rule',
  'quad-k', 'nature-of-roots', 'simultaneous-nonlinear', 'seq-quadratic', 'seq-arithmetic', 'seq-geometric',
  'seq-infinite', 'seq-sum-proof', 'seq-mixed', 'hyperbola', 'exp-graph', 'log-graph', 'cubic-graph',
  'nominal-effective', 'annuity-fv', 'annuity-pv', 'finance-n', 'avg-gradient', 'first-principles',
  'power-rule', 'tangent-calc', 'cubic-derivative', 'derivative-graph', 'optimisation', 'dep-indep',
  'trees-tables', 'counting', 'word-arrangements', 'count-prob', 'histograms', 'variance-sd', 'scatter-ls',
  'correlation', 'inclination', 'tangents-circle', 'collinear-proof', 'ageo-riders', 'trig-graphs-deg',
  'reduction', 'general-solution', 'graph-intersections', 'trig-2d', 'trig-3d', 'euc-chords', 'euc-cyclic',
  'euc-tan-chord', 'euc-proportion', 'euc-similar', 'euc-circle-riders', 'euc-similar-riders', 'euc-mixed',
];

const GROUPS = {
  sequences: ['seq-linear', 'seq-quadratic', 'seq-arithmetic', 'seq-geometric', 'seq-infinite', 'seq-sum-proof', 'seq-mixed'],
  finance: ['growth-decay', 'nominal-effective', 'annuity-fv', 'annuity-pv', 'finance-n'],
  functions: ['quad-k', 'nature-of-roots', 'simultaneous-nonlinear', 'hyperbola', 'exp-graph', 'log-graph', 'cubic-graph'],
  calculus: ['avg-gradient', 'first-principles', 'power-rule', 'tangent-calc', 'cubic-derivative', 'derivative-graph', 'optimisation'],
  probability: ['venn', 'dep-indep', 'trees-tables', 'counting', 'word-arrangements', 'count-prob'],
  statistics: ['five-number', 'histograms', 'variance-sd', 'scatter-ls', 'correlation'],
  analytic: ['midpoint-distance', 'inclination', 'tangents-circle', 'collinear-proof', 'ageo-riders'],
  trigonometry: ['area-rule', 'trig-graphs-deg', 'reduction', 'general-solution', 'graph-intersections', 'trig-2d', 'trig-3d'],
  euclidean: ['euc-revision', 'euc-chords', 'euc-cyclic', 'euc-tan-chord', 'euc-proportion', 'euc-similar', 'euc-circle-riders', 'euc-similar-riders', 'euc-mixed'],
};

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (err) { results.push(['FAIL', name, err.message]); }
}

t('every CAPS-only topic has a generator and matching knowledge points', () => {
  assert.equal(Object.keys(CapsGen.GENERATORS).length, 58);
  assert.deepEqual(Object.keys(CapsGen.GENERATORS).sort(), [...CAPS_ONLY].sort());
  assert.deepEqual(Object.keys(CAPS_KPS).sort(), [...CAPS_ONLY].sort());
  for (const id of CAPS_ONLY) {
    assert.equal(typeof CapsGen.GENERATORS[id], 'function', id);
    const kps = CAPS_KPS[id];
    assert.ok(Array.isArray(kps) && kps.length >= 2, id);
    assert.equal(CapsGen.BRANCHED[id], kps.length, id + ' branched count');
    kps.forEach((kp, i) => assert.ok(kp.name, `${id} kp ${i} needs a name`));
  }
});

t('generated items for every knowledge point compute a checkable answer', () => {
  const partial = [];
  for (const id of CAPS_ONLY) {
    const nKp = CapsGen.BRANCHED[id];
    for (let kp = 0; kp < nKp; kp++) {
      let ok = 0, last = '';
      for (let i = 0; i < 6; i++) {
        try {
          const q = CapsGen.GENERATORS[id](kp);
          assert.ok(q && q.prompt && q.type && q.steps && q.steps.length, 'incomplete item');
          let inp;
          if (q.type === 'mc') inp = q.options.findIndex(o => o.ok);
          else if (q.type === 'geom') inp = q.chain;
          else if (q.type === 'fields') inp = q.fields.map(f => String(f.ans));
          else inp = q.ans;
          const r = core.check(q, inp);
          if (!r || !r.ok) throw new Error(r && r.err || 'check failed');
          questions.normalizeQuestion(q);
          ok++;
        } catch (err) {
          last = err.message;
        }
      }
      if (ok < 6) partial.push(`${id} kp${kp}: ${ok}/6 ${last}`);
    }
  }
  assert.equal(partial.length, 0, partial.join('; '));
});

t('geometry items use a statement-and-reason chain and draw a diagram in the prompt', () => {
  for (const id of GROUPS.euclidean) {
    const nKp = CapsGen.BRANCHED[id];
    let geom = 0, drawn = 0;
    // Knowledge points may mix item kinds, so sample each one a few times.
    for (let kp = 0; kp < nKp; kp++) for (let i = 0; i < 12; i++) {
      const q = CapsGen.GENERATORS[id](kp);
      if (/<svg/i.test(q.prompt || '')) drawn++;
      if (q.type === 'geom') {
        geom++;
        assert.ok(Array.isArray(q.chain) && q.chain.length >= 1, id);
        assert.ok(q.statements.length >= 2 && q.reasons.length >= 2, id);
        assert.ok(core.check(q, q.chain).ok, id + ' chain');
        questions.normalizeQuestion(q);
        assert.ok(/<svg/i.test(q.prompt), id + ' geom item draws the diagram in code');
      }
    }
    assert.ok(geom >= 1, id + ' needs a statement-and-reason knowledge point');
    assert.ok(drawn >= 1, id + ' needs a diagram drawn in code');
  }
});

t('daily XP weights useful work above easy mixed review, and GOAL is 30', () => {
  assert.equal(Mastery.GOAL, 30);
  assert.equal(Mastery.DAILY.goalXp, 30);
  const w = Mastery.DAILY.weights;
  assert.equal(w.new, 3);
  assert.equal(w.example, 1);
  assert.equal(w.repair, 3);
  assert.equal(w.shore, 3);
  assert.equal(w.quiz, 5);
  assert.equal(w.nsc, 5);
  assert.equal(w.review, 2);
  assert.equal(w.mixed, 1);
  assert.ok(w.quiz > w.new);
  assert.ok(w.new > w.review);
  assert.ok(w.review > w.mixed);
  const now = new Date(2026, 10, 27, 12).getTime();
  const day = '2026-11-27';
  let p = Mastery.emptyProgress();
  p = Mastery.applyAnswer(p, { id: 'a', ok: true, mode: 'mixed', now }, { topics: [{ id: 'a', pre: [], kps: [], fallback: true }] }).progress;
  assert.equal(p.log[day], w.mixed);
  p = Mastery.applyAnswer(p, { id: 'a', ok: true, mode: 'new', now }, { topics: [{ id: 'a', pre: [], kps: [], fallback: true }] }).progress;
  assert.equal(p.log[day], w.mixed + w.new);
  p = Mastery.markExampleSeen(p, 'a', now);
  assert.equal(p.log[day], w.mixed + w.new + w.example);
  p = Mastery.applyAnswer(p, { id: 'a', ok: false, mode: 'quiz', now }, { topics: [{ id: 'a', pre: [], kps: [], fallback: true }] }).progress;
  assert.equal(p.log[day], w.mixed + w.new + w.example, 'a miss does not add XP');
});

t('a path-blocking quiz can be deferred at most twice, or for two days', () => {
  const t0 = Date.UTC(2026, 10, 27, 8);
  let p = Mastery.noteQuizDue(Mastery.emptyProgress(), t0, true);
  assert.equal(Mastery.canDeferQuiz(p, t0), true);
  assert.equal(Mastery.mustTakeQuiz(p, t0, true), false);
  const d1 = Mastery.deferQuiz(p, t0);
  assert.equal(d1.ok, true);
  assert.equal(d1.remaining, 1);
  p = d1.progress;
  assert.equal(p.qz.defers, 1);
  assert.equal(p.qz.firstDueAt, t0);
  const d2 = Mastery.deferQuiz(p, t0 + Mastery.DAY);
  assert.equal(d2.ok, true);
  p = d2.progress;
  assert.equal(p.qz.defers, 2);
  const d3 = Mastery.deferQuiz(p, t0 + Mastery.DAY);
  assert.equal(d3.ok, false);
  assert.equal(Mastery.mustTakeQuiz(p, t0 + Mastery.DAY, true), true);
  // time limit, even with unused defers
  let q = Mastery.noteQuizDue(Mastery.emptyProgress(), t0, true);
  assert.equal(Mastery.canDeferQuiz(q, t0 + 2 * Mastery.DAY), false);
  assert.equal(Mastery.mustTakeQuiz(q, t0 + 2 * Mastery.DAY, true), true);
  q = Mastery.clearQuizDefer(p);
  assert.equal(q.qz.defers, 0);
  assert.equal(q.qz.firstDueAt, 0);
  assert.equal(Mastery.canDeferQuiz(q, t0), true);
});

t('recommended prefers in-progress work, then core exam topics by score', () => {
  const unlocked = [
    { id: 'supp', name: 'Side topic', core: false, coreScore: 10, inProgress: false },
    { id: 'core-low', name: 'Small core', core: true, coreScore: 30, inProgress: false },
    { id: 'core-high', name: 'Calculus', core: true, coreScore: 80, inProgress: false },
  ];
  assert.equal(Mastery.pickRecommended(unlocked).id, 'core-high');
  const withProgress = unlocked.concat([{ id: 'supp-open', name: 'Started side', core: false, coreScore: 8, inProgress: true }]);
  assert.equal(Mastery.pickRecommended(withProgress).id, 'supp-open');
  const twoOpen = [
    { id: 'a', core: true, coreScore: 40, inProgress: true },
    { id: 'b', core: true, coreScore: 90, inProgress: true },
    { id: 'c', core: false, coreScore: 5, inProgress: true },
  ];
  assert.equal(Mastery.pickRecommended(twoOpen).id, 'b');
});

t('tagCore closes under ancestors and scores by exam marks, later topics and NSC leaves', () => {
  const topics = [
    { id: 'found', unit: 'c0', pre: [] },
    { id: 'alg', unit: 'c1', pre: ['found'] },
    { id: 'calc', unit: 'c5', pre: ['alg'] },
    { id: 'side', unit: 'c4', pre: ['found'] },
  ];
  const tags = Mastery.tagCore(topics, { calc: 4, alg: 2, side: 0 });
  assert.ok(tags.get('calc').core, 'calculus unit (35) is seed-core');
  assert.ok(tags.get('alg').core, 'an ancestor of a core topic is core');
  assert.ok(tags.get('found').core, 'Unit 0 becomes core as an ancestor');
  assert.equal(tags.get('calc').unitMarks, 35);
  assert.equal(tags.get('calc').nsc, 4);
  assert.equal(tags.get('calc').score, 35 + 2 * 0 + 4);
  // a lone finance-weight topic with no descendants or leaves stays supplemental
  assert.equal(tags.get('side').core, false);
  assert.equal(tags.get('side').unitMarks, 15);
  assert.equal(tags.get('side').score, 15);
});

// Full catalog: coverage of the 58, core tags on the live graph
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-batch1-'));
const db = new DatabaseSync(path.join(dir, 't.sqlite'));
catalog.init(db);

t('the CAPS course stages all 58 topics and coverage has no generator gaps among them', () => {
  const course = catalog.learner(db, 'gr12-caps');
  assert.ok(course.daily && course.daily.goalXp === 30);
  assert.ok(course.core && course.core.threshold === 28);
  const byId = new Map(course.topics.map(t => [t.id, t]));
  const missing = [];
  const unstaged = [];
  for (const id of CAPS_ONLY) {
    const tpc = byId.get(id);
    if (!tpc) { missing.push(id); continue; }
    if (tpc.fallback || !tpc.staged || !tpc.kps || tpc.kps.length < 2) unstaged.push(id);
  }
  assert.equal(missing.length, 0, 'missing from catalog: ' + missing.join(', '));
  assert.equal(unstaged.length, 0, 'not staged: ' + unstaged.join(', '));
  const cov = data.coverage(db);
  const capsGaps = cov.gaps.filter(g => CAPS_ONLY.includes(g.id));
  assert.equal(capsGaps.length, 0, capsGaps.map(g => g.id + ':' + g.reason).join(', '));
});

t('core tags on the CAPS course cover calculus and Euclidean geometry, including Unit 0 ancestors', () => {
  const course = catalog.learner(db, 'gr12-caps');
  const byId = new Map(course.topics.map(t => [t.id, t]));
  for (const id of ['power-rule', 'tangent-calc', 'euc-chords', 'euc-cyclic', 'seq-arithmetic']) {
    assert.ok(byId.get(id) && byId.get(id).core, id + ' should be core');
  }
  const unit0 = course.topics.filter(t => t.unit === 'c0');
  assert.ok(unit0.some(t => t.core), 'some Unit 0 foundations are core as ancestors');
  // ancestor closure
  for (const tpc of course.topics) {
    if (!tpc.core) continue;
    for (const pre of tpc.pre || []) {
      const p = byId.get(pre);
      assert.ok(p && p.core, `${pre} must be core because ${tpc.id} is`);
    }
  }
  const coreN = course.topics.filter(t => t.core).length;
  const suppN = course.topics.filter(t => !t.core).length;
  assert.ok(coreN > suppN, `core (${coreN}) should outnumber supplemental (${suppN}) on the exam-facing course`);
});

t('coverage by topic group is complete', () => {
  const course = catalog.learner(db, 'gr12-caps');
  const ids = new Set(course.topics.filter(t => t.staged).map(t => t.id));
  for (const [group, list] of Object.entries(GROUPS)) {
    const missing = list.filter(id => !ids.has(id));
    assert.equal(missing.length, 0, group + ': ' + missing.join(', '));
  }
  const listed = new Set(Object.values(GROUPS).flat());
  assert.equal(listed.size, 58);
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' + r[1] : '  FAIL  ' + r[1] + ' — ' + r[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
db.close();
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
if (failed.length) process.exit(1);
