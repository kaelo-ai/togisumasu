// Offline answer keys for NSC questions.
// A key is either an official memo or two independent solves that agree.
// If the two solves disagree, the question is flagged and is not served.
// Marking reads the stored key. It never calls a model.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ai = require('./ai.js');
const core = require('./public/core.js');

const PROVENANCE = new Set(['memo', 'llm_double', 'flagged']);
const ACCEPTED = new Set(['memo', 'llm_double']);

const SOLVE_SYSTEM = `You are solving one NSC Mathematics question.
Reply with a single JSON object and nothing else, in this shape:
{"type":"num"|"set"|"expr"|"text","ans":"short answer","ansTex":"latex","val":null,"vals":null,"steps":["one line"]}
Use type "set" with numeric vals when there is a list of numbers.
Use type "num" with val when there is one number.
Use type "expr" with ans as an expression in x.
Otherwise use type "text" and put the mark-ready answer in ans.
Do not wrap the JSON in markdown.`;

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nsc_answer_keys (
      node_id     TEXT PRIMARY KEY,
      provenance  TEXT NOT NULL CHECK (provenance IN ('memo', 'llm_double', 'flagged')),
      answer_json TEXT,
      steps_json  TEXT,
      solver_a    TEXT,
      solver_b    TEXT,
      updated_at  INTEGER NOT NULL
    );
  `);
}

function normText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function canonical(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const type = String(spec.type || '');
  if (type === 'set') {
    const vals = (Array.isArray(spec.vals) ? spec.vals : []).map(Number).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return null;
    return JSON.stringify({ type, vals });
  }
  if (type === 'num') {
    const val = Number(spec.val);
    if (!Number.isFinite(val)) return null;
    return JSON.stringify({ type, val: Math.round(val * 1e6) / 1e6 });
  }
  if (type === 'expr' || type === 'text') {
    const ans = normText(spec.ans);
    if (!ans) return null;
    return JSON.stringify({ type, ans });
  }
  return null;
}

function parseSolver(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const spec = JSON.parse(raw);
    return canonical(spec) ? spec : null;
  } catch (err) {
    return null;
  }
}

function questionText(db, nodeId) {
  const quiz = require('./quiz.js');
  return quiz.promptHtml(db, nodeId).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function saveKey(db, nodeId, row) {
  if (!PROVENANCE.has(row.provenance)) throw new Error('Unknown key provenance.');
  db.prepare(`
    INSERT INTO nsc_answer_keys (node_id, provenance, answer_json, steps_json, solver_a, solver_b, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      provenance = excluded.provenance,
      answer_json = excluded.answer_json,
      steps_json = excluded.steps_json,
      solver_a = excluded.solver_a,
      solver_b = excluded.solver_b,
      updated_at = excluded.updated_at
  `).run(
    nodeId, row.provenance,
    row.answer ? JSON.stringify(row.answer) : null,
    JSON.stringify(row.steps || []),
    row.solverA || null, row.solverB || null, Date.now(),
  );
}

async function solveNode(db, nodeId, complete) {
  const node = db.prepare('SELECT id, number, marks, answer_type FROM nsc_nodes WHERE id = ? AND is_leaf = 1').get(nodeId);
  if (!node) throw new Error('Unknown question ' + nodeId);
  const existing = db.prepare('SELECT provenance FROM nsc_answer_keys WHERE node_id = ?').get(nodeId);
  if (existing && existing.provenance === 'memo') return 'memo';
  const user = `Question ${node.number} (${node.marks} marks, ${node.answer_type || 'answer'}).\n${questionText(db, nodeId)}`;
  const [rawA, rawB] = await Promise.all([
    complete(SOLVE_SYSTEM, user),
    complete(SOLVE_SYSTEM, user),
  ]);
  const a = parseSolver(rawA);
  const b = parseSolver(rawB);
  const agree = a && b && canonical(a) === canonical(b);
  if (!agree) {
    saveKey(db, nodeId, { provenance: 'flagged', answer: null, steps: [], solverA: String(rawA), solverB: String(rawB) });
    return 'flagged';
  }
  saveKey(db, nodeId, { provenance: 'llm_double', answer: a, steps: a.steps || [], solverA: String(rawA), solverB: String(rawB) });
  return 'llm_double';
}

async function solveMissing(db, options = {}) {
  init(db);
  const complete = options.complete || defaultComplete();
  const limit = Number.isInteger(options.limit) ? options.limit : Infinity;
  const rows = db.prepare(`
    SELECT n.id FROM nsc_nodes n
    LEFT JOIN nsc_answer_keys k ON k.node_id = n.id
    WHERE n.is_leaf = 1 AND (k.node_id IS NULL OR k.provenance = 'flagged')
    ORDER BY n.id
  `).all();
  const stats = { solved: 0, agreed: 0, flagged: 0, skipped: 0 };
  for (const row of rows) {
    if (stats.solved >= limit) break;
    const result = await solveNode(db, row.id, complete);
    stats.solved++;
    if (result === 'llm_double') stats.agreed++;
    else if (result === 'flagged') stats.flagged++;
    else stats.skipped++;
  }
  return stats;
}

function defaultComplete() {
  const cfg = ai.loadConfig();
  if (!cfg.enabled) {
    const err = new Error(cfg.reason || 'AI is off.');
    err.status = 400;
    throw err;
  }
  return (system, user) => ai.complete(cfg, system, user, { temperature: 0 });
}

function importMemos(db, dir) {
  init(db);
  if (!dir || !fs.existsSync(dir)) throw new Error('Memo directory not found.');
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
  const stats = { files: files.length, keys: 0 };
  for (const name of files) {
    const memo = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    const answers = memo.answers || {};
    for (const [nodeId, answer] of Object.entries(answers)) {
      if (!canonical(answer)) throw new Error(`${name}: ${nodeId} has no comparable answer.`);
      const node = db.prepare('SELECT id FROM nsc_nodes WHERE id = ? AND is_leaf = 1').get(nodeId);
      if (!node) throw new Error(`${name}: ${nodeId} is not an imported question.`);
      saveKey(db, nodeId, { provenance: 'memo', answer, steps: answer.steps || [], solverA: null, solverB: null });
      stats.keys++;
    }
  }
  return stats;
}

function keyRow(db, nodeId) {
  return db.prepare('SELECT * FROM nsc_answer_keys WHERE node_id = ?').get(nodeId) || null;
}

function accepted(db, nodeId) {
  const row = keyRow(db, nodeId);
  return row && ACCEPTED.has(row.provenance) ? row : null;
}

function markNode(db, nodeId, input) {
  const row = keyRow(db, nodeId);
  if (!row || !ACCEPTED.has(row.provenance)) {
    const err = new Error('This question is not served until it has an agreed answer key.');
    err.status = 404;
    throw err;
  }
  const spec = JSON.parse(row.answer_json);
  if (spec.type === 'text') {
    return { ok: normText(input) === normText(spec.ans), provenance: row.provenance };
  }
  if (spec.type === 'set') {
    return { ...core.check({ type: 'set', vals: spec.vals, ans: spec.ans, tol: spec.tol }, String(input == null ? '' : input)), provenance: row.provenance };
  }
  if (spec.type === 'num') {
    return { ...core.check({ type: 'num', val: spec.val, ans: spec.ans, exact: !!spec.exact, tol: spec.tol }, String(input == null ? '' : input)), provenance: row.provenance };
  }
  if (spec.type === 'expr') {
    return { ...core.check({ type: 'expr', ans: spec.ans, var: spec.var || 'x', sample: spec.sample }, String(input == null ? '' : input)), provenance: row.provenance };
  }
  const err = new Error('This key cannot be marked yet.');
  err.status = 400;
  throw err;
}

module.exports = {
  init, canonical, parseSolver, solveNode, solveMissing, importMemos, markNode, accepted, keyRow, ACCEPTED,
};

if (require.main === module) {
  const { DatabaseSync } = require('node:sqlite');
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'togisumasu.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  require('./catalog.js').init(db);
  const command = process.argv[2] || 'solve';
  const finish = result => { console.log(JSON.stringify(result)); db.close(); };
  if (command === 'import-memos') {
    finish(importMemos(db, process.argv[3] || path.join(__dirname, 'data', 'nsc', 'memos')));
  } else if (command === 'solve') {
    const limit = process.argv[3] ? Number(process.argv[3]) : undefined;
    solveMissing(db, { limit }).then(finish).catch(err => { console.error(err.message); process.exit(1); });
  } else {
    console.error('Use: node keys.js solve [limit]   or   node keys.js import-memos [dir]');
    process.exit(1);
  }
}
