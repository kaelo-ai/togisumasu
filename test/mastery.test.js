'use strict';
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const Mastery = require('../public/mastery.js');
const data = require('../mastery-data.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const { DAY, INT, FIRE, LESSON } = Mastery;

function catalog() {
  const topics = [
    { id: 'a', name: 'Adding', pre: [], kps: [{ id: 'a.kp0', position: 0, name: 'Add', staged: true }], keyPrereqs: [] },
    { id: 'b', name: 'Multiplying', pre: ['a'], kps: [
      { id: 'b.kp0', position: 0, name: 'Times tables', keyPrereq: 'a', staged: true },
      { id: 'b.kp1', position: 1, name: 'Two-digit multiplication', keyPrereq: 'a', staged: true },
    ], keyPrereqs: ['a'] },
    { id: 'c', name: 'Long multiplication', pre: ['b'], kps: [
      { id: 'c.kp0', position: 0, name: 'The standard algorithm', keyPrereq: 'a', staged: true },
    ], keyPrereqs: ['b'] },
    { id: 'd', name: 'Fallback topic', pre: ['a'], kps: [], fallback: true, keyPrereqs: [] },
  ];
  return { topics };
}

function mastered(id, lv, due) {
  return { a: 6, c: 6, s: 0, lv, due };
}

function start(skills) {
  const p = Mastery.emptyProgress();
  p.skills = { ...skills };
  return p;
}

t('FIRe success on an advanced topic pushes a mastered ancestor later', () => {
  const now = 1_000_000_000_000;
  const due = now + 0.5 * DAY;
  let p = start({ a: mastered('a', 2, due), c: mastered('c', 2, now) });
  const out = Mastery.applyFire(p, 'c', true, now, catalog(), { early: false });
  const next = out.progress.skills.a.due;
  assert.ok(next > due, 'due date should move later');
  const weight = FIRE.directWeight * FIRE.directWeight * FIRE.hopDecay; // c→b→a, two default hops
  const expectedCredit = weight * FIRE.creditScale * (INT[2] * DAY);
  const cap = now + FIRE.maxHorizonIntervals * INT[2] * DAY;
  const expected = Math.min(due + expectedCredit, cap);
  assert.ok(Math.abs(next - expected) < 1, `got ${next - due}, want ${expected - due}`);
  assert.equal(out.progress.skills.c.due, now, 'answered topic itself is unchanged by FIRe');
});

t('FIRe path weights decay and drop below minWeight', () => {
  const edges = Mastery.edgeMap(catalog());
  const down = Mastery.weightsDown(edges, 'c');
  assert.ok(down.get('b') >= FIRE.minWeight, 'direct child is credited');
  assert.ok(down.get('a') > 0 && down.get('a') < down.get('b'), 'grandparent is weaker');
  assert.ok(!down.has('d'), 'unrelated topic is not credited');
});

t('FIRe failure pulls a mastered descendant earlier, not the ancestors', () => {
  const now = 2_000_000_000_000;
  const dueA = now + 3 * DAY;
  const dueC = now + 7 * DAY;
  let p = start({ a: mastered('a', 3, dueA), c: mastered('c', 3, dueC) });
  const out = Mastery.applyFire(p, 'a', false, now, catalog(), { early: false });
  assert.equal(out.progress.skills.a.due, dueA, 'failed topic is not moved by FIRe');
  assert.ok(out.progress.skills.c.due < dueC, 'advanced topic that encompasses a is pulled in');
  assert.ok(out.progress.skills.c.due >= now, 'penalty never goes earlier than now');
  assert.equal(out.progress.skills.c.lv, 3, 'implicit penalty does not change the level');
  assert.ok(!out.progress.skills.c.fix, 'implicit penalty does not start a repair');
});

t('FIRe early-review credit is discounted', () => {
  const now = 3_000_000_000_000;
  const due = now + 0.5 * DAY;
  const p = start({ a: mastered('a', 2, due), b: mastered('b', 2, now + 10 * DAY) });
  const full = Mastery.applyFire(p, 'b', true, now, catalog(), { early: false });
  const early = Mastery.applyFire(p, 'b', true, now, catalog(), { early: true });
  const fullDelta = full.progress.skills.a.due - due;
  const earlyDelta = early.progress.skills.a.due - due;
  assert.ok(Math.abs(earlyDelta - fullDelta * FIRE.earlyCredit) < 1);
});

t('FIRe does not move unmastered or in-repair topics', () => {
  const now = 4_000_000_000_000;
  const p = start({
    a: { a: 2, c: 1, s: 1, lv: 0, due: 0 },
    b: { a: 8, c: 6, s: 0, lv: 2, due: now + 3 * DAY, fix: 1 },
    c: mastered('c', 2, now),
  });
  const out = Mastery.applyFire(p, 'c', true, now, catalog(), { early: false });
  assert.equal(out.progress.skills.a.due, 0);
  assert.equal(out.progress.skills.b.due, now + 3 * DAY);
});

t('manual encompassing weights override the default', () => {
  const cat = catalog();
  cat.encompassing = [{ from: 'c', to: 'a', weight: 1, source: 'manual' }];
  const down = Mastery.weightsDown(Mastery.edgeMap(cat), 'c');
  assert.equal(down.get('a'), 1);
});

t('applyAnswer is deterministic for the same inputs', () => {
  const now = 5_000_000_000_000;
  const p = start({ a: mastered('a', 2, now + 3 * DAY), b: mastered('b', 2, now) });
  const one = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'review', now }, catalog());
  const two = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'review', now }, catalog());
  assert.deepEqual(one.progress.skills, two.progress.skills);
});

t('two failed repairs queue a review of the key prerequisite', () => {
  const now = 6_000_000_000_000;
  let p = start({
    a: mastered('a', 3, now + 10 * DAY),
    b: { a: 10, c: 8, s: 0, lv: 2, due: now, fix: 1 },
  });
  const first = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'repair', now }, catalog());
  assert.equal(first.event.k, 'repairing');
  assert.ok(!(first.progress.shore || []).length);
  const second = Mastery.applyAnswer(first.progress, { id: 'b', ok: false, mode: 'repair', now: now + 1 }, catalog());
  assert.equal(second.event.k, 'shore');
  assert.ok(second.event.shore.some(s => s.id === 'a'));
  assert.equal(second.progress.skills.a.due, now + 1);
  assert.ok((second.progress.shore || []).some(s => s.id === 'a'));
});

t('two failures on the same knowledge point queue its key prerequisite', () => {
  const now = 7_000_000_000_000;
  let p = start({
    a: mastered('a', 2, now + 5 * DAY),
    b: { a: 1, c: 0, s: 0, lv: 0, due: 0, kp: 0 },
  });
  const first = Mastery.applyAnswer(p, { id: 'b', ok: false, mode: 'practice', now }, catalog());
  assert.ok(!first.event || first.event.k !== 'shore');
  const second = Mastery.applyAnswer(first.progress, { id: 'b', ok: false, mode: 'practice', now: now + 1 }, catalog());
  assert.equal(second.event.k, 'shore');
  assert.ok(second.event.shore.some(s => s.id === 'a'));
});

t('fallback topics still need three in a row, and use direct prereqs when no key is set', () => {
  const now = 8_000_000_000_000;
  let p = start({
    a: mastered('a', 2, now + 5 * DAY),
    d: { a: 0, c: 0, s: 0, lv: 0, due: 0 },
  });
  p = Mastery.applyAnswer(p, { id: 'd', ok: true, mode: 'practice', now }, catalog()).progress;
  p = Mastery.applyAnswer(p, { id: 'd', ok: true, mode: 'practice', now }, catalog()).progress;
  assert.equal(p.skills.d.lv, 0);
  p = Mastery.applyAnswer(p, { id: 'd', ok: true, mode: 'practice', now }, catalog()).progress;
  assert.equal(p.skills.d.lv, 1);
  // d has no keyPrereqs, so a failed repair falls back to direct prereq a
  p = Mastery.writeSkill(p, 'd', { ...Mastery.skillOf(p, 'd'), fix: 1, s: 0, repairFails: 0 });
  p = Mastery.applyAnswer(p, { id: 'd', ok: false, mode: 'repair', now }, catalog()).progress;
  const ev = Mastery.applyAnswer(p, { id: 'd', ok: false, mode: 'repair', now }, catalog());
  assert.equal(ev.event.k, 'shore');
  assert.ok(ev.event.shore.some(s => s.id === 'a'));
});

t('a staged topic is not mastered by passing only the easy knowledge point', () => {
  const now = 9_000_000_000_000;
  let p = start({ a: mastered('a', 1, now + DAY), b: { a: 0, c: 0, s: 0, lv: 0, due: 0 } });
  let ev;
  for (let i = 0; i < LESSON.passCount; i++) {
    ev = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'practice', now }, catalog());
    p = ev.progress;
  }
  assert.equal(ev.event.k, 'kp-passed');
  const mid = Mastery.skillOf(p, 'b');
  assert.equal(mid.lv, 0);
  assert.equal(mid.kp, 1);
  assert.equal(mid.kpS, 0);
  assert.equal(Mastery.exampleDue(p, 'b', catalog()), true, 'the next knowledge point starts with a worked example');
  for (let i = 0; i < LESSON.passCount; i++) {
    ev = Mastery.applyAnswer(p, { id: 'b', ok: true, mode: 'practice', now }, catalog());
    p = ev.progress;
  }
  assert.equal(ev.event.k, 'mastered');
  assert.equal(p.skills.b.lv, 1);
});

t('a worked example is due at the start of each knowledge point and is not scored', () => {
  let p = start({ b: { a: 0, c: 0, s: 0, lv: 0, due: 0 } });
  assert.equal(Mastery.exampleDue(p, 'b', catalog()), true);
  p = Mastery.markExampleSeen(p, 'b');
  assert.equal(Mastery.exampleDue(p, 'b', catalog()), false);
  assert.equal(Mastery.skillOf(p, 'b').a, 0);
  assert.equal(Mastery.currentKp(p, 'b', catalog()).position, 0);
});

t('existing progress without new fields still records a review', () => {
  const now = 10_000_000_000_000;
  const p = start({ a: { a: 5, c: 5, s: 0, lv: 2, due: now } });
  const out = Mastery.applyAnswer(p, { id: 'a', ok: true, mode: 'review', now }, catalog());
  assert.equal(out.event.k, 'reviewed');
  assert.equal(out.progress.skills.a.lv, 3);
});

t('FIRE parameters live in one config object with documented keys', () => {
  for (const key of ['directWeight', 'hopDecay', 'minWeight', 'creditScale', 'penaltyScale', 'earlyCredit', 'maxHorizonIntervals']) {
    assert.equal(typeof FIRE[key], 'number', key);
  }
  assert.ok(FIRE.directWeight > 0 && FIRE.directWeight <= 1);
  assert.ok(FIRE.minWeight < FIRE.directWeight);
});

// --- seed / coverage against a small database ---
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-mastery-'));
const db = new DatabaseSync(path.join(dir, 't.sqlite'));
db.exec(`
  CREATE TABLE topics (id TEXT PRIMARY KEY, name TEXT, source TEXT, status TEXT);
`);
for (const id of Object.keys(data.ALGEBRA_KPS)) {
  db.prepare('INSERT INTO topics (id, name, source, status) VALUES (?, ?, ?, ?)').run(id, id, 'builtin', 'active');
}
db.prepare('INSERT INTO topics (id, name, source, status) VALUES (?, ?, ?, ?)').run('seq-linear', 'Linear sequences', 'caps', 'active');
data.seed(db);
data.seed(db); // idempotent

t('lesson KP seed is idempotent and covers every algebra topic', () => {
  const n1 = db.prepare('SELECT COUNT(*) AS n FROM lesson_kps').get().n;
  data.seed(db);
  const n2 = db.prepare('SELECT COUNT(*) AS n FROM lesson_kps').get().n;
  assert.equal(n1, n2);
  for (const [id, kps] of Object.entries(data.ALGEBRA_KPS)) {
    const n = db.prepare('SELECT COUNT(*) AS n FROM lesson_kps WHERE topic_id = ?').get(id).n;
    assert.equal(n, kps.length, id);
  }
});

t('coverage stages algebra topics and CAPS topics that now have generators', () => {
  const cov = data.coverage(db);
  assert.ok(cov.staged >= 47, 'algebra topics with generators are staged');
  const seq = cov.stagedTopics.find(s => s.id === 'seq-linear');
  assert.ok(seq && seq.gen && seq.kps >= 2, 'seq-linear is staged with a generator and knowledge points');
  assert.ok(!cov.gaps.some(g => g.id === 'seq-linear'));
});

t('key prereq for the quadratic formula is radicals, a possibly multi-hop skill', () => {
  const row = db.prepare('SELECT * FROM topic_key_prereqs WHERE topic_id = ? AND kp_id = ?').get('quad-formula', '')
    || db.prepare('SELECT * FROM topic_key_prereqs WHERE topic_id = ?').get('quad-formula');
  assert.ok(row);
  assert.equal(row.prereq_id, 'radicals');
});


t('course accuracy and answered counts only skills in the current catalog', () => {
  const p = start({
    a: { a: 10, c: 8, s: 0, lv: 1, due: 1 },
    b: { a: 4, c: 2, s: 0, lv: 0, due: 0 },
    outsider: { a: 100, c: 90, s: 0, lv: 1, due: 1 },
  });
  const stats = Mastery.courseAnswerStats(p, catalog());
  assert.equal(stats.answered, 14);
  assert.equal(stats.correct, 10);
  const other = Mastery.courseAnswerStats(p, { topics: [{ id: 'outsider', pre: [] }, { id: 'missing', pre: [] }] });
  assert.equal(other.answered, 100);
  assert.equal(other.correct, 90);
});

t('a due quiz in one course does not come due or block another course', () => {
  const now = 4_000_000_000_000;
  const algebra = {
    courseId: 'algebra',
    topics: [
      { id: 't1', pre: [] },
      { id: 't2', pre: [] },
      { id: 'shared', pre: [] },
    ],
  };
  const caps = {
    courseId: 'gr12-caps',
    topics: [
      { id: 't1', pre: [] },
      { id: 'shared', pre: [] },
      { id: 't3', pre: [] },
    ],
  };
  let p = start({
    t1: mastered('t1', 1, now + DAY),
    t2: mastered('t2', 1, now + DAY),
    shared: mastered('shared', 1, now + DAY),
    t3: mastered('t3', 1, now + DAY),
  });
  p = Mastery.markQuizRecent(p, 't1', 'algebra');
  p = Mastery.markQuizRecent(p, 'shared', 'algebra');
  assert.equal(Mastery.quizIsDue(p, 'algebra', now, algebra), true);
  assert.equal(Mastery.quizIsDue(p, 'gr12-caps', now, caps), false);
  assert.deepEqual(Mastery.quizState(p, 'algebra').recent, ['t1', 'shared']);
  assert.deepEqual(Mastery.quizState(p, 'gr12-caps').recent, []);
  assert.deepEqual(p.qz.recent, ['t1', 'shared']);
});

t('a legacy global quiz due flag is treated as algebra only', () => {
  const now = 5_000_000_000_000;
  const algebra = { courseId: 'algebra', topics: [{ id: 't1', pre: [] }, { id: 't2', pre: [] }, { id: 'shared', pre: [] }] };
  const caps = { courseId: 'gr12-caps', topics: [{ id: 't1', pre: [] }, { id: 'shared', pre: [] }, { id: 't3', pre: [] }] };
  const p = start({
    t1: mastered('t1', 1, now + DAY),
    t2: mastered('t2', 1, now + DAY),
    shared: mastered('shared', 1, now + DAY),
    t3: mastered('t3', 1, now + DAY),
  });
  p.qz = { recent: ['t1', 'shared'], last: 0, hist: [{ t: 1, score: 2, n: 5 }] };
  assert.ok(!p.qzByCourse || !p.qzByCourse.algebra);
  assert.equal(Mastery.quizIsDue(p, 'algebra', now, algebra), true);
  assert.equal(Mastery.quizIsDue(p, 'gr12-caps', now, caps), false);
  assert.deepEqual(Mastery.quizState(p, 'algebra').recent, ['t1', 'shared']);
  assert.deepEqual(Mastery.quizState(p, 'gr12-caps').recent, []);
  assert.equal(Mastery.quizState(p, 'algebra').hist.length, 1);
});

t('mastering a topic records the quiz recent list on that course only', () => {
  const now = 6_000_000_000_000;
  const caps = { courseId: 'gr12-caps', topics: [{ id: 'd', pre: ['a'], kps: [], fallback: true }] };
  let p = start({
    d: { a: 2, c: 2, s: 2, lv: 0, due: 0 },
  });
  p = Mastery.applyAnswer(p, { id: 'd', ok: true, mode: 'practice', now }, caps).progress;
  assert.equal(Mastery.skillOf(p, 'd').lv, 1);
  assert.deepEqual(Mastery.quizState(p, 'gr12-caps').recent, ['d']);
  assert.deepEqual(Mastery.quizState(p, 'algebra').recent, []);
  assert.deepEqual((p.qz || {}).recent || [], []);
});

t('a topic mastered in one course is held when this course is missing a prerequisite', () => {
  const algebra = {
    courseId: 'algebra',
    topics: [
      { id: 'base', pre: [] },
      { id: 'mid', pre: ['base'] },
      { id: 'top', pre: ['mid'] },
    ],
  };
  const caps = {
    courseId: 'gr12-caps',
    topics: [
      { id: 'top', pre: [] },
      { id: 'other', pre: [] },
    ],
  };
  const p = start({
    top: mastered('top', 2, 1),
  });
  assert.equal(Mastery.skillOf(p, 'top').lv, 2);
  assert.equal(Mastery.isCourseMastered(p, 'top', algebra), false);
  assert.deepEqual(Mastery.missingCoursePrereqs(p, 'top', algebra), ['mid']);
  assert.equal(Mastery.isCourseMastered(p, 'top', caps), true);
  assert.ok(!Mastery.courseMasteredIds(p, algebra).includes('top'));
  assert.ok(Mastery.courseMasteredIds(p, caps).includes('top'));
  assert.deepEqual(Mastery.holdingPrereqIds(p, algebra), ['mid']);
  const rec = Mastery.pickRecommended([
    { id: 'side', name: 'Side', core: true, coreScore: 99, inProgress: false, holds: false },
    { id: 'mid', name: 'Mid', core: false, coreScore: 1, inProgress: false, holds: true },
  ]);
  assert.equal(rec.id, 'mid');
  assert.equal(Mastery.skillOf(p, 'top').lv, 2, 'shared mastery is not erased');
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' + r[1] : '  FAIL  ' + r[1] + ' — ' + r[2]);
console.log(failed.length ? failed.length + ' failed' : results.length + ' passed');
if (failed.length) process.exit(1);
