'use strict';
const core = require('./public/core.js');
const masteryData = require('./mastery-data.js');
const Mastery = require('./public/mastery.js');
const CapsGen = require('./public/caps-gen.js');

const BUILTIN_UNITS = core.UNITS.map(([id, name]) => ({ id, name }));
const BUILTIN_TOPICS = core.SK.map(s => ({
  ...s,
  pre: [...s.pre],
  os: s.os ? [...s.os] : null,
}));
const BUILTIN_UNIT_IDS = new Set(BUILTIN_UNITS.map(u => u.id));
const BUILTIN_TOPIC_IDS = new Set(BUILTIN_TOPICS.map(t => t.id));
const GENERATORS = new Map(BUILTIN_TOPICS.filter(t => typeof t.gen === 'function').map(t => [t.id, t.gen]));
for (const [id, gen] of Object.entries(CapsGen.GENERATORS || {})) GENERATORS.set(id, gen);

function fail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}
function jsonArray(value) {
  try { const out = JSON.parse(value); return Array.isArray(out) ? out : []; }
  catch (err) { return []; }
}
function jsonLinks(value) {
  try { const out = JSON.parse(value); return Array.isArray(out) && out.length >= 2 ? out : null; }
  catch (err) { return null; }
}
function text(value, max) {
  return String(value == null ? '' : value).replace(/\0/g, '').trim().slice(0, max);
}
function topicObject(row) {
  return {
    id: row.id,
    unit: row.unit_id,
    name: row.name,
    pre: jsonArray(row.pre),
    notes: row.notes || '',
    paul: row.paul || '',
    os: jsonLinks(row.os),
    position: row.position,
    source: row.source,
    status: row.status,
    gen: GENERATORS.get(row.id),
  };
}

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS topics (
      id         TEXT PRIMARY KEY,
      unit_id    TEXT NOT NULL REFERENCES units(id),
      name       TEXT NOT NULL,
      pre        TEXT NOT NULL DEFAULT '[]',
      notes      TEXT NOT NULL DEFAULT '',
      paul       TEXT,
      os         TEXT,
      position   INTEGER NOT NULL DEFAULT 0,
      source     TEXT NOT NULL DEFAULT 'builtin',
      status     TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS topics_unit ON topics(unit_id, position);
  `);
  const now = Date.now();
  const insertUnit = db.prepare('INSERT OR IGNORE INTO units (id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
  BUILTIN_UNITS.forEach((u, i) => insertUnit.run(u.id, u.name, i, now, now));
  const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO topics
      (id, unit_id, name, pre, notes, paul, os, position, source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'builtin', 'active', ?, ?)
  `);
  const positions = new Map();
  for (const topic of BUILTIN_TOPICS) {
    const pos = positions.get(topic.unit) || 0;
    insertTopic.run(
      topic.id, topic.unit, topic.name, JSON.stringify(topic.pre || []),
      topic.notes || '', topic.paul || '', JSON.stringify(topic.os || null),
      pos, now, now,
    );
    positions.set(topic.unit, pos + 1);
  }
  ensureGraph(db);
  require('./caps').seed(db);
  syncAllEdges(db);
  masteryData.seed(db);
  require('./nsc').importAll(db);
  const keys = require('./keys');
  keys.init(db);
  const memoDir = require('node:path').join(__dirname, 'data', 'nsc', 'memos');
  if (require('node:fs').existsSync(memoDir)) keys.importMemos(db, memoDir);
  syncCore(db);
}

const ALGEBRA_COURSE = 'algebra';

function ensureGraph(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position    INTEGER NOT NULL DEFAULT 0,
      source      TEXT NOT NULL DEFAULT 'builtin',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS course_units (
      course_id TEXT NOT NULL,
      unit_id   TEXT NOT NULL,
      name      TEXT NOT NULL,
      position  INTEGER NOT NULL,
      required  INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (course_id, unit_id)
    );
    CREATE TABLE IF NOT EXISTS course_topics (
      course_id TEXT NOT NULL,
      unit_id   TEXT NOT NULL,
      topic_id  TEXT NOT NULL,
      position  INTEGER NOT NULL,
      PRIMARY KEY (course_id, topic_id)
    );
    CREATE INDEX IF NOT EXISTS course_topics_unit ON course_topics(course_id, unit_id, position);
    CREATE TABLE IF NOT EXISTS topic_prereqs (
      topic_id  TEXT NOT NULL,
      prereq_id TEXT NOT NULL,
      PRIMARY KEY (topic_id, prereq_id)
    );
    CREATE INDEX IF NOT EXISTS topic_prereqs_prereq ON topic_prereqs(prereq_id);
    CREATE TABLE IF NOT EXISTS knowledge_points (
      id        TEXT PRIMARY KEY,
      topic_id  TEXT NOT NULL,
      name      TEXT NOT NULL,
      position  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS knowledge_points_topic ON knowledge_points(topic_id, position);
    CREATE TABLE IF NOT EXISTS bank_skill_map (
      bank_code           TEXT PRIMARY KEY,
      topic_id            TEXT NOT NULL,
      knowledge_point_id  TEXT NOT NULL
    );
  `);
  const now = Date.now();
  db.prepare(`
    INSERT OR IGNORE INTO courses (id, name, description, position, source, status, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'builtin', 'active', ?, ?)
  `).run(ALGEBRA_COURSE, 'Algebra & trigonometry', 'The original algebra and trigonometry course.', now, now);
  // Keep stored prerequisites aligned when the built-in graph changes, but only
  // while an admin has not edited them away from the previous default.
  const retarget = [
    ['right-tri', '["unit-circle"]', '["special-angles"]'],
    ['sum-diff', '["identities"]', '["basic-identities","special-angles"]'],
    ['identities', '["unit-circle"]', '["unit-circle","basic-identities"]'],
  ];
  const readPre = db.prepare('SELECT pre FROM topics WHERE id = ?');
  const writePre = db.prepare('UPDATE topics SET pre = ?, updated_at = ? WHERE id = ?');
  for (const [id, from, to] of retarget) {
    const row = readPre.get(id);
    if (row && row.pre === from) writePre.run(to, now, id);
  }
  const unitClaimed = db.prepare('SELECT 1 FROM course_units WHERE unit_id = ?');
  const addUnit = db.prepare('INSERT OR IGNORE INTO course_units (course_id, unit_id, name, position, required) VALUES (?, ?, ?, ?, 1)');
  for (const unit of db.prepare('SELECT id, name, position FROM units').all()) {
    if (!unitClaimed.get(unit.id)) addUnit.run(ALGEBRA_COURSE, unit.id, unit.name, unit.position);
  }
  const topicClaimed = db.prepare('SELECT 1 FROM course_topics WHERE topic_id = ?');
  const addTopic = db.prepare('INSERT OR IGNORE INTO course_topics (course_id, unit_id, topic_id, position) VALUES (?, ?, ?, ?)');
  for (const topic of db.prepare('SELECT id, unit_id, position FROM topics').all()) {
    if (!topicClaimed.get(topic.id)) addTopic.run(ALGEBRA_COURSE, topic.unit_id, topic.id, topic.position);
  }
}

function syncTopicEdges(db, topicId, pre) {
  db.prepare('DELETE FROM topic_prereqs WHERE topic_id = ?').run(topicId);
  const insert = db.prepare('INSERT OR IGNORE INTO topic_prereqs (topic_id, prereq_id) VALUES (?, ?)');
  for (const id of pre) insert.run(topicId, id);
}

function syncAllEdges(db) {
  db.prepare('DELETE FROM topic_prereqs').run();
  const insert = db.prepare('INSERT INTO topic_prereqs (topic_id, prereq_id) VALUES (?, ?)');
  for (const row of db.prepare('SELECT id, pre FROM topics').all()) {
    for (const id of jsonArray(row.pre)) insert.run(row.id, id);
  }
}

function syncCore(db) {
  const units = db.prepare('SELECT * FROM units ORDER BY position, id').all();
  const rows = db.prepare(`
    SELECT t.* FROM topics t JOIN units u ON u.id = t.unit_id
    ORDER BY u.position, t.position, t.id
  `).all();
  core.UNITS.length = 0;
  core.UNITS.push(...units.map(u => [u.id, u.name]));
  core.SK.length = 0;
  for (const row of rows) core.SK.push(topicObject(row));
  for (const key of Object.keys(core.SKM)) delete core.SKM[key];
  for (const topic of core.SK) core.SKM[topic.id] = topic;
}

function courses(db) {
  return db.prepare(`
    SELECT id, name, description, position, source, status FROM courses
    WHERE status = 'active' ORDER BY position, id
  `).all();
}

function learner(db, courseId) {
  const id = courseId == null || courseId === '' ? ALGEBRA_COURSE : String(courseId);
  const course = db.prepare(`SELECT id, name, description FROM courses WHERE id = ? AND status = 'active'`).get(id);
  if (!course) throw fail('Unknown course.', 404);
  const units = db.prepare(`
    SELECT unit_id AS id, name, position, required FROM course_units
    WHERE course_id = ? ORDER BY position, unit_id
  `).all(id);
  const rows = db.prepare(`
    SELECT t.*, ct.unit_id AS course_unit, ct.position AS course_pos
    FROM course_topics ct
    JOIN topics t ON t.id = ct.topic_id
    JOIN course_units cu ON cu.course_id = ct.course_id AND cu.unit_id = ct.unit_id
    WHERE ct.course_id = ? AND t.status = 'active'
    ORDER BY cu.position, ct.position, t.id
  `).all(id);
  const members = new Set(rows.map(t => t.id));
  // A course sees only prerequisite edges whose other end is in the course.
  // Off-CAPS topics therefore drop out of the CAPS slice without being copied.
  const projected = new Map(rows.map(t => [
    t.id,
    jsonArray(t.pre).filter(p => id === ALGEBRA_COURSE ? true : members.has(p)),
  ]));
  const visible = new Set(rows.map(t => t.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const topicId of [...visible]) {
      if (projected.get(topicId).some(p => !visible.has(p))) { visible.delete(topicId); changed = true; }
    }
  }
  const topics = rows.filter(t => visible.has(t.id));
  const activeUnits = units.filter(u => topics.some(t => t.course_unit === u.id));
  const lesson = masteryData.loadForCourse(db, topics.map(t => t.id));
  const nscLeaves = nscLeafCounts(db);
  const topicsForCore = topics.map(t => ({
    id: t.id, unit: t.course_unit, pre: projected.get(t.id) || [],
  }));
  const coreMap = Mastery.tagCore(topicsForCore, nscLeaves);
  return {
    course,
    units: activeUnits.map(u => ({ id: u.id, name: u.name, required: !!u.required })),
    topics: topics.map(t => {
      const kps = (lesson.kpsBy.get(t.id) || []).map(k => ({ ...k }));
      const keyPrereqs = (lesson.keyBy.get(t.id) || []).slice();
      const gen = typeof GENERATORS.get(t.id) === 'function';
      const fallback = !gen || !kps.length;
      const tag = coreMap.get(t.id) || { core: false, score: 0 };
      return {
        id: t.id, unit: t.course_unit, name: t.name, pre: projected.get(t.id),
        notes: t.notes || '', paul: t.paul || '', os: jsonLinks(t.os),
        kps, keyPrereqs, fallback, staged: !fallback,
        core: !!tag.core, coreScore: tag.score || 0,
      };
    }),
    encompassing: lesson.encompassing,
    fire: Mastery.FIRE,
    lesson: { passCount: Mastery.LESSON.passCount, failsBeforeShore: Mastery.LESSON.failsBeforeShore },
    daily: Mastery.DAILY,
    core: Mastery.CORE,
  };
}

function nscLeafCounts(db) {
  try {
    const rows = db.prepare(`
      SELECT bsm.topic_id AS id, COUNT(DISTINCT n.id) AS n
      FROM nsc_node_skills ns
      JOIN bank_skill_map bsm ON bsm.bank_code = ns.bank_code
      JOIN nsc_nodes n ON n.id = ns.node_id
      JOIN nsc_papers p ON p.id = n.paper_id
      WHERE n.is_leaf = 1 AND p.pool = 'practice' AND p.year < 2022
        AND COALESCE(n.on_syllabus, 1) = 1
      GROUP BY bsm.topic_id
    `).all();
    return Object.fromEntries(rows.map(r => [r.id, r.n]));
  } catch (err) {
    return {};
  }
}

function admin(db) {
  const units = db.prepare(`
    SELECT u.*, (SELECT COUNT(*) FROM topics WHERE unit_id = u.id) AS topic_count
    FROM units u ORDER BY u.position, u.id
  `).all();
  const topics = db.prepare(`
    SELECT t.*, u.name AS unit_name,
      (SELECT COUNT(*) FROM questions WHERE skill_id = t.id) AS question_count
    FROM topics t JOIN units u ON u.id = t.unit_id
    ORDER BY u.position, t.position, t.id
  `).all();
  return {
    units: units.map(u => ({ id: u.id, name: u.name, position: u.position, topicCount: u.topic_count, builtin: BUILTIN_UNIT_IDS.has(u.id) })),
    topics: topics.map(t => ({
      id: t.id, unitId: t.unit_id, unitName: t.unit_name, name: t.name,
      pre: jsonArray(t.pre), notes: t.notes || '', paul: t.paul || '', os: jsonLinks(t.os),
      position: t.position, source: t.source, status: t.status,
      questionCount: t.question_count, builtin: BUILTIN_TOPIC_IDS.has(t.id),
    })),
  };
}

function topicRow(db, id) {
  return db.prepare('SELECT * FROM topics WHERE id = ?').get(id) || null;
}

function normalizePre(db, topicId, input) {
  if (!Array.isArray(input)) throw fail('Prerequisites must be a list.');
  const pre = [...new Set(input.map(x => String(x).trim()).filter(Boolean))];
  if (pre.includes(topicId)) throw fail('A topic cannot be its own prerequisite.');
  const known = new Set(db.prepare('SELECT id FROM topics').all().map(r => r.id));
  for (const id of pre) if (!known.has(id)) throw fail(`Unknown prerequisite: ${id}.`);
  const graph = new Map(db.prepare('SELECT id, pre FROM topics').all().map(r => [r.id, jsonArray(r.pre)]));
  graph.set(topicId, pre);
  const visiting = new Set(), done = new Set();
  const visit = id => {
    if (visiting.has(id)) throw fail('Prerequisites create a cycle.');
    if (done.has(id)) return;
    visiting.add(id);
    for (const p of graph.get(id) || []) visit(p);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of graph.keys()) visit(id);
  return pre;
}

function normalizeOs(input) {
  if (input == null) return null;
  if (!Array.isArray(input) || input.length !== 2) throw fail('OpenStax link must be a label and URL pair.');
  const label = text(input[0], 120), url = text(input[1], 500);
  if (!label || !url) throw fail('OpenStax link needs both a label and URL.');
  return [label, url];
}

function createUnit(db, input) {
  const id = text(input.id, 20), name = text(input.name, 80);
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) throw fail('Unit code must be 1-20 letters, numbers, _ or -.');
  if (!name) throw fail('Unit name is required.');
  if (db.prepare('SELECT 1 FROM units WHERE id = ?').get(id)) throw fail('That unit code already exists.', 409);
  const position = (db.prepare('SELECT MAX(position) AS n FROM units').get().n || 0) + 1;
  const now = Date.now();
  db.prepare('INSERT INTO units (id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, position, now, now);
  db.prepare('INSERT OR IGNORE INTO course_units (course_id, unit_id, name, position, required) VALUES (?, ?, ?, ?, 1)')
    .run(ALGEBRA_COURSE, id, name, position);
  syncCore(db);
  return { id, name, position };
}

function updateUnit(db, id, input) {
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  if (!row) return null;
  const name = text(input.name, 80);
  if (!name) throw fail('Unit name is required.');
  db.prepare('UPDATE units SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id);
  db.prepare(`UPDATE course_units SET name = ? WHERE course_id = ? AND unit_id = ?`).run(name, ALGEBRA_COURSE, id);
  syncCore(db);
  return { id, name, position: row.position };
}

function deleteUnit(db, id) {
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  if (!row) return false;
  if (BUILTIN_UNIT_IDS.has(id)) throw fail('Built-in units cannot be deleted.', 403);
  const count = db.prepare('SELECT COUNT(*) AS n FROM topics WHERE unit_id = ?').get(id).n;
  if (count) throw fail('Move or delete the topics in this unit first.', 409);
  const inCourse = db.prepare('SELECT COUNT(*) AS n FROM course_topics WHERE unit_id = ?').get(id).n;
  if (inCourse) throw fail('Move or delete the topics in this unit first.', 409);
  db.prepare('DELETE FROM course_units WHERE unit_id = ?').run(id);
  db.prepare('DELETE FROM units WHERE id = ?').run(id);
  syncCore(db);
  return true;
}

function createTopic(db, input) {
  const id = text(input.id, 40), unitId = text(input.unitId, 20), name = text(input.name, 120);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) throw fail('Topic id must be lowercase letters, numbers or hyphens.');
  if (!name) throw fail('Topic name is required.');
  if (!db.prepare('SELECT 1 FROM units WHERE id = ?').get(unitId)) throw fail('Choose a valid unit.');
  if (db.prepare('SELECT 1 FROM topics WHERE id = ?').get(id)) throw fail('That topic id already exists.', 409);
  const pre = normalizePre(db, id, input.pre || []);
  const os = normalizeOs(input.os);
  const status = input.status === 'hidden' ? 'hidden' : 'active';
  const position = (db.prepare('SELECT MAX(position) AS n FROM topics WHERE unit_id = ?').get(unitId).n || 0) + 1;
  const now = Date.now();
  db.prepare(`
    INSERT INTO topics (id, unit_id, name, pre, notes, paul, os, position, source, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'custom', ?, ?, ?)
  `).run(id, unitId, name, JSON.stringify(pre), text(input.notes, 30000), text(input.paul, 500), os ? JSON.stringify(os) : null, position, status, now, now);
  db.prepare('INSERT OR IGNORE INTO course_topics (course_id, unit_id, topic_id, position) VALUES (?, ?, ?, ?)')
    .run(ALGEBRA_COURSE, unitId, id, position);
  syncTopicEdges(db, id, pre);
  syncCore(db);
  return topicRow(db, id);
}

function updateTopic(db, id, input) {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
  if (!row) return null;
  const unitId = input.unitId == null ? row.unit_id : text(input.unitId, 20);
  if (!db.prepare('SELECT 1 FROM units WHERE id = ?').get(unitId)) throw fail('Choose a valid unit.');
  const name = input.name == null ? row.name : text(input.name, 120);
  if (!name) throw fail('Topic name is required.');
  const pre = input.pre == null ? jsonArray(row.pre) : normalizePre(db, id, input.pre);
  const os = input.os === undefined ? jsonLinks(row.os) : normalizeOs(input.os);
  const status = input.status == null ? row.status : (input.status === 'hidden' ? 'hidden' : 'active');
  const notes = input.notes == null ? row.notes : text(input.notes, 30000);
  const paul = input.paul == null ? row.paul : text(input.paul, 500);
  db.prepare(`
    UPDATE topics SET unit_id = ?, name = ?, pre = ?, notes = ?, paul = ?, os = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(unitId, name, JSON.stringify(pre), notes, paul, os ? JSON.stringify(os) : null, status, Date.now(), id);
  if (unitId !== row.unit_id) {
    db.prepare('UPDATE questions SET unit = ? WHERE skill_id = ?').run(unitId, id);
    db.prepare(`UPDATE course_topics SET unit_id = ? WHERE course_id = ? AND topic_id = ?`).run(unitId, ALGEBRA_COURSE, id);
  }
  syncTopicEdges(db, id, pre);
  syncCore(db);
  return topicRow(db, id);
}

function deleteTopic(db, id) {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
  if (!row) return false;
  if (row.source === 'builtin' || row.source === 'caps' || BUILTIN_TOPIC_IDS.has(id)) throw fail('Built-in topics can be hidden, not deleted.', 403);
  const count = db.prepare('SELECT COUNT(*) AS n FROM questions WHERE skill_id = ?').get(id).n;
  if (count) throw fail('Hide the topic instead; it still has questions.', 409);
  const dependent = db.prepare('SELECT id, pre FROM topics WHERE id <> ?').all(id)
    .filter(t => jsonArray(t.pre).includes(id)).map(t => t.id);
  if (dependent.length) throw fail('This topic is a prerequisite for: ' + dependent.join(', ') + '.', 409);
  db.prepare('DELETE FROM topic_prereqs WHERE topic_id = ? OR prereq_id = ?').run(id, id);
  db.prepare('DELETE FROM course_topics WHERE topic_id = ?').run(id);
  db.prepare('DELETE FROM knowledge_points WHERE topic_id = ?').run(id);
  db.prepare('DELETE FROM bank_skill_map WHERE topic_id = ?').run(id);
  db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  syncCore(db);
  return true;
}

module.exports = {
  init, syncCore, learner, courses, admin, createUnit, updateUnit, deleteUnit, createTopic, updateTopic, deleteTopic,
  ALGEBRA_COURSE, masteryCoverage: (db) => masteryData.coverage(db),
};
