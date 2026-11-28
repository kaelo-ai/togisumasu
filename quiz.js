// Quiz assembly and exam papers.
// A quiz always includes one NSC leaf from the practice view, and only when
// every topic that leaf maps to (and those topics' in-course prerequisites)
// is in the mastered set. The practice view is the only read path, so a
// 2022+ paper cannot be selected. Exams are the exam view, full papers.
'use strict';
const core = require('./public/core.js');
const nsc = require('./nsc.js');
const catalog = require('./catalog.js');
const bank = require('./questions.js');
const diagrams = require('./diagrams.js');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tableHtml(raw) {
  if (!raw) return '';
  let table;
  try { table = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch (err) { return ''; }
  if (!table || !Array.isArray(table.header)) return '';
  const cell = value => escapeHtml(value);
  const head = '<tr>' + table.header.map(h => `<th>${cell(h)}</th>`).join('') + '</tr>';
  const body = (table.rows || []).map(row => '<tr>' + row.map(c => `<td>${cell(c)}</td>`).join('') + '</tr>').join('');
  const caption = table.caption ? `<caption>${cell(table.caption)}</caption>` : '';
  return `<table class="nsc-table">${caption}${head}${body}</table>`;
}

function promptHtml(db, nodeId) {
  const chain = [];
  let id = nodeId;
  const get = db.prepare('SELECT * FROM nsc_nodes WHERE id = ?');
  const seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const row = get.get(id);
    if (!row) break;
    chain.push(row);
    id = row.parent_id;
  }
  chain.reverse();
  const blocks = [];
  const figureIds = [];
  for (const node of chain) {
    if (node.stem_md) blocks.push(`<p>${escapeHtml(node.stem_md)}</p>`);
    if (node.table_json) blocks.push(tableHtml(node.table_json));
    if (node.text_md) blocks.push(`<p>${escapeHtml(node.text_md)}</p>`);
    let ids = [];
    try { ids = JSON.parse(node.figure_ids || '[]'); } catch (err) { ids = []; }
    for (const id of ids) if (!figureIds.includes(id)) figureIds.push(id);
  }
  if (figureIds.length) {
    const rows = db.prepare(`SELECT * FROM nsc_figures WHERE id IN (${figureIds.map(() => '?').join(',')})`).all(...figureIds);
    for (const row of rows) blocks.push(diagrams.render(row));
  }
  return blocks.join('\n');
}

function neededTopics(topics, preOf) {
  const needed = new Set(topics);
  const stack = [...topics];
  while (stack.length) {
    const id = stack.pop();
    for (const pre of preOf.get(id) || []) {
      if (!needed.has(pre)) { needed.add(pre); stack.push(pre); }
    }
  }
  return needed;
}

function courseMaps(db, courseId) {
  const course = catalog.learner(db, courseId || 'gr12-caps');
  return {
    course,
    members: new Set(course.topics.map(topic => topic.id)),
    preOf: new Map(course.topics.map(topic => [topic.id, topic.pre])),
  };
}

// Leaves the learner may be quizzed on. Reads nsc_practice_leaves only.
function eligibleLeaves(db, mastered, courseId) {
  const { members, preOf } = courseMaps(db, courseId);
  const have = new Set((Array.isArray(mastered) ? mastered : []).map(String).filter(id => members.has(id)));
  const rows = db.prepare(`
    SELECT n.*, p.year, p.pool, p.paper AS paper_no
    FROM nsc_practice_leaves n
    JOIN nsc_papers p ON p.id = n.paper_id
    JOIN nsc_answer_keys k ON k.node_id = n.id
    WHERE k.provenance IN ('memo', 'llm_double')
      AND COALESCE(json_extract(k.answer_json, '$.checkable'), 1) != 0
      AND COALESCE(json_extract(k.answer_json, '$.type'), '') != 'memo'
    ORDER BY n.id
  `).all();
  const out = [];
  for (const row of rows) {
    if (row.pool !== 'practice' || row.year >= nsc.EXAM_FROM_YEAR) continue;
    if (row.on_syllabus === 0) continue;
    const topics = nsc.topicsForNode(db, row.id).filter(id => members.has(id));
    if (!topics.length) continue;
    const needed = neededTopics(topics, preOf);
    let ready = true;
    for (const id of needed) if (!have.has(id)) { ready = false; break; }
    if (!ready) continue;
    const kind = (db.prepare('SELECT json_extract(answer_json, \'$.type\') AS kind FROM nsc_answer_keys WHERE node_id = ?').get(row.id) || {}).kind || null;
    out.push({ id: row.id, paperId: row.paper_id, year: row.year, number: row.number, marks: row.marks, topics, answerType: row.answer_type, form: kind });
  }
  return out;
}

function paperItem(db, leaf) {
  let geom = null;
  if (leaf.form === 'geom') {
    const key = db.prepare(`SELECT answer_json FROM nsc_answer_keys WHERE node_id = ?`).get(leaf.id);
    const spec = key ? JSON.parse(key.answer_json) : null;
    if (spec && spec.type === 'geom') geom = { statements: spec.statements, reasons: spec.reasons };
  }
  return {
    geom,
    kind: 'paper',
    id: leaf.id,
    paperId: leaf.paperId,
    year: leaf.year,
    number: leaf.number,
    marks: leaf.marks,
    topics: leaf.topics,
    answerType: leaf.answerType,
    form: leaf.form || null,
    hint: (leaf.form && core.HINTS[leaf.form]) || null,
    prompt: promptHtml(db, leaf.id),
    markable: true,
  };
}

function assembleQuiz(db, input = {}) {
  const courseId = input.courseId || 'gr12-caps';
  const eligible = eligibleLeaves(db, input.mastered, courseId);
  if (!eligible.length) return { ok: false, reason: 'no-eligible-past-paper', items: [] };
  const index = Number.isInteger(input.choice) ? Math.abs(input.choice) % eligible.length : Math.floor(Math.random() * eligible.length);
  const paper = paperItem(db, eligible[index]);
  const mastered = [...new Set((input.mastered || []).map(String))];
  const target = Math.min(8, Math.max(5, mastered.length || 1));
  const items = [paper];
  const seen = new Map();
  let guard = 0;
  while (items.length < target && mastered.length && guard < target * 12) {
    const topicId = mastered[guard % mastered.length];
    guard++;
    const exclude = seen.get(topicId) || [];
    const question = bank.next(db, topicId, exclude);
    if (!question) continue;
    exclude.push(question.fingerprint);
    seen.set(topicId, exclude);
    items.push({ kind: 'generated', topicId, question });
  }
  if (input.shuffle !== false) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
  return { ok: true, courseId, items };
}

// CAPS topic names for exam headings, from the NSC taxonomy (M1 to M13).
const TOPIC_SHORT = {
  M1: 'Exponents & surds', M2: 'Algebra', M3: 'Sequences & series', M4: 'Functions',
  M5: 'Trig functions', M6: 'Finance', M7: 'Calculus', M8: 'Probability',
  M9: 'Analytical geometry', M10: 'Trigonometry', M11: 'Sine, cosine & area rules',
  M12: 'Euclidean geometry', M13: 'Statistics',
};
let TOPIC_NAMES = null;
function topicNames() {
  if (TOPIC_NAMES) return TOPIC_NAMES;
  TOPIC_NAMES = {};
  try {
    const file = require('node:path').join(__dirname, 'data', 'nsc', 'taxonomy', 'topics.json');
    const tax = JSON.parse(require('node:fs').readFileSync(file, 'utf8'));
    for (const unit of tax.units || []) TOPIC_NAMES[unit.id] = { name: unit.name, short: TOPIC_SHORT[unit.id] || unit.name };
  } catch (err) { /* fall back to the short names */ }
  for (const [code, short] of Object.entries(TOPIC_SHORT)) if (!TOPIC_NAMES[code]) TOPIC_NAMES[code] = { name: short, short };
  return TOPIC_NAMES;
}

const MONTHS = { november: 'November', nov: 'November', june: 'June', may: 'May', march: 'March', feb: 'February', february: 'February' };
function paperTitle(paper) {
  const s = String(paper.session || '').toLowerCase();
  const month = MONTHS[s] || (s ? s[0].toUpperCase() + s.slice(1) : 'November');
  return `${month} ${paper.year} · Paper ${paper.paper}`;
}

// Topic codes of a set of leaves, heaviest first (ties keep paper order).
function topicWeights(leaves) {
  const order = [], marks = new Map();
  for (const leaf of leaves) {
    const code = leaf.caps_topic || 'other';
    if (!marks.has(code)) { marks.set(code, 0); order.push(code); }
    marks.set(code, marks.get(code) + (leaf.marks || 0));
  }
  return order.map((code, i) => ({ code, marks: marks.get(code), i }))
    .sort((a, b) => b.marks - a.marks || a.i - b.i).map(({ code, marks: m }) => ({ code, marks: m }));
}

// The top-level questions of a paper, each holding its shared stem once and its parts in order.
function paperTree(db, paperId) {
  const nodes = db.prepare('SELECT * FROM nsc_nodes WHERE paper_id = ? ORDER BY ord').all(paperId);
  const kids = new Map();
  for (const node of nodes) {
    const key = node.parent_id || '';
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(node);
  }
  return { nodes, kids, tops: kids.get('') || [] };
}

function ownHtml(db, node, seenFigures) {
  const blocks = [];
  if (node.stem_md) blocks.push(`<p>${escapeHtml(node.stem_md)}</p>`);
  if (node.table_json) blocks.push(tableHtml(node.table_json));
  if (node.text_md) blocks.push(`<p>${escapeHtml(node.text_md)}</p>`);
  let ids = [];
  try { ids = JSON.parse(node.figure_ids || '[]'); } catch (err) { ids = []; }
  ids = ids.filter(id => !seenFigures.has(id));
  ids.forEach(id => seenFigures.add(id));
  if (ids.length) {
    const rows = db.prepare(`SELECT * FROM nsc_figures WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const id of ids) if (byId.has(id)) blocks.push(diagrams.render(byId.get(id)));
  }
  return blocks.join('\n');
}

function paperTopicLine(db, paperId) {
  const names = topicNames();
  const { kids, tops } = paperTree(db, paperId);
  const leavesUnder = node => {
    const out = [];
    const walk = n => { const c = kids.get(n.id) || []; if (!c.length) out.push(n); else c.forEach(walk); };
    walk(node);
    return out;
  };
  const seen = [];
  for (const top of tops) {
    const main = topicWeights(leavesUnder(top))[0];
    if (main && names[main.code] && !seen.includes(main.code)) seen.push(main.code);
  }
  return seen.map(code => names[code].short);
}

function listExams(db) {
  return nsc.examPapers(db).map(paper => ({
    id: paper.id,
    year: paper.year,
    paper: paper.paper,
    session: paper.session,
    title: paperTitle(paper),
    topics: paperTopicLine(db, paper.id),
    questionCount: paperTree(db, paper.id).tops.length,
    totalMarks: paper.total_marks,
    durationMinutes: paper.duration_minutes || 180,
    pool: paper.pool,
  }));
}

function examPaper(db, paperId) {
  const paper = db.prepare('SELECT * FROM nsc_exam_papers WHERE id = ?').get(String(paperId || ''));
  if (!paper) return null;
  const names = topicNames();
  const keyStmt = db.prepare(`SELECT answer_json FROM nsc_answer_keys WHERE node_id = ? AND provenance IN ('memo', 'llm_double')`);
  const { kids, tops } = paperTree(db, paper.id);
  const questions = [];
  const groups = tops.map(top => {
    const seenFigures = new Set();
    const group = { id: top.id, number: String(top.number), stem: '', blocks: [], parts: [] };
    const asPart = (leaf, html, depth) => {
      const key = keyStmt.get(leaf.id);
      let checkable = false, geom = null, kind = null, notes = [];
      if (key) {
        const spec = JSON.parse(key.answer_json);
        checkable = !!spec.checkable;
        kind = checkable ? spec.type : null;
        notes = Array.isArray(spec.memo_notes) ? spec.memo_notes : [];
        if (spec.type === 'geom') geom = { statements: spec.statements, reasons: spec.reasons };
      }
      const question = {
        id: leaf.id,
        number: leaf.number,
        group: group.number,
        depth,
        marks: leaf.marks,
        answerType: leaf.answer_type,
        topic: leaf.caps_topic || 'other',
        html,
        topics: nsc.topicsForNode(db, leaf.id),
        servable: !!key,
        checkable,
        form: kind,
        hint: (kind && core.HINTS[kind]) || null,
        memoNotes: notes,
        geom,
      };
      questions.push(question);
      group.parts.push(leaf.id);
      group.blocks.push({ kind: 'part', id: leaf.id });
      return leaf;
    };
    const leaves = [];
    const walk = (node, depth) => {
      const children = kids.get(node.id) || [];
      if (!children.length) { leaves.push(asPart(node, ownHtml(db, node, seenFigures), depth)); return; }
      const html = ownHtml(db, node, seenFigures);
      if (depth === 0) group.stem = html;
      else if (html) group.blocks.push({ kind: 'stem', number: String(node.number), depth, html });
      children.forEach(child => walk(child, depth + 1));
    };
    if ((kids.get(top.id) || []).length) walk(top, 0);
    else leaves.push(asPart(top, ownHtml(db, top, seenFigures), 0));
    const weights = topicWeights(leaves);
    group.marks = leaves.reduce((sum, leaf) => sum + (leaf.marks || 0), 0);
    group.topics = weights.map(w => ({ ...w, name: names[w.code] ? names[w.code].name : 'Other', short: names[w.code] ? names[w.code].short : 'Other' }));
    group.heading = group.topics.filter(t => t.code !== 'other').slice(0, 2).map(t => t.short).join(' · ') || 'Mixed';
    return group;
  });
  return {
    id: paper.id,
    year: paper.year,
    paper: paper.paper,
    session: paper.session,
    title: paperTitle(paper),
    totalMarks: paper.total_marks,
    durationMinutes: paper.duration_minutes || 180,
    pool: paper.pool,
    topicNames: names,
    groups,
    questions,
  };
}

function markExam(db, paperId, answers) {
  const paper = examPaper(db, paperId);
  if (!paper) return null;
  const keys = require('./keys.js');
  const given = answers && typeof answers === 'object' ? answers : {};
  return paper.questions.map(question => {
    let marked;
    try { marked = keys.markNode(db, question.id, given[question.id]); }
    catch (err) { marked = { ok: null, checkable: false, answer: null }; }
    return {
      id: question.id,
      number: question.number,
      marks: question.marks,
      ok: marked.ok,
      checkable: !!marked.checkable,
      answer: marked.answer || null,
      memoNotes: question.memoNotes,
    };
  });
}

module.exports = { eligibleLeaves, assembleQuiz, listExams, examPaper, markExam, promptHtml, paperTitle, topicNames };
