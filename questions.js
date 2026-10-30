'use strict';
const core = require('./public/core.js');

const REJECT_TAGS = new Map([
  [core.noParenReject, 'expand'],
  [core.factoredReject, 'factored'],
  [core.radReject, 'radical'],
  [core.singleFractionReject, 'singleFraction'],
]);

let ftsEnabled = false;
const TYPES = new Set(['mc', 'num', 'set', 'expr', 'fields']);
const STATUSES = new Set(['active', 'hidden', 'deleted']);

function qerr(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function cleanText(value, max) {
  return String(value == null ? '' : value).replace(/\0/g, '').trim().slice(0, max);
}

// Admin-authored prompts may use light HTML ($...$ and <p class="sub">), but never scripts or handlers.
function safeHtml(value, max) {
  return String(value == null ? '' : value)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
    .slice(0, max);
}

function fingerprint(prompt) {
  let h = 5381;
  const s = String(prompt || '');
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function searchText(question) {
  return String(question.prompt || '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\/g, ' ')
    .replace(/[{}$^_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

function serialize(skillId, question) {
  const data = { skillId, ...question };
  if (typeof question.reject === 'function') {
    const tag = REJECT_TAGS.get(question.reject);
    if (tag) data.reject = tag;
    else delete data.reject;
  }
  return data;
}

function normalizeQuestion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw qerr('Question must be an object.');
  const type = String(input.type || '');
  if (!TYPES.has(type)) throw qerr('Type must be one of: mc, num, set, expr, fields.');

  const q = { type };
  q.prompt = safeHtml(input.prompt, 4000);
  if (!q.prompt) throw qerr('Prompt is required.');
  const hint = safeHtml(input.hint, 2000);
  if (hint) q.hint = hint;
  if (!Array.isArray(input.steps) || !input.steps.length) throw qerr('Add at least one worked step.');
  if (input.steps.length > 20) throw qerr('Use at most 20 worked steps.');
  q.steps = input.steps.map(step => safeHtml(step, 2000)).filter(Boolean);
  if (!q.steps.length) throw qerr('Worked steps cannot be empty.');
  const ansTex = safeHtml(input.ansTex, 1000);
  if (ansTex) q.ansTex = ansTex;

  if (type === 'mc') {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 8)
      throw qerr('Multiple-choice questions need 2 to 8 options.');
    q.options = input.options.map(o => ({ tex: safeHtml(o && o.tex, 500), ok: !!(o && o.ok) }));
    if (q.options.some(o => !o.tex)) throw qerr('Every choice needs some text.');
    if (q.options.filter(o => o.ok).length !== 1) throw qerr('Mark exactly one choice as correct.');
  } else if (type === 'num') {
    q.undef = !!input.undef;
    let val = Number(input.val);
    if (!Number.isFinite(val) && input.ans != null) {
      try { val = core.ev(core.parse(String(input.ans)), {}); } catch (err) { val = NaN; }
    }
    if (!Number.isFinite(val) && q.undef) val = 0;
    if (!Number.isFinite(val)) throw qerr('A numeric answer needs a finite value.');
    q.val = val;
    q.ans = input.ans == null ? (q.undef ? 'undefined' : String(val)) : cleanText(input.ans, 500);
    q.exact = !!input.exact;
    if (input.tol != null) {
      const tol = Number(input.tol);
      if (!Number.isFinite(tol) || tol < 0) throw qerr('Tolerance must be zero or more.');
      q.tol = tol;
    }
  } else if (type === 'set') {
    const raw = Array.isArray(input.vals) ? input.vals : String(input.vals == null ? '' : input.vals).split(/[,;]/);
    const vals = raw.map(Number);
    if (vals.some(v => !Number.isFinite(v))) throw qerr('Every value in a set answer must be a finite number.');
    if (!vals.length && !input.undef && !/^\s*(none|no solutions?|dne|∅|empty)\s*$/i.test(String(input.ans || '')))
      throw qerr('Add at least one value, or use undef: true for a no-solution question.');
    q.vals = vals;
    q.ans = input.ans == null ? (vals.length ? vals.join(', ') : 'none') : cleanText(input.ans, 500);
    q.undef = !!input.undef || !vals.length;
    if (input.tol != null) {
      const tol = Number(input.tol);
      if (!Number.isFinite(tol) || tol < 0) throw qerr('Tolerance must be zero or more.');
      q.tol = tol;
    }
  } else if (type === 'expr') {
    q.ans = cleanText(input.ans, 1000);
    if (!q.ans) throw qerr('An expression answer is required.');
    const v = input.var == null ? 'x' : String(input.var);
    if (!['x', 'y', 't', 'h', 'i'].includes(v)) throw qerr('Variable must be x, y, t, h or i.');
    q.var = v;
    if (Array.isArray(input.sample) && input.sample.length === 2) {
      const lo = Number(input.sample[0]), hi = Number(input.sample[1]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) throw qerr('Sample range must have two numbers with min < max.');
      q.sample = [lo, hi];
    }
    if (input.reject != null && String(input.reject).trim()) {
      const tag = String(input.reject).trim();
      if (!core.REJECTS[tag]) throw qerr('Unknown answer-format rule.');
      q.reject = tag;
    }
  } else {
    if (!Array.isArray(input.fields) || !input.fields.length || input.fields.length > 8)
      throw qerr('Fill-in questions need 1 to 8 fields.');
    q.fields = input.fields.map((f, i) => {
      const label = safeHtml(f && f.label, 80);
      if (!label) throw qerr(`Field ${i + 1} needs a label.`);
      const name = cleanText(f && f.name, 80) || `answer ${i + 1}`;
      const undef = !!(f && f.undef);
      let ans = Number(f && f.ans);
      if (!undef && !Number.isFinite(ans)) throw qerr(`Field ${i + 1} needs a finite answer.`);
      if (!Number.isFinite(ans)) ans = 0;
      const out = { label, name, ans };
      if (undef) out.undef = true;
      if (f && f.ansTex != null && String(f.ansTex).trim()) out.ansTex = safeHtml(f.ansTex, 200);
      if (f && f.tol != null) {
        const tol = Number(f.tol);
        if (!Number.isFinite(tol) || tol < 0) throw qerr(`Field ${i + 1} tolerance must be zero or more.`);
        out.tol = tol;
      }
      return out;
    });
    q.exact = !!input.exact;
  }

  if (type === 'mc') {
    const right = core.check(q, q.options.findIndex(o => o.ok));
    if (!right.ok) throw qerr('The marked correct choice does not pass the answer checker.');
  } else if (type === 'fields') {
    const right = core.check(q, q.fields.map(f => f.undef ? 'none' : String(f.ans)));
    if (!right.ok) throw qerr('The field answers do not pass the answer checker.');
  } else {
    if (!q.ansTex) throw qerr('Answer display (ansTex) is required.');
    const answer = q.undef ? 'none' : String(q.ans);
    const right = core.check(q, answer);
    if (!right.ok) throw qerr('The canonical answer does not pass the answer checker' + (right.err ? ': ' + right.err : '.'));
  }
  return q;
}

function addColumn(db, table, name, declaration) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${declaration}`);
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id    TEXT NOT NULL,
      unit        TEXT NOT NULL,
      type        TEXT NOT NULL,
      prompt      TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      hint        TEXT,
      steps       TEXT NOT NULL,
      answer      TEXT,
      answer_tex  TEXT,
      options     TEXT,
      fields      TEXT,
      data        TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER,
      source      TEXT NOT NULL DEFAULT 'generated',
      status      TEXT NOT NULL DEFAULT 'active',
      UNIQUE(skill_id, fingerprint)
    );
    CREATE INDEX IF NOT EXISTS questions_skill ON questions(skill_id);
  `);
  addColumn(db, 'questions', 'updated_at', 'updated_at INTEGER');
  addColumn(db, 'questions', 'source', "source TEXT NOT NULL DEFAULT 'generated'");
  addColumn(db, 'questions', 'status', "status TEXT NOT NULL DEFAULT 'active'");
  db.exec(`
    CREATE INDEX IF NOT EXISTS questions_status ON questions(skill_id, status);
    UPDATE questions SET updated_at = created_at WHERE updated_at IS NULL;
  `);

  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS questions_fts
        USING fts5(prompt_text, content='questions', content_rowid='id', tokenize='unicode61');
      CREATE TRIGGER IF NOT EXISTS questions_ai AFTER INSERT ON questions BEGIN
        INSERT INTO questions_fts(rowid, prompt_text) VALUES (new.id, new.prompt_text);
      END;
      CREATE TRIGGER IF NOT EXISTS questions_ad AFTER DELETE ON questions BEGIN
        INSERT INTO questions_fts(questions_fts, rowid, prompt_text) VALUES('delete', old.id, old.prompt_text);
      END;
      CREATE TRIGGER IF NOT EXISTS questions_au AFTER UPDATE ON questions BEGIN
        INSERT INTO questions_fts(questions_fts, rowid, prompt_text) VALUES('delete', old.id, old.prompt_text);
        INSERT INTO questions_fts(rowid, prompt_text) VALUES (new.id, new.prompt_text);
      END;
    `);
    ftsEnabled = true;
    const docs = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
    const indexed = db.prepare('SELECT COUNT(*) AS n FROM questions_fts').get().n;
    if (docs !== indexed) db.exec("INSERT INTO questions_fts(questions_fts) VALUES('rebuild')");
  } catch (err) {
    ftsEnabled = false;
    console.warn('[questions] FTS5 unavailable; similar-question search will use LIKE:', err.message);
  }
}

function insert(db, skillId, question, options = {}) {
  const skill = core.SKM[skillId];
  if (!skill) return null;
  const data = serialize(skillId, question);
  const fp = fingerprint(question.prompt);
  const now = Date.now();
  const info = db.prepare(`
    INSERT OR IGNORE INTO questions
      (skill_id, unit, type, prompt, prompt_text, hint, steps, answer, answer_tex, options, fields, data, fingerprint, created_at, updated_at, source, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    skillId,
    skill.unit,
    String(question.type || ''),
    String(question.prompt || ''),
    searchText(question),
    question.hint == null ? null : String(question.hint),
    JSON.stringify(question.steps || []),
    question.ans == null ? null : String(question.ans),
    question.ansTex == null ? null : String(question.ansTex),
    question.options ? JSON.stringify(question.options) : null,
    question.fields ? JSON.stringify(question.fields) : null,
    JSON.stringify(data),
    fp,
    now,
    now,
    options.source === 'manual' ? 'manual' : 'generated',
    STATUSES.has(options.status) ? options.status : 'active',
  );
  if (!info.changes) return null;
  return { id: Number(info.lastInsertRowid), fingerprint: fp, ...data };
}

function generate(db, skillId, exclude = new Set()) {
  const skill = core.SKM[skillId];
  if (!skill) return null;
  for (let attempt = 0; attempt < 80; attempt++) {
    let question;
    try { question = skill.gen(); } catch (err) { continue; }
    if (!question || !question.prompt || !question.type) continue;
    const fp = fingerprint(question.prompt);
    if (exclude.has(fp)) continue;
    exclude.add(fp);
    const row = insert(db, skillId, question);
    if (row) return row;
  }
  return null;
}

function rowToQuestion(row) {
  return {
    id: row.id,
    skillId: row.skill_id,
    fingerprint: row.fingerprint,
    source: row.source,
    status: row.status,
    ...JSON.parse(row.data),
  };
}

function next(db, skillId, exclude = []) {
  if (!core.SKM[skillId]) return null;
  const seen = [...new Set(exclude.map(String).filter(Boolean))].slice(-250);
  let row;
  if (seen.length) {
    const marks = seen.map(() => '?').join(',');
    row = db.prepare(`SELECT * FROM questions WHERE skill_id = ? AND status = 'active' AND fingerprint NOT IN (${marks}) ORDER BY RANDOM() LIMIT 1`).get(skillId, ...seen);
  } else {
    row = db.prepare("SELECT * FROM questions WHERE skill_id = ? AND status = 'active' ORDER BY RANDOM() LIMIT 1").get(skillId);
  }
  if (!row) {
    const generated = generate(db, skillId, new Set(seen));
    if (generated) return generated;
    row = db.prepare("SELECT * FROM questions WHERE skill_id = ? AND status = 'active' ORDER BY RANDOM() LIMIT 1").get(skillId);
  }
  return row ? rowToQuestion(row) : null;
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'what', 'find', 'solve', 'value', 'exact', 'your', 'answer',
  'question', 'using', 'given', 'round', 'decimals', 'decimal', 'simplify', 'evaluate', 'following',
  'single', 'write', 'form', 'into', 'than', 'that', 'this', 'are', 'not', 'use', 'all', 'has', 'one',
  'two', 'which', 'how', 'many', 'much', 'does', 'when', 'where', 'why', 'each', 'there', 'then',
]);

function queryTerms(text, limit = 16) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  return [...new Set(words.filter(w => w.length > 1 && !STOP.has(w)))].slice(0, limit);
}

function ftsQuery(text) {
  return queryTerms(text).map(term => `"${term}"`).join(' OR ');
}

function similar(db, id, limit = 5) {
  const row = db.prepare("SELECT * FROM questions WHERE id = ? AND status = 'active'").get(id);
  if (!row) return null;
  const n = Math.max(1, Math.min(20, Number(limit) || 5));
  let rows = [];
  if (ftsEnabled) {
    const match = ftsQuery(row.prompt_text);
    if (match) {
      try {
        rows = db.prepare(`
          SELECT q.id, q.skill_id, q.prompt, bm25(questions_fts) AS rank
          FROM questions_fts JOIN questions q ON q.id = questions_fts.rowid
          WHERE questions_fts MATCH ? AND q.id <> ? AND q.status = 'active'
          ORDER BY (q.skill_id = ?) DESC, rank ASC
          LIMIT ?
        `).all(match, id, row.skill_id, n);
      } catch (err) {
        rows = [];
      }
    }
  }
  if (!rows.length) {
    rows = db.prepare(`
      SELECT id, skill_id, prompt, 0 AS rank FROM questions
      WHERE skill_id = ? AND id <> ? AND status = 'active'
      ORDER BY RANDOM() LIMIT ?
    `).all(row.skill_id, id, n);
  }
  return rows.map(r => ({ id: r.id, skillId: r.skill_id, prompt: r.prompt, score: r.rank }));
}

function search(db, text, limit = 10) {
  const n = Math.max(1, Math.min(50, Number(limit) || 10));
  const match = ftsQuery(text);
  if (ftsEnabled && match) {
    try {
      const rows = db.prepare(`
        SELECT q.id, q.skill_id, q.prompt, bm25(questions_fts) AS rank
        FROM questions_fts JOIN questions q ON q.id = questions_fts.rowid
        WHERE questions_fts MATCH ? AND q.status = 'active'
        ORDER BY rank ASC LIMIT ?
      `).all(match, n);
      if (rows.length) return rows.map(r => ({ id: r.id, skillId: r.skill_id, prompt: r.prompt, score: r.rank }));
    } catch (err) {}
  }
  const terms = queryTerms(text);
  if (!terms.length) return [];
  const like = `%${terms[0]}%`;
  return db.prepare(`
    SELECT id, skill_id, prompt, 0 AS rank FROM questions
    WHERE prompt_text LIKE ? AND status = 'active' ORDER BY RANDOM() LIMIT ?
  `).all(like, n).map(r => ({ id: r.id, skillId: r.skill_id, prompt: r.prompt, score: r.rank }));
}

function seed(db, perSkill = 8) {
  let added = 0;
  const countFor = db.prepare('SELECT COUNT(*) AS n FROM questions WHERE skill_id = ?');
  const fingerprintsFor = db.prepare('SELECT fingerprint FROM questions WHERE skill_id = ?');
  db.exec('BEGIN');
  try {
    for (const skill of core.SK) {
      const have = countFor.get(skill.id).n;
      if (have >= perSkill) continue;
      const seen = new Set(fingerprintsFor.all(skill.id).map(r => r.fingerprint));
      for (let i = have; i < perSkill; i++) {
        if (!generate(db, skill.id, seen)) break;
        added++;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return added;
}

function count(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
}

function getActive(db, id) {
  const row = db.prepare("SELECT * FROM questions WHERE id = ? AND status = 'active'").get(id);
  return row ? rowToQuestion(row) : null;
}

function adminGet(db, id) {
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...rowToQuestion(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    topic: core.SKM[row.skill_id] ? core.SKM[row.skill_id].name : row.skill_id,
  };
}

function adminList(db, filters = {}) {
  const where = [];
  const params = [];
  if (filters.skillId) { where.push('skill_id = ?'); params.push(String(filters.skillId)); }
  if (filters.status && filters.status !== 'all') {
    if (!STATUSES.has(filters.status)) throw qerr('Status must be active, hidden, deleted or all.');
    where.push('status = ?'); params.push(filters.status);
  }
  if (filters.source && filters.source !== 'all') {
    if (!['generated', 'manual'].includes(filters.source)) throw qerr('Source must be generated, manual or all.');
    where.push('source = ?'); params.push(filters.source);
  }
  const text = cleanText(filters.q, 200);
  if (text) {
    where.push('(prompt_text LIKE ? OR skill_id LIKE ?)');
    params.push(`%${text}%`, `%${text}%`);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM questions ${clause}`).get(...params).n;
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);
  const rows = db.prepare(`
    SELECT id, skill_id, type, prompt_text, status, source, created_at, updated_at
    FROM questions ${clause} ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return {
    total, limit, offset,
    items: rows.map(r => ({
      id: r.id, skillId: r.skill_id, topic: core.SKM[r.skill_id] ? core.SKM[r.skill_id].name : r.skill_id,
      type: r.type, promptText: r.prompt_text, status: r.status, source: r.source,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })),
  };
}

function addManual(db, skillId, input) {
  if (!core.SKM[skillId]) throw qerr('Unknown topic.');
  const question = normalizeQuestion(input);
  const row = insert(db, skillId, question, { source: 'manual', status: 'active' });
  if (!row) throw qerr('A question with this prompt already exists in that topic.');
  return adminGet(db, row.id);
}

function updateQuestion(db, id, skillId, input) {
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (!row) return null;
  const nextSkillId = skillId || row.skill_id;
  const skill = core.SKM[nextSkillId];
  if (!skill) throw qerr('Unknown topic.');
  const question = normalizeQuestion(input);
  const data = serialize(nextSkillId, question);
  const fp = fingerprint(question.prompt);
  try {
    db.prepare(`
      UPDATE questions SET skill_id = ?, unit = ?, type = ?, prompt = ?, prompt_text = ?, hint = ?, steps = ?,
        answer = ?, answer_tex = ?, options = ?, fields = ?, data = ?, fingerprint = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextSkillId,
      skill.unit,
      String(question.type || ''),
      String(question.prompt || ''),
      searchText(question),
      question.hint == null ? null : String(question.hint),
      JSON.stringify(question.steps || []),
      question.ans == null ? null : String(question.ans),
      question.ansTex == null ? null : String(question.ansTex),
      question.options ? JSON.stringify(question.options) : null,
      question.fields ? JSON.stringify(question.fields) : null,
      JSON.stringify(data),
      fp,
      Date.now(),
      id,
    );
  } catch (err) {
    if (/UNIQUE constraint failed/i.test(err.message)) throw qerr('A question with this prompt already exists in that topic.');
    throw err;
  }
  return adminGet(db, id);
}

function setStatus(db, id, status) {
  if (!STATUSES.has(status)) throw qerr('Status must be active, hidden or deleted.');
  const info = db.prepare('UPDATE questions SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id);
  return !!info.changes;
}

function testAnswer(input, answer) {
  const q = normalizeQuestion(input);
  if (q.type === 'fields') {
    const parts = Array.isArray(answer) ? answer : String(answer == null ? '' : answer).split(/\s*[,|]\s*/);
    return core.check(q, parts);
  }
  if (q.type === 'mc') {
    const raw = String(answer == null ? '' : answer).trim();
    let index = -1;
    if (/^[A-Ha-h]$/.test(raw)) index = raw.toUpperCase().charCodeAt(0) - 65;
    else if (/^\d+$/.test(raw)) index = Number(raw) - 1;
    else index = q.options.findIndex(o => o.tex === raw);
    if (index < 0 || index >= q.options.length) throw qerr('For multiple choice, test with A, B, C… or the exact option text.');
    return core.check(q, index);
  }
  return core.check(q, answer);
}

function skills() {
  return core.SK.map(s => ({ id: s.id, name: s.name, unit: s.unit }));
}

function units() {
  return core.UNITS.map(([id, name]) => ({ id, name }));
}

module.exports = {
  init, seed, next, similar, search, count, fingerprint, searchText, serialize, hasSkill: id => !!core.SKM[id],
  getActive, adminGet, adminList, addManual, updateQuestion, setStatus, testAnswer, skills, units, normalizeQuestion,
};

if (require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const { DatabaseSync } = require('node:sqlite');
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'togisumasu.sqlite'));
  init(db);
  const command = process.argv[2] || 'stats';
  if (command === 'seed') {
    const per = Number(process.argv[3] || process.env.QUESTION_SEED_PER_SKILL || 8);
    const added = seed(db, per);
    console.log(`Added ${added} questions; ${count(db)} total.`);
  } else {
    console.log(`${count(db)} questions in ${path.join(dir, 'togisumasu.sqlite')} (FTS5 ${ftsEnabled ? 'on' : 'off'}).`);
  }
  db.close();
}
