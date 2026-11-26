// Answer keys: two offline solves, flag on disagreement, memos replace them, flagged questions are not served.
'use strict';
const os = require('node:os'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'togisumasu-keys-'));
process.env.QUESTION_SEED_PER_SKILL = '1';
delete process.env.LLM_PROVIDER;
const { server, db } = require('../server.js');
const keys = require('../keys.js');
const quiz = require('../quiz.js');
const nsc = require('../nsc.js');
const catalog = require('../catalog.js');

const results = [];
async function t(name, fn) {
  try { await fn(); results.push(['ok', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

const capsIds = catalog.learner(db, 'gr12-caps').topics.map(topic => topic.id);
const leaves = db.prepare('SELECT id FROM nsc_nodes WHERE is_leaf = 1 ORDER BY id LIMIT 2').all();
// Every paper now ships with a memo. Clear two keys so these leaves behave like a paper whose memo has not arrived.
for (const leaf of leaves) db.prepare('DELETE FROM nsc_answer_keys WHERE node_id = ?').run(leaf.id);
const agree = JSON.stringify({ type: 'num', ans: '7', ansTex: '7', val: 7, steps: ['zero product'] });
const other = JSON.stringify({ type: 'num', ans: '4', ansTex: '4', val: 4, steps: ['different'] });

(async () => {
  let calls = 0;
  const complete = async () => {
    calls++;
    if (calls <= 2) return agree;
    return calls % 2 ? agree : other;
  };

  await t('two agreeing solves become llm_double and a disagreement is flagged', async () => {
    const stats = await keys.solveMissing(db, { complete, limit: 2 });
    assert.equal(stats.solved, 2);
    assert.equal(stats.agreed, 1);
    assert.equal(stats.flagged, 1);
    assert.equal(keys.keyRow(db, leaves[0].id).provenance, 'llm_double');
    assert.equal(keys.keyRow(db, leaves[1].id).provenance, 'flagged');
    assert.equal(keys.keyRow(db, leaves[1].id).answer_json, null);
  });

  await t('a flagged question is not served and an agreed one can be marked', async () => {
    const open = quiz.eligibleLeaves(db, capsIds, 'gr12-caps');
    assert.ok(open.some(leaf => leaf.id === leaves[0].id));
    assert.ok(!open.some(leaf => leaf.id === leaves[1].id));
    const before = calls;
    const right = keys.markNode(db, leaves[0].id, '7');
    const wrong = keys.markNode(db, leaves[0].id, '8');
    assert.equal(right.ok, true);
    assert.equal(wrong.ok, false);
    assert.equal(right.provenance, 'llm_double');
    assert.equal(calls, before);
    assert.throws(() => keys.markNode(db, leaves[1].id, '4'), /not served/);
  });

  await t('a memo replaces an LLM key and is idempotent', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memos-'));
    const answer = { type: 'num', ans: '0', ansTex: '0', val: 0, steps: ['from the memo'] };
    fs.writeFileSync(path.join(dir, '2016-nov-p1.json'), JSON.stringify({
      paper_id: '2016-nov-p1',
      answers: { [leaves[0].id]: answer, [leaves[1].id]: answer },
    }));
    const first = keys.importMemos(db, dir);
    const second = keys.importMemos(db, dir);
    assert.equal(first.keys, 2);
    assert.equal(second.keys, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nsc_answer_keys WHERE node_id = ?').get(leaves[0].id).n, 1);
    assert.equal(keys.keyRow(db, leaves[0].id).provenance, 'memo');
    assert.equal(keys.keyRow(db, leaves[1].id).provenance, 'memo');
    assert.equal(keys.markNode(db, leaves[0].id, '0').ok, true);
    assert.equal(keys.markNode(db, leaves[1].id, '0').provenance, 'memo');
    const again = await keys.solveNode(db, leaves[0].id, async () => { throw new Error('solver must not run over a memo'); });
    assert.equal(again, 'memo');
  });

  await t('marking a missing key is refused', async () => {
    db.prepare('DELETE FROM nsc_answer_keys WHERE node_id = ?').run('2016-nov-p1-1.1.3');
    assert.throws(() => keys.markNode(db, '2016-nov-p1-1.1.3', '1'), /not served/);
  });

  const failed = results.filter(row => row[0] === 'FAIL');
  for (const row of results) console.log(row[0] === 'ok' ? '  ok  ' + row[1] : '  FAIL  ' + row[1] + ' — ' + row[2]);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  server.close();
  process.exit(failed.length ? 1 : 0);
})();
