// Idempotent import of the NSC Mathematics papers in data/nsc.
// Pool is a property of the year, enforced by a CHECK constraint and by the
// views every read goes through. 2022 and later is the exam pool. Earlier
// papers are the practice pool. Quizzes must use the practice view.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BANK = path.join(__dirname, 'data', 'nsc');
const EXAM_FROM_YEAR = 2022;

function poolForYear(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) {
    const err = new Error('NSC year must be an integer.');
    err.status = 400;
    throw err;
  }
  return y >= EXAM_FROM_YEAR ? 'exam' : 'practice';
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nsc_papers (
      id            TEXT PRIMARY KEY,
      year          INTEGER NOT NULL,
      session       TEXT NOT NULL,
      paper         INTEGER NOT NULL,
      total_marks   INTEGER NOT NULL,
      duration_minutes INTEGER,
      pool          TEXT NOT NULL,
      content_hash  TEXT NOT NULL,
      source_url    TEXT,
      imported_at   INTEGER NOT NULL,
      CHECK (
        (year < ${EXAM_FROM_YEAR} AND pool = 'practice')
        OR (year >= ${EXAM_FROM_YEAR} AND pool = 'exam')
      )
    );
    CREATE TABLE IF NOT EXISTS nsc_nodes (
      id            TEXT PRIMARY KEY,
      paper_id      TEXT NOT NULL,
      number        TEXT NOT NULL,
      parent_id     TEXT,
      level         INTEGER NOT NULL,
      ord           INTEGER NOT NULL,
      stem_md       TEXT,
      text_md       TEXT,
      marks         INTEGER,
      total_marks   INTEGER,
      answer_type   TEXT,
      caps_topic    TEXT,
      caps_subtopic TEXT,
      is_leaf       INTEGER NOT NULL,
      figure_ids    TEXT NOT NULL DEFAULT '[]',
      table_json    TEXT,
      memo_ref      TEXT,
      review_status TEXT,
      notes         TEXT
    );
    CREATE INDEX IF NOT EXISTS nsc_nodes_paper ON nsc_nodes(paper_id, ord);
    CREATE INDEX IF NOT EXISTS nsc_nodes_parent ON nsc_nodes(parent_id);
    CREATE TABLE IF NOT EXISTS nsc_node_skills (
      node_id   TEXT NOT NULL,
      bank_code TEXT NOT NULL,
      position  INTEGER NOT NULL,
      PRIMARY KEY (node_id, bank_code)
    );
    CREATE INDEX IF NOT EXISTS nsc_node_skills_code ON nsc_node_skills(bank_code);
    CREATE TABLE IF NOT EXISTS nsc_figures (
      id        TEXT PRIMARY KEY,
      paper_id  TEXT NOT NULL,
      kind      TEXT NOT NULL,
      caption   TEXT NOT NULL DEFAULT '',
      exact     INTEGER NOT NULL,
      spec_json TEXT NOT NULL,
      used_by   TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS nsc_figures_paper ON nsc_figures(paper_id);
  `);
  // Views are the read API. Both conditions are in the SQL so a caller cannot
  // ask the practice view for a 2022 paper.
  db.exec(`
    DROP VIEW IF EXISTS nsc_practice_leaves;
    DROP VIEW IF EXISTS nsc_exam_papers;
    CREATE VIEW nsc_practice_leaves AS
      SELECT n.* FROM nsc_nodes n
      JOIN nsc_papers p ON p.id = n.paper_id
      WHERE n.is_leaf = 1 AND p.pool = 'practice' AND p.year < ${EXAM_FROM_YEAR};
    CREATE VIEW nsc_exam_papers AS
      SELECT * FROM nsc_papers
      WHERE pool = 'exam' AND year >= ${EXAM_FROM_YEAR};
  `);
}

function recordPaper(db, row) {
  const pool = row.pool == null ? poolForYear(row.year) : String(row.pool);
  db.prepare(`
    INSERT INTO nsc_papers
      (id, year, session, paper, total_marks, duration_minutes, pool, content_hash, source_url, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.id, Number(row.year), String(row.session || ''), Number(row.paper),
    Number(row.totalMarks), row.durationMinutes == null ? null : Number(row.durationMinutes),
    pool, String(row.contentHash || ''), row.sourceUrl || null, Date.now(),
  );
}

function topicsForCodes(db, codes) {
  const out = [];
  const lookup = db.prepare('SELECT topic_id FROM bank_skill_map WHERE bank_code = ?');
  for (const code of codes) {
    const row = lookup.get(code);
    if (row && !out.includes(row.topic_id)) out.push(row.topic_id);
  }
  return out;
}

function topicsForNode(db, nodeId) {
  const codes = db.prepare('SELECT bank_code FROM nsc_node_skills WHERE node_id = ? ORDER BY position').all(nodeId)
    .map(r => r.bank_code);
  return topicsForCodes(db, codes);
}

function practiceLeaves(db) {
  return db.prepare('SELECT * FROM nsc_practice_leaves ORDER BY paper_id, ord').all();
}

function examPapers(db) {
  return db.prepare('SELECT * FROM nsc_exam_papers ORDER BY year, paper').all();
}

function leafMarks(questions) {
  const ids = new Set(questions.map(q => q.id));
  const parents = new Set(questions.map(q => q.parent).filter(Boolean));
  let sum = 0;
  for (const q of questions) {
    if (!parents.has(q.id)) {
      if (q.marks == null) throw new Error(`${q.id} is a leaf without marks.`);
      sum += q.marks;
    } else if (q.marks != null) {
      throw new Error(`${q.id} is a container but has marks.`);
    }
    if (q.parent && !ids.has(q.parent)) throw new Error(`${q.id} points at a missing parent.`);
  }
  return sum;
}

function writePaper(db, paper, hash) {
  const sum = leafMarks(paper.questions);
  if (paper.total_marks !== 150 || sum !== paper.total_marks) {
    throw new Error(`${paper.id} totals ${sum} leaf marks, paper says ${paper.total_marks} (expected 150).`);
  }
  const year = Number(paper.year);
  const pool = poolForYear(year);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM nsc_node_skills WHERE node_id IN (SELECT id FROM nsc_nodes WHERE paper_id = ?)').run(paper.id);
    db.prepare('DELETE FROM nsc_nodes WHERE paper_id = ?').run(paper.id);
    db.prepare('DELETE FROM nsc_figures WHERE paper_id = ?').run(paper.id);
    db.prepare('DELETE FROM nsc_papers WHERE id = ?').run(paper.id);
    recordPaper(db, {
      id: paper.id, year, session: paper.session, paper: paper.paper,
      totalMarks: paper.total_marks, durationMinutes: paper.duration_minutes,
      pool, contentHash: hash, sourceUrl: paper.source && paper.source.url,
    });
    const insertNode = db.prepare(`
      INSERT INTO nsc_nodes
        (id, paper_id, number, parent_id, level, ord, stem_md, text_md, marks, total_marks,
         answer_type, caps_topic, caps_subtopic, is_leaf, figure_ids, table_json, memo_ref, review_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSkill = db.prepare('INSERT INTO nsc_node_skills (node_id, bank_code, position) VALUES (?, ?, ?)');
    const parents = new Set(paper.questions.map(q => q.parent).filter(Boolean));
    for (const q of paper.questions) {
      const leaf = !parents.has(q.id);
      insertNode.run(
        q.id, q.paper_id, q.number, q.parent, q.level, q.order,
        q.stem_md, q.text_md, q.marks, q.total_marks == null ? null : q.total_marks,
        q.answer_type, q.topic, q.subtopic, leaf ? 1 : 0,
        JSON.stringify(q.figure_ids || []), q.table ? JSON.stringify(q.table) : null,
        q.memo_ref, q.review_status, q.notes || null,
      );
      (q.skills || []).forEach((code, i) => insertSkill.run(q.id, code, i));
    }
    const insertFig = db.prepare(`
      INSERT INTO nsc_figures (id, paper_id, kind, caption, exact, spec_json, used_by) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const fig of paper.figures || []) {
      insertFig.run(fig.id, fig.paper_id, fig.kind, fig.caption || '', fig.exact ? 1 : 0, JSON.stringify(fig.spec || {}), JSON.stringify(fig.used_by || []));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function importFile(db, file) {
  const raw = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const paper = JSON.parse(raw.toString('utf8'));
  const existing = db.prepare('SELECT content_hash FROM nsc_papers WHERE id = ?').get(paper.id);
  if (existing && existing.content_hash === hash) return 'unchanged';
  writePaper(db, paper, hash);
  return existing ? 'updated' : 'inserted';
}

function importAll(db, dir = path.join(BANK, 'papers')) {
  initSchema(db);
  if (!fs.existsSync(dir)) throw new Error('NSC paper directory not found: ' + dir);
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort();
  const stats = { inserted: 0, updated: 0, unchanged: 0, files: files.length };
  for (const name of files) {
    const result = importFile(db, path.join(dir, name));
    stats[result]++;
  }
  return stats;
}

module.exports = {
  EXAM_FROM_YEAR, BANK, poolForYear, initSchema, recordPaper, importAll, importFile,
  practiceLeaves, examPapers, topicsForNode, topicsForCodes,
};

if (require.main === module) {
  const { DatabaseSync } = require('node:sqlite');
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'togisumasu.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  const catalog = require('./catalog.js');
  catalog.init(db);
  const stats = importAll(db);
  console.log(JSON.stringify(stats));
  db.close();
}
