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
  if (type === 'geom') {
    if (!Array.isArray(spec.chain) || !spec.chain.length) return null;
    return JSON.stringify({
      type,
      chain: spec.chain.map(step => ({ statement: String(step.statement || ''), reason: String(step.reason || '') })),
    });
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

const PAPER_ID = /^\d{4}-(nov|jun|mar)-p[1-3]$/;
const PART_ID = /^\d{4}-(nov|jun|mar)-p[1-3]-\d+(\.\d+)*$/;
const SR_TYPE = /^(S|R|S\/R|S-R|S OR R)$/i;

function validateMemo(memo, filename = 'memo') {
  if (!memo || typeof memo !== 'object') throw new Error(`${filename}: memo must be an object.`);
  if (!PAPER_ID.test(memo.id || '') || memo.id !== memo.paper_id) throw new Error(`${filename}: id must be the paper id.`);
  if (!Array.isArray(memo.parts) || !memo.parts.length) throw new Error(`${filename}: parts are required.`);
  if (!memo.source || !memo.source.pdf) throw new Error(`${filename}: source.pdf is required.`);
  if (!memo.extraction || !memo.extraction.date || !memo.extraction.method) throw new Error(`${filename}: extraction is required.`);
  const seen = new Set();
  for (const part of memo.parts) {
    if (!part || !PART_ID.test(part.id || '') || part.id !== part.question_id) throw new Error(`${filename}: bad part id ${part && part.id}.`);
    if (seen.has(part.id)) throw new Error(`${filename}: duplicate part ${part.id}.`);
    seen.add(part.id);
    if (!Number.isInteger(part.marks) || part.marks < 1) throw new Error(`${filename}: ${part.id} needs a positive mark total.`);
    if (typeof part.answer_md !== 'string' || typeof part.working_md !== 'string') throw new Error(`${filename}: ${part.id} needs answer_md and working_md.`);
    if (!Array.isArray(part.steps) || !part.steps.length) throw new Error(`${filename}: ${part.id} needs steps.`);
    for (const step of part.steps) validateStep(step, filename, part.id);
    if (!Array.isArray(part.alternatives)) throw new Error(`${filename}: ${part.id} alternatives must be a list.`);
    for (const alt of part.alternatives) {
      if (!alt || typeof alt.answer_md !== 'string' || !Array.isArray(alt.steps) || !alt.steps.length) throw new Error(`${filename}: ${part.id} has a bad alternative.`);
      for (const step of alt.steps) validateStep(step, filename, part.id);
    }
  }
  return memo;
}

function validateStep(step, filename, partId) {
  if (!step || !Number.isInteger(step.marks) || step.marks < 1) throw new Error(`${filename}: ${partId} has a step without marks.`);
  if (typeof step.description !== 'string' || !step.description.trim()) throw new Error(`${filename}: ${partId} has a step without a description.`);
  if (step.mark_type != null && typeof step.mark_type !== 'string') throw new Error(`${filename}: ${partId} has a bad mark type.`);
}

function latexToPlain(md) {
  let s = String(md || '');
  s = s.replace(/\(reject[\s\S]*?\)/gi, ' ');
  s = s.replace(/_\{[^{}]*\}/g, '');
  s = s.replace(/_[0-9]+/g, '');
  s = s.replace(/\\infty/g, '');
  let prev;
  do {
    prev = s;
    s = s.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  } while (s !== prev);
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\(?:mathrm|text|left|right|big|Big|hat|bar)\b/g, '');
  s = s.replace(/\\[,;:!]/g, '');
  s = s.replace(/\\[a-zA-Z]+/g, ' ');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/\$/g, ' ');
  s = s.replace(/\\/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function primaryValue(md) {
  const plain = latexToPlain(md);
  const rounded = [...plain.matchAll(/=\s*(-?\d+(?:\.\d+)?)(?!\s*\/)/g)];
  if (rounded.length) return Number(rounded[rounded.length - 1][1]);
  const named = plain.match(/^(?:[A-Za-z]+\s*=\s*)?(-?\d+(?:\.\d+)?)\s*(?:cm|units?|months|cups|players|degrees?)?$/i);
  if (named) return Number(named[1]);
  const signedFrac = plain.match(/(-?)\s*\(?\s*(\d+)\s*\)?\s*\/\s*\(?\s*(\d+)\s*\)?/);
  if (signedFrac) return (signedFrac[1] === '-' ? -1 : 1) * Number(signedFrac[2]) / Number(signedFrac[3]);
  const nums = plain.match(/-?\d+(?:\.\d+)?/g) || [];
  if (nums.length === 1) return Number(nums[0]);
  return null;
}

function splitStatementReason(description) {
  const text = String(description || '').trim();
  const match = text.match(/^(.*?)\[([^\]]+)\]\s*$/);
  if (match && match[1].trim()) return { statement: match[1].replace(/\s+/g, ' ').trim(), reason: match[2].replace(/\s+/g, ' ').trim() };
  return { statement: text.replace(/\s+/g, ' ').trim(), reason: '' };
}

function geometryChain(steps) {
  const marked = (steps || []).filter(step => step.mark_type && SR_TYPE.test(String(step.mark_type).trim()));
  if (!marked.length) return null;
  const pairs = [];
  let pending = null;
  const flush = reason => {
    if (!pending) return;
    pairs.push({ statement: pending, reason });
    pending = null;
  };
  for (const step of marked) {
    const type = String(step.mark_type).toUpperCase().replace(/\s+/g, ' ');
    const split = splitStatementReason(step.description);
    if (type === 'S/R' || type === 'S-R' || type === 'S OR R') {
      flush('follows from the line above');
      pairs.push({ statement: split.statement, reason: split.reason || step.description });
    } else if (type === 'S') {
      if (split.reason) {
        flush('follows from the line above');
        pairs.push({ statement: split.statement, reason: split.reason });
      } else {
        flush('follows from the line above');
        pending = split.statement;
      }
    } else if (split.reason) {
      flush('follows from the line above');
      pairs.push({ statement: split.statement, reason: split.reason });
    } else if (pending) {
      pairs.push({ statement: pending, reason: split.statement });
      pending = null;
    } else {
      pairs.push({ statement: step.description, reason: split.statement });
    }
  }
  flush('follows from the line above');
  return pairs.length ? pairs : null;
}

const EXTRA_REASONS = [
  'vertically opposite angles',
  'corresponding angles; parallel lines',
  'exterior angle of a cyclic quadrilateral',
  'angles opposite equal sides',
];
const EXTRA_STATEMENTS = [
  'the radii are equal',
  'the lines are perpendicular',
];

function geometrySpec(chain) {
  const statements = [];
  const reasons = [];
  const see = (list, text) => {
    const found = list.find(item => item.text === text);
    if (found) return found.id;
    const id = (list === statements ? 's' : 'r') + (list.length + 1);
    list.push({ id, text });
    return id;
  };
  const linked = chain.map(step => ({ statement: see(statements, step.statement), reason: see(reasons, step.reason) }));
  for (const text of EXTRA_STATEMENTS) if (statements.length < 2 || statements.length < linked.length + 1) see(statements, text);
  for (const text of EXTRA_REASONS) if (reasons.length < 2 || reasons.length < linked.length + 1) see(reasons, text);
  if (statements.length < 2) see(statements, 'a construction line is drawn');
  if (reasons.length < 2) see(reasons, 'given');
  return { type: 'geom', checkable: true, statements, reasons, chain: linked, ans: chain.map(step => step.statement).join('; '), ansTex: chain.map(step => step.statement).join('; ') };
}

// Answer forms beyond a single number: inequalities and intervals, points, general solutions,
// expressions and equations in a parameter, and ordered lists. Each builder returns null
// unless the memo answer parses cleanly, so prose stays on the key for review.
const PROSE_OK = /^(sqrt|cbrt|sin|cos|tan|ln|log|pi|inf|in|or|and|U)$/i;
function prose(n) {
  return (n.match(/[A-Za-z]{2,}/g) || []).some(word => !PROSE_OK.test(word));
}
function varsIn(text) {
  const used = new Set();
  const walkAst = node => {
    if (!node || typeof node !== 'object') return;
    if (node.t === 'var') used.add(node.n);
    walkAst(node.a); walkAst(node.b);
  };
  walkAst(core.parse(text));
  return [...used].sort();
}
function memoPlain(md) {
  return core.normMath(md, { decComma: true });
}

function trigSpec(md) {
  const n = memoPlain(md);
  if (!/\bk\b|k\s*\*|\*\s*k\b|\dk\b/.test(n) || prose(n.replace(/\bk\s+in\s+Z\b/g, ''))) return null;
  try {
    const fams = core.parseFamilies(md);
    if (!fams.length || fams.some(f => !f.period || Math.abs(f.period - Math.round(f.period)) > 1e-6)) return null;
    return { type: 'trig', checkable: true, fams, ans: n, ansTex: md.trim(), tol: 0.015 };
  } catch (err) { return null; }
}

function regionSpec(md) {
  const n = memoPlain(md);
  if (prose(n.replace(/\b[a-zA-Z]\s+in\s+/g, ' '))) return null;
  try {
    const chunks = core.parseRegion(md, { decComma: true });
    const vars = [...new Set(chunks.map(c => c.v).filter(Boolean))];
    if (vars.length > 1) return null;
    const alts = core.regionAlts(chunks);
    if (!alts.length || alts.some(a => !a.length)) return null;
    return { type: 'region', checkable: true, var: vars[0] || null, alts, ans: n, ansTex: md.trim(), tol: 0.006 };
  } catch (err) { return null; }
}

function pointsSpec(md) {
  const n = memoPlain(md);
  try {
    const parsed = core.parsePoints(md, { decComma: true });
    const coords = parsed.pts.flat();
    const vars = [...new Set(coords.flatMap(varsIn))];
    if (vars.length > 2 || (parsed.names && vars.length)) return null;
    if (!parsed.pts.length || parsed.pts.length > 6) return null;
    const spec = { type: 'points', checkable: true, pts: parsed.pts, names: parsed.names, vars, ans: n, ansTex: md.trim(), tol: 0.006 };
    if (!core.check(spec, n).ok) return null;
    return spec;
  } catch (err) { return null; }
}

const LABEL_LHS = /^\s*(?:[A-Za-z]{1,2}['’′]?(?:\^\(?-1\)?)?(?:\([a-z]\))?|d[a-z]\/d[a-z])\s*$/;
function exprSpec(md) {
  const chunk = String(md || '').split(/\s+or\s+/i)[0];
  if (/log_|\\sum/.test(chunk)) return null;
  const n = memoPlain(chunk).replace(/\s*(cm|units?|degrees?)\s*$/i, '');
  if (!n || n.length > 200 || / in /.test(n) || /[,;]/.test(n) || /[<>!]/.test(n)) return null;
  const sides = n.split('=').map(s => s.trim());
  if (sides.length > 3 || sides.some(s => !s)) return null;
  try {
    if (sides.length === 1) {
      if (prose(n) || /^[A-Za-z]$/.test(n)) return null;
      const vars = varsIn(n);
      if (vars.length > 2) return null;
      return { type: 'expr', checkable: true, ans: n, ansTex: chunk.trim(), var: vars[0] || 'x', vars: vars.length ? vars : ['x'], label: true };
    }
    const rhs = sides[1];
    if (prose(sides.slice(1).join(' '))) return null;
    const label = LABEL_LHS.test(sides[0]) || (!prose(sides[0]) && varsIn(sides[0]).length === 0);
    const rhsVars = varsIn(rhs);
    if (label && !(sides[0] === 'y' && rhsVars.length === 1 && rhsVars[0] !== 'y')) {
      if (rhsVars.length > 2) return null;
      return { type: 'expr', checkable: true, ans: rhs, ansTex: chunk.trim(), var: rhsVars[0] || 'x', vars: rhsVars.length ? rhsVars : ['x'], label: true };
    }
    if (prose(sides[0])) return null;
    const vars = [...new Set([...varsIn(sides[0]), ...rhsVars])].sort();
    if (vars.length < 1 || vars.length > 2) return null;
    return { type: 'eqn', checkable: true, lhs: sides[0], rhs, vars, ans: sides[0] + ' = ' + rhs, ansTex: chunk.trim() };
  } catch (err) { return null; }
}

const UNIT_TAIL = /\s*(?:units?|cm|mm|km|m|minutes?|hours?|degrees?)(?:\s*\^\s*\(?[23]\)?)?\s*$/i;
function valueSpec(md) {
  const n = memoPlain(md);
  if (/[<>!]/.test(n) || / in /.test(n) || /^[A-Za-z]$/.test(n)) return null;
  const listed = n.split(/\s*;\s*/);
  if (listed.length >= 2 && listed.length <= 8) {
    try {
      const vals = listed.map(item => core.ev(core.parse(item.replace(/^[A-Za-z]\w*\s*=\s*/, '')), {}));
      if (vals.every(Number.isFinite)) return { type: 'tuple', checkable: true, vals, ans: listed.join('; '), ansTex: md.trim(), tol: 0.006 };
    } catch (err) { /* not a list of numbers */ }
  }
  const chunks = n.split(/\s+or\s+/i).map(chunk => {
    let text = chunk.replace(UNIT_TAIL, '').trim();
    const eq = text.lastIndexOf('=');
    if (eq >= 0) text = text.slice(eq + 1).trim();
    text = text.replace(/(\d) (?=\d{3}\b)/g, '$1');
    try { return core.ev(core.parse(text), {}); } catch (err) { return NaN; }
  });
  if (chunks.length && chunks.every(Number.isFinite) && chunks.every(v => Math.abs(v - chunks[0]) <= 1e-9 * Math.max(1, Math.abs(v)))) {
    return { type: 'num', checkable: true, val: chunks[0], ans: String(chunks[0]), ansTex: md.trim(), tol: 0.015 };
  }
  return null;
}

const FORM_ORDER = {
  inequality: [trigSpec, regionSpec],
  set: [regionSpec, pointsSpec],
  description: [regionSpec],
  solution_set: [trigSpec, regionSpec, pointsSpec],
  coordinates: [pointsSpec],
  equation: [trigSpec, pointsSpec, exprSpec, valueSpec],
  expression: [exprSpec, valueSpec, regionSpec],
  show_that: [exprSpec, pointsSpec],
  value: [valueSpec, pointsSpec, regionSpec, exprSpec],
};
function formSpec(md, answerType) {
  for (const build of FORM_ORDER[answerType] || []) {
    const spec = build(md);
    // a key is kept only if the memo answer marks itself correct
    if (!spec) continue;
    spec.deg = true;
    if ((spec.type === 'expr' || spec.type === 'eqn') && /\b(sin|cos|tan)\b/.test(spec.ans)) spec.sample = [-170, 170];
    if (core.check(spec, spec.ans).ok === true) return spec;
  }
  return null;
}

function expressionSpec(md) {
  return exprSpec(md);
}

function numericSpec(md, answerType) {
  if (answerType === 'solution_set' && /\\in|k\s*\\cdot|y\s*=/.test(md) && /x\s*=/.test(md)) return null;
  if (answerType === 'solution_set') {
    const body = String(md).replace(/\(reject[\s\S]*?\)/gi, '');
    const pieces = body.split(/\s+or\s+/i).map(piece => primaryValue(piece)).filter(v => Number.isFinite(v));
    if (pieces.length >= 1 && pieces.length <= 6) return { type: 'set', checkable: true, vals: pieces, ans: pieces.join(', '), ansTex: md.trim(), tol: 0.015 };
    return null;
  }
  const val = primaryValue(md);
  if (!Number.isFinite(val)) return null;
  return { type: 'num', checkable: true, val, ans: String(val), ansTex: md.trim(), tol: 0.015 };
}

// Examiner and transcriber notes, kept verbatim. A memo typo is transcribed as printed and
// explained in a note; the note travels with the key so the review screen can show it.
function memoNotes(part) {
  const out = [];
  const add = (where, text) => { if (typeof text === 'string' && text.trim()) out.push({ where, text: text.trim() }); };
  add('answer', part.notes);
  (part.steps || []).forEach((step, i) => add('step ' + (i + 1), step.notes));
  (part.alternatives || []).forEach((alt, i) => {
    add('alternative ' + (i + 1), alt.notes);
    (alt.steps || []).forEach((step, j) => add('alternative ' + (i + 1) + ', step ' + (j + 1), step.notes));
  });
  return out;
}

function memoPartToSpec(part, answerType) {
  const chain = geometryChain(part.steps) || (part.alternatives || []).map(alt => geometryChain(alt.steps)).find(Boolean);
  let check = null;
  if (chain) check = geometrySpec(chain);
  else if (answerType === 'value' || answerType === 'show_that' || answerType === 'solution_set') check = numericSpec(part.answer_md, answerType === 'show_that' ? 'value' : answerType);
  else if (answerType === 'expression' || answerType === 'show_that') check = expressionSpec(part.answer_md);
  if (!check && (answerType === 'expression' || answerType === 'equation' || answerType === 'show_that')) check = expressionSpec(part.answer_md);
  if (!check) check = formSpec(part.answer_md, answerType);
  const base = {
    memo_notes: memoNotes(part),
    answer_md: part.answer_md,
    working_md: part.working_md,
    notes: part.notes || null,
    marks: part.marks,
    steps: part.steps,
    alternatives: part.alternatives || [],
    answerType: answerType || null,
  };
  if (!check) return { ...base, type: 'memo', checkable: false, ans: part.answer_md, ansTex: part.answer_md };
  return { ...base, ...check };
}

function importMemoFile(db, file) {
  const memo = validateMemo(JSON.parse(fs.readFileSync(file, 'utf8')), path.basename(file));
  const lookup = db.prepare('SELECT id, answer_type, paper_id FROM nsc_nodes WHERE id = ? AND is_leaf = 1');
  const setRef = db.prepare('UPDATE nsc_nodes SET memo_ref = ? WHERE id = ?');
  const stats = { keys: 0, checkable: 0, geom: 0, unchecked: [], notes: [] };
  for (const part of memo.parts) {
    const node = lookup.get(part.question_id || part.id);
    if (!node) throw new Error(`${path.basename(file)}: ${part.id} is not an imported question leaf.`);
    if (node.paper_id !== memo.paper_id) throw new Error(`${part.id} belongs to ${node.paper_id}, not ${memo.paper_id}.`);
    const spec = memoPartToSpec(part, node.answer_type);
    saveKey(db, node.id, { provenance: 'memo', answer: spec, steps: part.steps, solverA: null, solverB: null });
    setRef.run(part.id, node.id);
    stats.keys++;
    if (spec.memo_notes.length) stats.notes.push({ id: node.id, notes: spec.memo_notes });
    if (spec.checkable) stats.checkable++;
    else stats.unchecked.push({ id: node.id, answerType: node.answer_type, answer: part.answer_md });
    if (spec.type === 'geom') stats.geom++;
  }
  return stats;
}

function importLegacyAnswers(db, memo, filename) {
  const answers = memo.answers || {};
  let keys = 0;
  for (const [nodeId, answer] of Object.entries(answers)) {
    if (!canonical(answer)) throw new Error(`${filename}: ${nodeId} has no comparable answer.`);
    const node = db.prepare('SELECT id FROM nsc_nodes WHERE id = ? AND is_leaf = 1').get(nodeId);
    if (!node) throw new Error(`${filename}: ${nodeId} is not an imported question.`);
    const spec = { ...answer, checkable: true, answer_md: answer.ansTex || answer.ans, steps: answer.steps || [], alternatives: answer.alternatives || [] };
    saveKey(db, nodeId, { provenance: 'memo', answer: spec, steps: answer.steps || [], solverA: null, solverB: null });
    db.prepare('UPDATE nsc_nodes SET memo_ref = ? WHERE id = ?').run(nodeId, nodeId);
    keys++;
  }
  return { keys, checkable: keys, geom: 0, unchecked: [], notes: [] };
}

function importMemos(db, dir) {
  init(db);
  if (!dir || !fs.existsSync(dir)) throw new Error('Memo directory not found.');
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort();
  const stats = { files: files.length, keys: 0, checkable: 0, geom: 0, unchecked: [], notes: [], papers: {} };
  for (const name of files) {
    const file = path.join(dir, name);
    const memo = JSON.parse(fs.readFileSync(file, 'utf8'));
    const part = Array.isArray(memo.parts) ? importMemoFile(db, file) : importLegacyAnswers(db, memo, name);
    stats.keys += part.keys;
    stats.checkable += part.checkable;
    stats.geom += part.geom;
    stats.unchecked.push(...part.unchecked);
    stats.notes.push(...(part.notes || []));
    stats.papers[name.replace(/\.json$/, '')] = { scored: part.checkable, unscored: part.keys - part.checkable };
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
  if (spec.type === 'memo' || spec.checkable === false) {
    return { ok: null, checkable: false, provenance: row.provenance, answer: spec.answer_md || spec.ans || null, memoNotes: spec.memo_notes || [] };
  }
  if (spec.type === 'geom') {
    const chain = Array.isArray(input) ? input : [];
    return { ...core.check(spec, chain), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ansTex || null };
  }
  if (spec.type === 'text') {
    return { ok: normText(input) === normText(spec.ans), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ans || null };
  }
  if (spec.type === 'set') {
    return { ...core.check({ type: 'set', vals: spec.vals, ans: spec.ans, tol: spec.tol }, String(input == null ? '' : input)), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ansTex || null };
  }
  if (spec.type === 'num') {
    return { ...core.check({ type: 'num', val: spec.val, ans: spec.ans, exact: !!spec.exact, tol: spec.tol }, String(input == null ? '' : input)), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ansTex || null };
  }
  if (core.FORMS[spec.type] || (spec.type === 'expr' && (spec.vars || spec.label))) {
    return { ...core.check(spec, String(input == null ? '' : input)), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ansTex || null, kind: spec.type };
  }
  if (spec.type === 'expr') {
    return { ...core.check({ type: 'expr', ans: spec.ans, var: spec.var || 'x', sample: spec.sample }, String(input == null ? '' : input)), checkable: true, provenance: row.provenance, answer: spec.answer_md || spec.ansTex || null };
  }
  const err = new Error('This key cannot be marked yet.');
  err.status = 400;
  throw err;
}

module.exports = {
  init, canonical, parseSolver, solveNode, solveMissing, importMemos, markNode, accepted, keyRow, ACCEPTED,
  validateMemo, memoPartToSpec, primaryValue, geometryChain, formSpec,
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
