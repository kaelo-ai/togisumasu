// Official November memos 2016–2025: schema, full leaf coverage, idempotent import,
// practice memos open quizzes behind prerequisites, 2022+ stays in the exam pool.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-memo-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
delete process.env.LLM_PROVIDER;
const { server, db } = require('../server.js');
const keys = require('../keys.js');
const quiz = require('../quiz.js');
const nsc = require('../nsc.js');
const catalog = require('../catalog.js');
const core = require('../public/core.js');

const MEMOS = path.join(__dirname, '..', 'data', 'nsc', 'memos');
const PAPERS = [];
for (let year = 2016; year <= 2025; year++) for (const p of [1, 2]) PAPERS.push(`${year}-nov-p${p}`);
const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
const spec = id => JSON.parse(keys.keyRow(db, id).answer_json);

t('the memo schema accepts all 20 files and rejects a broken part', () => {
  for (const id of PAPERS) {
    const name = id + '.json';
    const memo = JSON.parse(fs.readFileSync(path.join(MEMOS, name), 'utf8'));
    assert.equal(keys.validateMemo(memo, name).paper_id, id);
    assert.equal(memo.parts.reduce((sum, part) => sum + part.marks, 0), 150, name);
  }
  const bad = JSON.parse(fs.readFileSync(path.join(MEMOS, '2025-nov-p1.json'), 'utf8'));
  bad.parts[0].steps = [];
  assert.throws(() => keys.validateMemo(bad, 'bad.json'), /steps/);
});

t('every leaf of all 20 papers has one memo key and each paper totals 150', () => {
  for (const paperId of PAPERS) {
    const leaves = db.prepare('SELECT id, marks FROM nsc_nodes WHERE paper_id = ? AND is_leaf = 1').all(paperId);
    assert.ok(leaves.length, paperId);
    assert.equal(leaves.reduce((sum, leaf) => sum + leaf.marks, 0), 150, paperId);
    for (const leaf of leaves) {
      const key = keys.keyRow(db, leaf.id);
      assert.ok(key, leaf.id);
      assert.equal(key.provenance, 'memo', leaf.id);
      assert.equal(db.prepare('SELECT memo_ref FROM nsc_nodes WHERE id = ?').get(leaf.id).memo_ref, leaf.id);
      const s = JSON.parse(key.answer_json);
      assert.equal(s.marks, leaf.marks, leaf.id);
      assert.ok(Array.isArray(s.steps) && s.steps.length, leaf.id);
      assert.ok(Array.isArray(s.alternatives), leaf.id);
      assert.ok(Array.isArray(s.memo_notes), leaf.id);
    }
    const keyed = db.prepare(`
      SELECT COALESCE(SUM(n.marks), 0) AS marks FROM nsc_nodes n
      JOIN nsc_answer_keys k ON k.node_id = n.id
      WHERE n.paper_id = ? AND k.provenance = 'memo'
    `).get(paperId).marks;
    assert.equal(keyed, 150, paperId);
  }
});

t('every scored key marks its own memo answer correct', () => {
  const rows = db.prepare(`SELECT node_id, answer_json FROM nsc_answer_keys WHERE provenance = 'memo'`).all();
  let scored = 0;
  for (const row of rows) {
    const s = JSON.parse(row.answer_json);
    if (!s.checkable || !core.FORMS[s.type]) continue;
    scored++;
    assert.equal(core.check(s, s.ans).ok, true, row.node_id);
  }
  assert.ok(scored > 200, 'only ' + scored + ' new-form keys');
});

t('memo answers in the new forms are scored', () => {
  assert.equal(spec('2025-nov-p1-5.3.2').type, 'region');
  assert.equal(keys.markNode(db, '2025-nov-p1-5.3.2', 'x < 1 or x > 5').ok, true);
  assert.equal(keys.markNode(db, '2025-nov-p1-5.3.2', 'x <= 1 or x > 5').ok, false);
  assert.equal(spec('2025-nov-p2-4.5').type, 'points');
  assert.equal(keys.markNode(db, '2025-nov-p2-4.5', '(-3; 0) and (-9; 0)').ok, true);
  assert.equal(spec('2020-nov-p2-6.3').type, 'trig');
  assert.equal(keys.markNode(db, '2020-nov-p2-6.3', 'x = 109,47 + k.360 or x = 250,53 + k.360, k ∈ Z').ok, true);
  assert.equal(keys.markNode(db, '2020-nov-p2-6.3', 'x = 109,47').ok, false);
  assert.equal(spec('2025-nov-p2-5.1.3').type, 'expr');
  assert.equal(keys.markNode(db, '2025-nov-p2-5.1.3', '1 - 2/(k^2+1)').ok, true);
  const before = { scored: 69, unscored: 34 };
  const now = db.prepare(`
    SELECT SUM(CASE WHEN json_extract(k.answer_json, '$.checkable') THEN 1 ELSE 0 END) AS scored, COUNT(*) AS n
    FROM nsc_answer_keys k JOIN nsc_nodes n ON n.id = k.node_id WHERE n.paper_id LIKE '2025-%' AND n.is_leaf = 1
  `).get();
  assert.equal(now.n, before.scored + before.unscored);
  assert.ok(now.scored >= 90, '2025 scored only ' + now.scored);
});

t('a sketch is stored but not auto-marked, and memo notes travel with the key', () => {
  const sketch = spec('2025-nov-p1-4.5');
  assert.equal(sketch.checkable, false);
  const marked = keys.markNode(db, '2025-nov-p1-4.5', 'a decreasing graph');
  assert.equal(marked.checkable, false);
  assert.equal(marked.ok, null);
  assert.match(marked.answer, /exponential/);
  const typo = spec('2016-nov-p2-4.4.2');
  assert.ok(typo.memo_notes.some(note => /printed/.test(note.text)));
  const alt = spec('2017-nov-p1-2.2.2');
  assert.ok(alt.memo_notes.some(note => /T_\{30\}=94/.test(note.text) && /alternative/.test(note.where)));
});

t('import is idempotent and a memo replaces llm_double and flagged keys', () => {
  const count = () => db.prepare(`SELECT COUNT(*) AS n, GROUP_CONCAT(answer_json) AS j FROM (SELECT answer_json FROM nsc_answer_keys WHERE provenance = 'memo' ORDER BY node_id)`).get();
  const before = count();
  const again = keys.importMemos(db, MEMOS);
  const after = count();
  assert.equal(after.n, before.n);
  assert.equal(after.j, before.j);
  assert.equal(again.keys, before.n);
  assert.equal(Object.keys(again.papers).length, 20);
  db.prepare(`UPDATE nsc_answer_keys SET provenance = 'flagged', answer_json = NULL WHERE node_id = '2021-nov-p1-1.1.3'`).run();
  db.prepare(`UPDATE nsc_answer_keys SET provenance = 'llm_double' WHERE node_id = '2025-nov-p1-2.2.1'`).run();
  keys.importMemos(db, MEMOS);
  assert.equal(keys.keyRow(db, '2021-nov-p1-1.1.3').provenance, 'memo');
  assert.equal(keys.keyRow(db, '2025-nov-p1-2.2.1').provenance, 'memo');
  assert.equal(keys.markNode(db, '2025-nov-p1-2.2.1', '32').ok, true);
});

function closure(topics) {
  const course = catalog.learner(db, 'gr12-caps');
  const pre = new Map(course.topics.map(topic => [topic.id, topic.pre]));
  const members = new Set(course.topics.map(topic => topic.id));
  const need = new Set(topics.filter(id => members.has(id)));
  const stack = [...need];
  while (stack.length) for (const p of pre.get(stack.pop()) || []) if (!need.has(p)) { need.add(p); stack.push(p); }
  return [...need];
}

t('a memo-keyed 2021 leaf enters a quiz only once its prerequisites are mastered', () => {
  const leafId = '2021-nov-p1-1.1.3';
  assert.equal(spec(leafId).type, 'region');
  const need = closure(nsc.topicsForNode(db, leafId));
  assert.ok(need.length >= 2, 'needs prerequisites');
  assert.ok(!quiz.eligibleLeaves(db, [], 'gr12-caps').some(leaf => leaf.id === leafId));
  const leaf = nsc.topicsForNode(db, leafId)[0];
  const missing = need.filter(id => id !== leaf).concat([]);
  assert.ok(!quiz.eligibleLeaves(db, need.filter(id => id !== missing[0]), 'gr12-caps').some(l => l.id === leafId));
  const open = quiz.eligibleLeaves(db, need, 'gr12-caps');
  const index = open.findIndex(l => l.id === leafId);
  assert.ok(index >= 0);
  assert.equal(open[index].form, 'region');
  const built = quiz.assembleQuiz(db, { mastered: need, choice: index, shuffle: false });
  const paper = (built.items || []).find(item => item.kind === 'paper') || { error: JSON.stringify(built).slice(0, 300) };
  assert.ok(!paper.error, paper.error);
  assert.equal(paper.id, leafId);
  assert.ok(paper.hint);
  assert.equal(keys.markNode(db, leafId, '-4 <= x <= -1').ok, true);
});

t('practice memos make 2016–2021 leaves quiz-servable; unscored memo parts are not served', () => {
  const all = db.prepare('SELECT id FROM topics').all().map(row => row.id);
  const open = quiz.eligibleLeaves(db, all, 'gr12-caps');
  assert.ok(open.length > 300, 'only ' + open.length);
  for (const leaf of open) {
    assert.ok(leaf.year <= 2021, leaf.id);
    assert.equal(spec(leaf.id).checkable, true, leaf.id);
  }
  assert.ok(!open.some(leaf => leaf.id === '2021-nov-p2-2.1'), 'a scatter-plot sketch is not served in a quiz');
});

t('2022+ stays in the exam pool and out of quizzes', () => {
  const papers = db.prepare(`SELECT id, pool, year FROM nsc_papers WHERE year >= 2022 ORDER BY id`).all();
  assert.equal(papers.length, 8);
  assert.ok(papers.every(paper => paper.pool === 'exam'));
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_practice_leaves WHERE paper_id IN (SELECT id FROM nsc_papers WHERE year >= 2022)`).get().n, 0);
  const mastered = db.prepare('SELECT id FROM topics').all().map(row => row.id);
  const leaked = quiz.eligibleLeaves(db, mastered, 'gr12-caps').filter(leaf => leaf.year >= 2022);
  assert.deepEqual(leaked, []);
  for (let i = 0; i < 40; i++) {
    const built = quiz.assembleQuiz(db, { mastered, choice: i * 7 });
    assert.ok(built.items.filter(item => item.kind === 'paper').every(item => item.year <= 2021));
  }
  const exam = quiz.examPaper(db, '2025-nov-p1');
  assert.equal(exam.pool, 'exam');
  assert.equal(exam.questions.reduce((sum, question) => sum + question.marks, 0), 150);
  const sketch = exam.questions.find(question => question.id === '2025-nov-p1-4.5');
  assert.equal(sketch.checkable, false);
  assert.equal(sketch.servable, true);
  const region = exam.questions.find(question => question.id === '2025-nov-p1-5.3.2');
  assert.equal(region.form, 'region');
  assert.ok(region.hint);
  const marked = quiz.markExam(db, '2025-nov-p1', { '2025-nov-p1-1.1.1': '-5, 2', '2025-nov-p1-4.5': 'sketch', '2025-nov-p1-5.3.2': 'x<1 or x>5' });
  assert.equal(marked.find(item => item.id === '2025-nov-p1-1.1.1').ok, true);
  assert.equal(marked.find(item => item.id === '2025-nov-p1-5.3.2').ok, true);
  const drawn = marked.find(item => item.id === '2025-nov-p1-4.5');
  assert.equal(drawn.checkable, false);
  assert.match(drawn.answer, /exponential/);
});

const failed = results.filter(row => row[0] === 'FAIL');
for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
server.close();
process.exit(failed.length ? 1 : 0);
