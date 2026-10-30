'use strict';
const core = require('./public/core.js');

const BUILTIN_UNITS = core.UNITS.map(([id, name]) => ({ id, name }));
const BUILTIN_TOPICS = core.SK.map(s => ({
  ...s,
  pre: [...s.pre],
  os: s.os ? [...s.os] : null,
}));
const BUILTIN_UNIT_IDS = new Set(BUILTIN_UNITS.map(u => u.id));
const BUILTIN_TOPIC_IDS = new Set(BUILTIN_TOPICS.map(t => t.id));
const GENERATORS = new Map(BUILTIN_TOPICS.filter(t => typeof t.gen === 'function').map(t => [t.id, t.gen]));

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
  syncCore(db);
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

function learner(db) {
  const units = db.prepare('SELECT id, name FROM units ORDER BY position, id').all();
  const rows = db.prepare(`
    SELECT t.* FROM topics t JOIN units u ON u.id = t.unit_id
    WHERE t.status = 'active'
    ORDER BY u.position, t.position, t.id
  `).all();
  const byId = new Map(rows.map(t => [t.id, t]));
  const visible = new Set(rows.map(t => t.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of [...visible]) {
      const topic = byId.get(id);
      if (jsonArray(topic.pre).some(p => !visible.has(p))) { visible.delete(id); changed = true; }
    }
  }
  const topics = rows.filter(t => visible.has(t.id));
  const activeUnits = units.filter(u => topics.some(t => t.unit_id === u.id));
  return {
    units: activeUnits,
    topics: topics.map(t => ({
      id: t.id, unit: t.unit_id, name: t.name, pre: jsonArray(t.pre),
      notes: t.notes || '', paul: t.paul || '', os: jsonLinks(t.os),
    })),
  };
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
  syncCore(db);
  return { id, name, position };
}

function updateUnit(db, id, input) {
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  if (!row) return null;
  const name = text(input.name, 80);
  if (!name) throw fail('Unit name is required.');
  db.prepare('UPDATE units SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id);
  syncCore(db);
  return { id, name, position: row.position };
}

function deleteUnit(db, id) {
  const row = db.prepare('SELECT * FROM units WHERE id = ?').get(id);
  if (!row) return false;
  if (BUILTIN_UNIT_IDS.has(id)) throw fail('Built-in units cannot be deleted.', 403);
  const count = db.prepare('SELECT COUNT(*) AS n FROM topics WHERE unit_id = ?').get(id).n;
  if (count) throw fail('Move or delete the topics in this unit first.', 409);
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
  if (unitId !== row.unit_id) db.prepare('UPDATE questions SET unit = ? WHERE skill_id = ?').run(unitId, id);
  syncCore(db);
  return topicRow(db, id);
}

function deleteTopic(db, id) {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);
  if (!row) return false;
  if (row.source === 'builtin' || BUILTIN_TOPIC_IDS.has(id)) throw fail('Built-in topics can be hidden, not deleted.', 403);
  const count = db.prepare('SELECT COUNT(*) AS n FROM questions WHERE skill_id = ?').get(id).n;
  if (count) throw fail('Hide the topic instead; it still has questions.', 409);
  const dependent = db.prepare('SELECT id, pre FROM topics WHERE id <> ?').all(id)
    .filter(t => jsonArray(t.pre).includes(id)).map(t => t.id);
  if (dependent.length) throw fail('This topic is a prerequisite for: ' + dependent.join(', ') + '.', 409);
  db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  syncCore(db);
  return true;
}

module.exports = {
  init, syncCore, learner, admin, createUnit, updateUnit, deleteUnit, createTopic, updateTopic, deleteTopic,
};
