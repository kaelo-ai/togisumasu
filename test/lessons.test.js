// Staged lessons for Unit 0 geometry: every knowledge point teaches before it
// tests, worked examples are laid out as statement and reason, and every
// reason abbreviation is explained before (or where) it is first used.
'use strict';
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const core = require('../public/core.js');
const CapsGen = require('../public/caps-gen.js');
const KpLessons = require('../public/kp-lessons.js');
const { CAPS_KPS } = require('../caps-kps.js');
const caps = require('../caps.js');
const questions = require('../questions.js');

const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (err) { results.push(['FAIL', name, err.message]); }
}

const EUC = KpLessons.LESSONS['euc-revision'];
const STEPS = EUC.flatMap(L => L.steps);
// The reason column may add the lines or sides it relies on ("alt ∠s; AB ∥ CD").
const base = r => r.split(';')[0].trim();
const ALGEBRA_ONLY = '';
const ALWAYS_OK = new Set(['given', 'SSS', 'SAS', 'AAS', 'RHS']);

t('the topic keeps its three knowledge points, and each has a lesson with the same title', () => {
  const kps = CAPS_KPS['euc-revision'];
  assert.deepEqual(kps.map(k => k.name), ['Isosceles triangles and the angle sum', 'Congruence conditions', 'The midpoint theorem']);
  assert.equal(EUC.length, kps.length);
  kps.forEach((kp, i) => assert.equal(EUC[i].title, kp.name, `part ${i + 1}`));
  assert.equal(CapsGen.BRANCHED['euc-revision'], kps.length);
});

t('every prerequisite idea is taught as its own step', () => {
  const titles = STEPS.map(S => S.title).join(' | ');
  for (const w of ['vertically opposite', 'Parallel lines', 'exterior angle', 'Isosceles and equilateral', 'SSS, SAS, AAS and RHS', 'quadrilaterals', 'midpoint theorem and its converse']) {
    assert.ok(titles.includes(w), w);
  }
});

t('each step explains, draws a figure and gives at least three worked examples', () => {
  STEPS.forEach((L, i) => {
    assert.ok(L.explain && L.explain.length > 200, `step ${i + 1} explanation`);
    assert.match(L.fig(), /<svg/, `step ${i + 1} figure`);
    assert.ok(L.examples.length >= 3, `step ${i + 1} has ${L.examples.length} examples`);
    assert.ok(L.reasons.length >= 1, `step ${i + 1} reasons`);
    assert.ok(L.sources.some(s => /Siyavula/.test(s) && /CC BY/.test(s)), `step ${i + 1} credits Siyavula (CC BY)`);
    for (const e of L.examples) {
      assert.match(e.fig(), /<svg/, `step ${i + 1} example figure`);
      assert.ok(e.q && e.answer && e.level, `step ${i + 1} example text`);
      assert.ok(e.rows.length >= 1 && e.rows.every(r => r.length === 2), `step ${i + 1} statement | reason rows`);
    }
  });
});

t('every reason in a worked example is glossed in that step or an earlier one', () => {
  const known = new Set(ALWAYS_OK);
  STEPS.forEach((L, i) => {
    for (const [abbr] of L.reasons) for (const a of abbr.split('/')) known.add(base(a));
    for (const e of L.examples) for (const [, r] of e.rows) {
      if (r === ALGEBRA_ONLY) continue;
      assert.ok(known.has(base(r)), `step ${i + 1}: "${r}" is used before it is explained`);
    }
  });
});

t('practice items for each knowledge point use only reasons its lesson (or an earlier one) explains', () => {
  const known = new Set(ALWAYS_OK);
  let matched = 0;
  EUC.forEach((L, kp) => {
    for (const S of L.steps) for (const [abbr] of S.reasons) for (const a of abbr.split('/')) known.add(base(a));
    for (let i = 0; i < 60; i++) {
      const q = CapsGen.GENERATORS['euc-revision'](kp);
      for (const step of q.steps) {
        const m = step.match(/\(([^()]*(?:∠|△|given|common|midpt|\|\|m|rhombus|SSS|SAS|AAS|RHS)[^()]*)\)\.?$/);
        if (m) { matched++; assert.ok(known.has(base(m[1].replace(/\$[^$]*\$/g, 'X'))), `kp ${kp}: "${m[1]}"`); }
      }
      if (q.type === 'geom') {
        const used = new Set(q.chain.map(c => c.reason));
        for (const r of q.reasons) if (used.has(r.id)) assert.ok(known.has(base(r.text)), `kp ${kp} chain reason "${r.text}"`);
      }
    }
  });
  assert.ok(matched > 50, 'the reason check actually ran');
});

t('practice items draw a figure, carry the new revision tag and check their own answer', () => {
  for (let kp = 0; kp < EUC.length; kp++) {
    for (let i = 0; i < 40; i++) {
      const q = CapsGen.GENERATORS['euc-revision'](kp);
      assert.match(q.prompt, /<svg/, `kp ${kp}`);
      assert.equal(q.genRev, questions.GEN_REVISIONS['euc-revision']);
      assert.ok(q.prompt.length < 4000, `kp ${kp} prompt fits the bank limit`);
      const inp = q.type === 'mc' ? q.options.findIndex(o => o.ok) : q.type === 'geom' ? q.chain : q.ans;
      assert.ok(core.check(q, inp).ok, `kp ${kp}: ${q.ans}`);
    }
  }
});

t('the congruence part spells out all four tests and the two that fail', () => {
  const L = STEPS[4];
  for (const w of ['side, side, side', 'side, angle, side', 'angle, angle, side', 'right angle, hypotenuse, side', 'AAA']) {
    assert.ok(L.explain.includes(w), w);
  }
  const tests = new Set(L.examples.flatMap(e => e.rows.map(r => r[1])).filter(r => /^(SSS|SAS|AAS|RHS)$/.test(r)));
  assert.deepEqual([...tests].sort(), ['AAS', 'RHS', 'SAS', 'SSS']);
});

t('the isosceles part says two equal sides and separates equilateral', () => {
  const L = STEPS[3];
  assert.match(L.explain, /<b>two<\/b> equal sides/);
  assert.match(L.explain, /equilateral/i);
  assert.match(L.explain, /opposite/);
});

t('the unit intro is plain English: no unexplained test names or reason codes', () => {
  const intro = caps.TOPICS.find(x => x.id === 'euc-revision');
  assert.doesNotMatch(intro.notes, /SSS|SAS|AAS|RHS|rhombi/);
  assert.match(intro.notes, /statement/);
  assert.match(intro.notes, /tick marks/);
  assert.ok(intro.oldNotes && intro.oldNotes.length, 'old text is listed so live databases refresh');
});

function freshDb() {
  const db = new DatabaseSync(':memory:');
  questions.init(db);
  return db;
}

t('the rewritten intro replaces the old built-in text, but never an admin edit; the name is unchanged', () => {
  const db = freshDb();
  const topic = caps.TOPICS.find(x => x.id === 'euc-revision');
  assert.equal(topic.name, 'Triangles, congruence and the midpoint theorem');
  db.prepare('UPDATE topics SET notes = ? WHERE id = ?').run(topic.oldNotes[0], topic.id);
  caps.seed(db);
  let row = db.prepare('SELECT name, notes FROM topics WHERE id = ?').get(topic.id);
  assert.equal(row.name, topic.name);
  assert.equal(row.notes, topic.notes);
  db.prepare('UPDATE topics SET notes = ? WHERE id = ?').run('<p>Edited by an admin.</p>', topic.id);
  caps.seed(db);
  row = db.prepare('SELECT notes FROM topics WHERE id = ?').get(topic.id);
  assert.equal(row.notes, '<p>Edited by an admin.</p>');
  db.close();
});

t('cached generated items from the old geometry generator are retired; manual ones stay', () => {
  const db = freshDb();
  const ins = db.prepare(`INSERT INTO questions (skill_id, unit, type, prompt, prompt_text, steps, data, fingerprint, created_at, source, status, kp)
    VALUES ('euc-revision', 'c0', 'num', ?, ?, '[]', ?, ?, 1, ?, 'active', 1)`);
  ins.run('old', 'old', JSON.stringify({ type: 'num' }), 'f-old', 'generated');
  ins.run('new', 'new', JSON.stringify({ type: 'num', genRev: questions.GEN_REVISIONS['euc-revision'] }), 'f-new', 'generated');
  ins.run('mine', 'mine', JSON.stringify({ type: 'num' }), 'f-man', 'manual');
  assert.equal(questions.retireStaleGenerated(db), 1);
  const st = Object.fromEntries(db.prepare("SELECT fingerprint, status FROM questions WHERE skill_id = 'euc-revision' AND fingerprint LIKE 'f-%'").all().map(r => [r.fingerprint, r.status]));
  assert.deepEqual(st, { 'f-old': 'deleted', 'f-new': 'active', 'f-man': 'active' });
  assert.equal(questions.retireStaleGenerated(db), 0, 'idempotent');
  db.close();
});

t('every step sets out its key words and ends with a short memory tip', () => {
  const steps = KpLessons.LESSONS['euc-revision'].flatMap(l => l.steps);
  for (const s of steps) {
    assert.ok(Array.isArray(s.words) && s.words.length >= 2, s.title + ': key words');
    for (const [w, d] of s.words) assert.ok(w && d && d.length > 20, s.title + ': ' + w);
    assert.ok(typeof s.tip === 'string' && s.tip.length > 60, s.title + ': tip');
  }
  const iso = steps.find(s => /Isosceles/.test(s.title));
  assert.match(iso.words.find(([w]) => w === 'isosceles triangle')[1], /two/);
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const r of results) console.log(r[0] === 'ok' ? '  ok  ' + r[1] : '  FAIL  ' + r[1] + ' — ' + r[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
