// Official November 2025 memos: schema, full leaf coverage, idempotent import, exam pool only.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-memo-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
delete process.env.LLM_PROVIDER;
const { server, db } = require('../server.js');
const keys = require('../keys.js');
const quiz = require('../quiz.js');
const core = require('../public/core.js');

const MEMOS = path.join(__dirname, '..', 'data', 'nsc', 'memos');
const results = [];
function t(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

t('the memo schema accepts the 2025 files and rejects a broken part', () => {
  for (const name of ['2025-nov-p1.json', '2025-nov-p2.json']) {
    const memo = JSON.parse(fs.readFileSync(path.join(MEMOS, name), 'utf8'));
    assert.equal(keys.validateMemo(memo, name).paper_id, memo.id);
    assert.equal(memo.parts.reduce((sum, part) => sum + part.marks, 0), 150);
  }
  const bad = JSON.parse(fs.readFileSync(path.join(MEMOS, '2025-nov-p1.json'), 'utf8'));
  bad.parts[0].steps = [];
  assert.throws(() => keys.validateMemo(bad, 'bad.json'), /steps/);
});

t('every 2025 leaf has one memo key and each paper totals 150', () => {
  for (const paperId of ['2025-nov-p1', '2025-nov-p2']) {
    const leaves = db.prepare('SELECT id, marks FROM nsc_nodes WHERE paper_id = ? AND is_leaf = 1').all(paperId);
    assert.equal(leaves.reduce((sum, leaf) => sum + leaf.marks, 0), 150);
    for (const leaf of leaves) {
      const key = keys.keyRow(db, leaf.id);
      assert.ok(key, leaf.id);
      assert.equal(key.provenance, 'memo');
      assert.equal(db.prepare('SELECT memo_ref FROM nsc_nodes WHERE id = ?').get(leaf.id).memo_ref, leaf.id);
      const spec = JSON.parse(key.answer_json);
      assert.equal(spec.marks, leaf.marks);
      assert.ok(Array.isArray(spec.steps) && spec.steps.length);
      assert.ok(Array.isArray(spec.alternatives));
      assert.equal(JSON.parse(key.steps_json).length, spec.steps.length);
    }
    const keyed = db.prepare(`
      SELECT COALESCE(SUM(n.marks), 0) AS marks FROM nsc_nodes n
      JOIN nsc_answer_keys k ON k.node_id = n.id
      WHERE n.paper_id = ? AND k.provenance = 'memo'
    `).get(paperId).marks;
    assert.equal(keyed, 150);
  }
});

t('a geometry memo becomes a statement-reason chain', () => {
  const spec = JSON.parse(keys.keyRow(db, '2025-nov-p2-9.2.1').answer_json);
  assert.equal(spec.type, 'geom');
  assert.equal(spec.checkable, true);
  assert.equal(core.check(spec, spec.chain).ok, true);
  const mixed = JSON.parse(keys.keyRow(db, '2025-nov-p2-11.2.3').answer_json);
  assert.equal(mixed.type, 'geom');
  assert.ok(mixed.chain.length >= 2);
  assert.equal(core.check(mixed, mixed.chain).ok, true);
  assert.equal(core.check(mixed, [...mixed.chain].reverse()).ok, false);
});

t('a numeric memo answer is marked and a sketch is stored but not auto-marked', () => {
  const roots = JSON.parse(keys.keyRow(db, '2025-nov-p1-1.1.1').answer_json);
  assert.equal(roots.type, 'set');
  assert.equal(keys.markNode(db, '2025-nov-p1-1.1.1', '-5, 2').ok, true);
  assert.equal(keys.markNode(db, '2025-nov-p1-1.1.1', '1').ok, false);
  const sketch = JSON.parse(keys.keyRow(db, '2025-nov-p1-4.5').answer_json);
  assert.equal(sketch.checkable, false);
  const marked = keys.markNode(db, '2025-nov-p1-4.5', 'a decreasing graph');
  assert.equal(marked.checkable, false);
  assert.equal(marked.ok, null);
  assert.match(marked.answer, /exponential/);
});

t('import is idempotent and a memo replaces llm_double and flagged keys', () => {
  const before = db.prepare(`SELECT COUNT(*) AS n FROM nsc_answer_keys WHERE provenance = 'memo' AND node_id LIKE '2025-%'`).get().n;
  const again = keys.importMemos(db, MEMOS);
  const after = db.prepare(`SELECT COUNT(*) AS n FROM nsc_answer_keys WHERE provenance = 'memo' AND node_id LIKE '2025-%'`).get().n;
  assert.equal(after, before);
  assert.equal(again.keys, before);
  db.prepare(`UPDATE nsc_answer_keys SET provenance = 'flagged', answer_json = NULL WHERE node_id = '2025-nov-p1-1.1.1'`).run();
  db.prepare(`UPDATE nsc_answer_keys SET provenance = 'llm_double' WHERE node_id = '2025-nov-p1-2.2.1'`).run();
  keys.importMemos(db, MEMOS);
  assert.equal(keys.keyRow(db, '2025-nov-p1-1.1.1').provenance, 'memo');
  assert.equal(keys.keyRow(db, '2025-nov-p1-2.2.1').provenance, 'memo');
  assert.equal(keys.markNode(db, '2025-nov-p1-2.2.1', '32').ok, true);
});

t('2025 stays in the exam pool and out of quizzes', () => {
  const papers = db.prepare(`SELECT id, pool, year FROM nsc_papers WHERE id LIKE '2025-%' ORDER BY id`).all();
  assert.deepEqual(papers.map(paper => paper.pool), ['exam', 'exam']);
  assert.ok(papers.every(paper => paper.year >= 2022));
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM nsc_practice_leaves WHERE paper_id LIKE '2025-%'`).get().n, 0);
  const mastered = db.prepare('SELECT id FROM topics').all().map(row => row.id);
  const leaked = quiz.eligibleLeaves(db, mastered, 'gr12-caps').filter(leaf => leaf.year >= 2022 || String(leaf.paperId).startsWith('2025'));
  assert.deepEqual(leaked, []);
  const exam = quiz.examPaper(db, '2025-nov-p1');
  assert.equal(exam.pool, 'exam');
  assert.equal(exam.questions.reduce((sum, question) => sum + question.marks, 0), 150);
  const sketch = exam.questions.find(question => question.id === '2025-nov-p1-4.5');
  assert.equal(sketch.checkable, false);
  assert.equal(sketch.servable, true);
  const marked = quiz.markExam(db, '2025-nov-p1', { '2025-nov-p1-1.1.1': '-5, 2', '2025-nov-p1-4.5': 'sketch' });
  const roots = marked.find(item => item.id === '2025-nov-p1-1.1.1');
  const drawn = marked.find(item => item.id === '2025-nov-p1-4.5');
  assert.equal(roots.ok, true);
  assert.equal(drawn.checkable, false);
  assert.match(drawn.answer, /exponential/);
});

const failed = results.filter(row => row[0] === 'FAIL');
for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
server.close();
process.exit(failed.length ? 1 : 0);
