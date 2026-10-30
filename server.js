// Togisumasu — self-hosted practice server.
// Zero npm dependencies: Node's built-in http, crypto and sqlite modules.
// Serves the single-page app from ./public and a small JSON API for accounts, progress and questions.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ai = require('./ai.js');
const bank = require('./questions.js');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);
// 'auto' sets Secure on the cookie when the request arrived over HTTPS (directly or via a proxy header).
const COOKIE_SECURE = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || '');
const ALLOW_REGISTRATION = !/^(0|false|no)$/i.test(process.env.ALLOW_REGISTRATION || 'true');
const ADMIN_EMAILS = String(process.env.ADMIN_EMAIL || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const MAX_BODY = 1024 * 1024; // 1 MB is far more than a progress document needs
const AI = ai.loadConfig(); // operator-supplied LLM key and provider; learners never see it

/* ---------------- database ---------------- */
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'togisumasu.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name       TEXT NOT NULL,
    pass_hash  TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'student',
    status     TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_usage (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     TEXT NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );
  CREATE TABLE IF NOT EXISTS admin_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id    INTEGER NOT NULL,
    admin_email TEXT NOT NULL,
    action      TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id   TEXT,
    detail      TEXT,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_audit_created ON admin_audit(created_at DESC);
`);
for (const [name, declaration] of [
  ['role', "role TEXT NOT NULL DEFAULT 'student'"],
  ['status', "status TEXT NOT NULL DEFAULT 'active'"],
]) {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some(c => c.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${declaration}`);
}
bank.init(db);
bank.seed(db, Number(process.env.QUESTION_SEED_PER_SKILL || 8));
const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  userById: db.prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (email, name, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
  sessionByHash: db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteSessions: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpired: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
  setRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  setStatus: db.prepare('UPDATE users SET status = ? WHERE id = ?'),
  setName: db.prepare('UPDATE users SET name = ? WHERE id = ?'),
  setPassword: db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?'),
  promoteByEmail: db.prepare("UPDATE users SET role = 'admin' WHERE email = ?"),
  getProgress: db.prepare('SELECT data, updated_at FROM progress WHERE user_id = ?'),
  aiUsage: db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?'),
  aiBump: db.prepare(`INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`),
  putProgress: db.prepare(`INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
  auditWrite: db.prepare(`INSERT INTO admin_audit
    (admin_id, admin_email, action, target_type, target_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
};
for (const email of ADMIN_EMAILS) q.promoteByEmail.run(email);
setInterval(() => q.deleteExpired.run(Date.now()), 60 * 60 * 1000).unref();

/* ---------------- passwords and sessions ---------------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, keyB64] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(key, expected);
}
// Spend the same time on unknown emails so response times don't reveal which accounts exist.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  q.insertSession.run(sha256(token), userId, Date.now() + SESSION_DAYS * 86400e3);
  return token; // only the hash is stored, so a leaked database cannot be used to log in
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isHttps(req) {
  if (req.socket.encrypted) return true;
  return TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function sessionCookie(req, token, maxAgeSec) {
  const secure = COOKIE_SECURE === 'true' || (COOKIE_SECURE === 'auto' && isHttps(req));
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
}
function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const row = q.sessionByHash.get(sha256(token));
  if (!row) return null;
  if (row.expires_at < Date.now()) { q.deleteSession.run(sha256(token)); return null; }
  const user = q.userById.get(row.user_id);
  if (!user || user.status !== 'active') { q.deleteSession.run(sha256(token)); return null; }
  return user;
}

/* ---------------- tiny rate limiter for login and registration ---------------- */
const attempts = new Map(); // key -> [timestamps]
function rateLimited(key, limit = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  return list.length > limit;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of attempts) if (v.every(t => now - t > 600000)) attempts.delete(k); }, 600000).unref();
function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

/* ---------------- http helpers ---------------- */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};
function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('Send JSON'), { status: 415 }));
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role });

/* ---------------- admin ---------------- */
function audit(admin, action, targetType, targetId, detail) {
  q.auditWrite.run(
    admin.id, admin.email, action, targetType,
    targetId == null ? null : String(targetId),
    detail == null ? null : JSON.stringify(detail),
    Date.now(),
  );
}
function activeAdminCount() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
}
function isLastActiveAdmin(user) {
  return user.role === 'admin' && user.status === 'active' && activeAdminCount() <= 1;
}
function adminUser(u) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
    createdAt: u.created_at, sessions: u.sessions == null ? undefined : u.sessions,
    progressAt: u.progress_at == null ? undefined : u.progress_at,
  };
}
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}
function emptyProgress() {
  const now = Date.now();
  return { skills: {}, log: {}, t: now, qz: { recent: [], last: 0, hist: [] }, seen: {}, resetAt: now };
}
function readProgress(userId) {
  const row = q.getProgress.get(userId);
  if (!row) return emptyProgress();
  try {
    const data = JSON.parse(row.data);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : emptyProgress();
  } catch (err) {
    return emptyProgress();
  }
}
function resetProgress(userId, scope, value) {
  const now = Date.now();
  let data = readProgress(userId);
  let ids = null;
  let removed = 0;
  if (scope === 'skill') {
    ids = new Set([value]);
  } else if (scope === 'unit') {
    ids = new Set(bank.skills().filter(s => s.unit === value).map(s => s.id));
  }
  if (scope === 'all') {
    removed = Object.keys(data.skills || {}).length;
    data = emptyProgress();
  } else {
    if (!data.skills || typeof data.skills !== 'object' || Array.isArray(data.skills)) data.skills = {};
    if (!data.seen || typeof data.seen !== 'object' || Array.isArray(data.seen)) data.seen = {};
    for (const id of ids) {
      if (Object.prototype.hasOwnProperty.call(data.skills, id)) removed++;
      delete data.skills[id];
      delete data.seen[id];
    }
    if (data.qz && Array.isArray(data.qz.recent)) data.qz.recent = data.qz.recent.filter(id => !ids.has(id));
    data.t = now;
    data.resetAt = now;
  }
  q.putProgress.run(userId, JSON.stringify(data), now);
  q.deleteSessions.run(userId);
  return { ok: true, scope, target: scope === 'all' ? null : value, removed, resetAt: data.resetAt };
}

async function adminApi(req, res, url, admin) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/admin/skills') return send(res, 200, { items: bank.skills(), units: bank.units() });

  if (route === 'GET /api/admin/users') {
    const status = String(url.searchParams.get('status') || 'all');
    if (!['all', 'active', 'disabled', 'deleted'].includes(status)) return send(res, 400, { error: 'Unknown user status.' });
    const text = String(url.searchParams.get('q') || '').trim().slice(0, 200);
    const where = [], params = [];
    if (status !== 'all') { where.push('status = ?'); params.push(status); }
    if (text) { where.push('(email LIKE ? OR name LIKE ?)'); params.push(`%${text}%`, `%${text}%`); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const limit = clampInt(url.searchParams.get('limit'), 1, 100, 50);
    const offset = clampInt(url.searchParams.get('offset'), 0, 1000000, 0);
    const total = db.prepare(`SELECT COUNT(*) AS n FROM users ${clause}`).get(...params).n;
    const rows = db.prepare(`
      SELECT id, email, name, role, status, created_at,
        (SELECT COUNT(*) FROM sessions WHERE user_id = users.id) AS sessions,
        (SELECT updated_at FROM progress WHERE user_id = users.id) AS progress_at
      FROM users ${clause} ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return send(res, 200, { items: rows.map(adminUser), total, limit, offset });
  }

  const userMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const target = q.userById.get(id);
    if (!target) return send(res, 404, { error: 'User not found.' });

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const role = body && body.role;
      const status = body && body.status;
      if (role === undefined && status === undefined) return send(res, 400, { error: 'Nothing to change.' });
      if (role !== undefined && !['student', 'admin'].includes(role)) return send(res, 400, { error: 'Role must be student or admin.' });
      if (status !== undefined && !['active', 'disabled'].includes(status)) return send(res, 400, { error: 'Status must be active or disabled.' });
      if (id === admin.id && (role === 'student' || status === 'disabled')) return send(res, 400, { error: 'You cannot disable or demote your own admin account.' });
      if (isLastActiveAdmin(target) && (role === 'student' || status === 'disabled')) return send(res, 400, { error: 'Keep at least one active admin.' });
      if (target.status === 'deleted' && status !== undefined && status !== 'active') return send(res, 400, { error: 'Restore the deleted account first.' });
      if (role !== undefined && role !== target.role) {
        q.setRole.run(role, id);
        audit(admin, 'user.role', 'user', id, { from: target.role, to: role });
      }
      if (status !== undefined && status !== target.status) {
        q.setStatus.run(status, id);
        if (status === 'disabled') q.deleteSessions.run(id);
        audit(admin, status === 'active' && target.status === 'deleted' ? 'user.restore' : 'user.status', 'user', id, { from: target.status, to: status });
      }
      return send(res, 200, { user: adminUser(q.userById.get(id)) });
    }

    if (req.method === 'DELETE') {
      if (id === admin.id) return send(res, 400, { error: 'You cannot delete your own admin account.' });
      if (isLastActiveAdmin(target)) return send(res, 400, { error: 'Keep at least one active admin.' });
      q.setStatus.run('deleted', id);
      q.deleteSessions.run(id);
      audit(admin, 'user.delete', 'user', id, { email: target.email });
      return send(res, 200, { ok: true });
    }
  }

  const userAction = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/(reset-password|restore|reset-progress)$/);
  if (req.method === 'POST' && userAction) {
    const id = Number(userAction[1]), action = userAction[2];
    const target = q.userById.get(id);
    if (!target) return send(res, 404, { error: 'User not found.' });
    if (action === 'reset-password') {
      const password = crypto.randomBytes(9).toString('base64url');
      q.setPassword.run(hashPassword(password), id);
      q.deleteSessions.run(id);
      audit(admin, 'user.reset_password', 'user', id, { email: target.email });
      return send(res, 200, { ok: true, password });
    }
    if (action === 'reset-progress') {
      const body = await readJson(req);
      const scope = String(body && body.scope || '');
      const value = String(body && body.value || '');
      if (!['all', 'unit', 'skill'].includes(scope)) return send(res, 400, { error: 'Scope must be all, unit or skill.' });
      if (scope === 'unit' && !bank.units().some(u => u.id === value)) return send(res, 400, { error: 'Unknown unit.' });
      if (scope === 'skill' && !bank.hasSkill(value)) return send(res, 400, { error: 'Unknown topic.' });
      const result = resetProgress(id, scope, value);
      audit(admin, 'user.reset_progress', 'user', id, { scope, target: result.target, removed: result.removed });
      return send(res, 200, result);
    }
    q.setStatus.run('active', id);
    audit(admin, 'user.restore', 'user', id, { email: target.email });
    return send(res, 200, { user: adminUser(q.userById.get(id)) });
  }

  if (route === 'GET /api/admin/questions') {
    const filters = {
      skillId: url.searchParams.get('skill') || '',
      status: url.searchParams.get('status') || 'all',
      source: url.searchParams.get('source') || 'all',
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
    };
    return send(res, 200, bank.adminList(db, filters));
  }

  if (route === 'POST /api/admin/questions') {
    const body = await readJson(req);
    const skillId = String(body && body.skillId || '');
    const question = body && body.question;
    if (!skillId || !question) return send(res, 400, { error: 'Choose a topic and provide the question.' });
    const added = bank.addManual(db, skillId, question);
    audit(admin, 'question.add', 'question', added.id, { skillId, type: added.type });
    return send(res, 201, { question: added });
  }

  if (route === 'POST /api/admin/questions/test') {
    const body = await readJson(req);
    if (!body || !body.question) return send(res, 400, { error: 'Provide a question to test.' });
    return send(res, 200, bank.testAnswer(body.question, body.answer));
  }

  if (route === 'POST /api/admin/questions/duplicate') {
    const body = await readJson(req);
    const skillId = String(body && body.skillId || '');
    const prompt = String(body && body.prompt || '');
    if (!skillId || !prompt) return send(res, 400, { error: 'Choose a topic and provide a prompt.' });
    const row = bank.duplicateQuestion(db, skillId, prompt, body.excludeId);
    return send(res, 200, {
      duplicate: !!row,
      question: row ? { id: row.id, prompt: row.prompt, status: row.status } : null,
    });
  }

  if (route === 'GET /api/admin/questions/export') {
    const format = String(url.searchParams.get('format') || 'json');
    if (!['json', 'csv'].includes(format)) return send(res, 400, { error: 'Format must be json or csv.' });
    const items = bank.adminExport(db, {
      skillId: url.searchParams.get('skill') || '',
      status: url.searchParams.get('status') || 'all',
      source: url.searchParams.get('source') || 'all',
      q: url.searchParams.get('q') || '',
    });
    if (format === 'csv') return send(res, 200, bank.exportCsv(items), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="togisumasu-questions.csv"',
    });
    return send(res, 200, { items });
  }

  if (route === 'POST /api/admin/questions/import') {
    const body = await readJson(req);
    const format = String(body && body.format || 'json');
    let items;
    if (format === 'csv') items = bank.parseCsvQuestions(String(body && body.text || ''));
    else if (format === 'json') items = Array.isArray(body && body.items) ? body.items : bank.parseJsonImport(String(body && body.text || ''));
    else return send(res, 400, { error: 'Format must be json or csv.' });
    const result = bank.importQuestions(db, items);
    audit(admin, 'question.import', 'question', null, { format, added: result.added, skipped: result.skipped, errorCount: result.errorCount });
    return send(res, 200, result);
  }

  const questionMatch = url.pathname.match(/^\/api\/admin\/questions\/(\d+)$/);
  if (questionMatch) {
    const id = Number(questionMatch[1]);
    const existing = bank.adminGet(db, id);
    if (!existing) return send(res, 404, { error: 'Question not found.' });
    if (req.method === 'GET') return send(res, 200, { question: existing });
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const status = body && body.status;
      const question = body && body.question;
      if (!question && status === undefined) return send(res, 400, { error: 'Nothing to change.' });
      if (status !== undefined && !['active', 'hidden', 'deleted'].includes(status)) return send(res, 400, { error: 'Question status must be active, hidden or deleted.' });
      let updated = existing;
      if (question) {
        updated = bank.updateQuestion(db, id, body.skillId, question);
        audit(admin, 'question.update', 'question', id, { skillId: updated.skillId, type: updated.type });
      }
      if (status !== undefined && status !== updated.status) {
        bank.setStatus(db, id, status);
        const action = status === 'active' ? 'question.restore' : status === 'hidden' ? 'question.hide' : 'question.delete';
        audit(admin, action, 'question', id, { from: updated.status, to: status });
        updated = bank.adminGet(db, id);
      }
      return send(res, 200, { question: updated });
    }
    if (req.method === 'DELETE') {
      bank.setStatus(db, id, 'deleted');
      audit(admin, 'question.delete', 'question', id, { skillId: existing.skillId });
      return send(res, 200, { ok: true });
    }
  }

  const questionAction = url.pathname.match(/^\/api\/admin\/questions\/(\d+)\/restore$/);
  if (req.method === 'POST' && questionAction) {
    const id = Number(questionAction[1]);
    const existing = bank.adminGet(db, id);
    if (!existing) return send(res, 404, { error: 'Question not found.' });
    bank.setStatus(db, id, 'active');
    audit(admin, 'question.restore', 'question', id, { from: existing.status, to: 'active' });
    return send(res, 200, { question: bank.adminGet(db, id) });
  }

  if (route === 'GET /api/admin/audit') {
    const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);
    const rows = db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?').all(limit);
    return send(res, 200, {
      items: rows.map(r => ({
        id: r.id, adminEmail: r.admin_email, action: r.action, targetType: r.target_type,
        targetId: r.target_id, detail: r.detail ? JSON.parse(r.detail) : null, createdAt: r.created_at,
      })),
    });
  }

  return send(res, 404, { error: 'Not found' });
}

/* ---------------- API ---------------- */
async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') return send(res, 200, { ok: true });

  if (route === 'GET /api/auth/config') return send(res, 200, { registration: ALLOW_REGISTRATION, ai: AI.enabled });

  if (route === 'POST /api/auth/register') {
    if (!ALLOW_REGISTRATION) return send(res, 403, { error: 'Registration is closed on this server.' });
    if (rateLimited('reg:' + clientIp(req), 20)) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const { email, password, name } = await readJson(req);
    const e = String(email || '').trim().toLowerCase(), n = String(name || '').trim(), p = String(password || '');
    if (!EMAIL_RE.test(e) || e.length > 254) return send(res, 400, { error: 'Enter a valid email address.' });
    if (!n || n.length > 60) return send(res, 400, { error: 'Enter your name (up to 60 characters).' });
    if (p.length < 8 || p.length > 200) return send(res, 400, { error: 'Use a password of at least 8 characters.' });
    if (q.userByEmail.get(e)) return send(res, 409, { error: 'An account with that email already exists. Sign in instead.' });
    const role = ADMIN_EMAILS.includes(e) ? 'admin' : 'student';
    const info = q.insertUser.run(e, n, hashPassword(p), role, Date.now());
    const user = q.userById.get(Number(info.lastInsertRowid));
    const token = createSession(user.id);
    return send(res, 201, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(req, token, SESSION_DAYS * 86400) });
  }

  if (route === 'POST /api/auth/login') {
    const ip = clientIp(req);
    const { email, password } = await readJson(req);
    const e = String(email || '').trim().toLowerCase(), p = String(password || '');
    if (rateLimited('login:' + ip) || rateLimited('login:' + e, 10)) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
    const row = q.userByEmail.get(e);
    const ok = verifyPassword(p, row ? row.pass_hash : DUMMY_HASH) && !!row;
    if (!ok) return send(res, 401, { error: 'Email or password is incorrect.' });
    if (row.status !== 'active') return send(res, 403, { error: 'This account is disabled. Ask an administrator to restore it.' });
    const token = createSession(row.id);
    return send(res, 200, { user: publicUser(row) }, { 'Set-Cookie': sessionCookie(req, token, SESSION_DAYS * 86400) });
  }

  if (route === 'POST /api/auth/logout') {
    const token = parseCookies(req).sid;
    if (token) q.deleteSession.run(sha256(token));
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
  }

  // Everything below needs a signed-in user, and only ever touches that user's row.
  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'Sign in first.' });

  if (route === 'GET /api/auth/me') return send(res, 200, { user: publicUser(user) });

  if (route === 'PATCH /api/account') {
    const body = await readJson(req);
    const name = body.name === undefined ? null : String(body.name || '').trim();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (name === null && !newPassword) return send(res, 400, { error: 'Change a name or password.' });
    if (name !== null && (!name || name.length > 60)) return send(res, 400, { error: 'Enter your name (up to 60 characters).' });
    if (newPassword) {
      if (newPassword.length < 8 || newPassword.length > 200) return send(res, 400, { error: 'Use a password of at least 8 characters.' });
      if (rateLimited('account:' + user.id, 8)) return send(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      const full = q.userByEmail.get(user.email);
      if (!full || !verifyPassword(currentPassword, full.pass_hash)) return send(res, 400, { error: 'Current password is incorrect.' });
    }
    if (name !== null) q.setName.run(name, user.id);
    if (newPassword) {
      q.setPassword.run(hashPassword(newPassword), user.id);
      q.deleteSessions.run(user.id);
      const token = createSession(user.id);
      return send(res, 200, { user: publicUser(q.userById.get(user.id)) }, { 'Set-Cookie': sessionCookie(req, token, SESSION_DAYS * 86400) });
    }
    return send(res, 200, { user: publicUser(q.userById.get(user.id)) });
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (user.role !== 'admin') return send(res, 403, { error: 'Admin access required.' });
    return adminApi(req, res, url, user);
  }

  if (route === 'GET /api/questions/next') {
    const skill = String(url.searchParams.get('skill') || '');
    if (!bank.hasSkill(skill)) return send(res, 404, { error: 'Unknown topic.' });
    const exclude = String(url.searchParams.get('exclude') || '').split(',').filter(Boolean).slice(-250);
    const question = bank.next(db, skill, exclude);
    if (!question) return send(res, 404, { error: 'No questions are available for that topic yet.' });
    return send(res, 200, { question });
  }

  if (route === 'GET /api/questions/search') {
    const text = String(url.searchParams.get('q') || '').trim();
    if (!text) return send(res, 400, { error: 'Add a search query.' });
    const items = bank.search(db, text, Number(url.searchParams.get('limit') || 10));
    return send(res, 200, { items });
  }

  const questionRoute = url.pathname.match(/^\/api\/questions\/(\d+)$/);
  if (req.method === 'GET' && questionRoute) {
    const question = bank.getActive(db, Number(questionRoute[1]));
    if (!question) return send(res, 404, { error: 'Question not found.' });
    return send(res, 200, { question });
  }

  const similarRoute = url.pathname.match(/^\/api\/questions\/(\d+)\/similar$/);
  if (req.method === 'GET' && similarRoute) {
    const items = bank.similar(db, Number(similarRoute[1]), Number(url.searchParams.get('limit') || 5));
    if (!items) return send(res, 404, { error: 'Question not found.' });
    return send(res, 200, { items });
  }

  if (route === 'POST /api/ai/explain') {
    if (!AI.enabled) return send(res, 404, { error: 'The AI tutor is not set up on this server.' });
    const body = await readJson(req);
    if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || typeof body.answer !== 'string')
      return send(res, 400, { error: 'Missing question details.' });
    const day = new Date().toISOString().slice(0, 10);
    const used = (q.aiUsage.get(user.id, day) || { count: 0 }).count;
    if (used >= AI.dailyLimit) return send(res, 429, { error: `You've used today's ${AI.dailyLimit} AI explanations. They reset at midnight UTC.` });
    if (rateLimited('ai:' + user.id, 6, 60 * 1000)) return send(res, 429, { error: 'Slow down a little: try again in a minute.' });
    try {
      const text = await ai.complete(AI, ai.TUTOR_SYSTEM, ai.tutorMessage(body));
      q.aiBump.run(user.id, day);
      return send(res, 200, { text, remaining: Math.max(0, AI.dailyLimit - used - 1) });
    } catch (e) {
      console.error('[ai]', e.message);
      return send(res, 502, { error: 'The AI tutor could not answer right now. The worked solution above still applies.' });
    }
  }

  if (route === 'GET /api/progress') {
    const row = q.getProgress.get(user.id);
    return send(res, 200, { data: row ? JSON.parse(row.data) : null, updatedAt: row ? row.updated_at : 0 });
  }

  if (route === 'PUT /api/progress') {
    const body = await readJson(req);
    const data = body && body.data;
    if (!data || typeof data !== 'object' || typeof data.skills !== 'object' || Array.isArray(data.skills))
      return send(res, 400, { error: 'Progress must be an object with a skills map.' });
    const now = Date.now();
    q.putProgress.run(user.id, JSON.stringify(data), now);
    return send(res, 200, { ok: true, updatedAt: now });
  }

  return send(res, 404, { error: 'Not found' });
}

/* ---------------- static files ---------------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/admin' || rel === '/admin/') rel = '/admin.html';
  if (rel === '/' || !path.extname(rel)) rel = '/index.html'; // single-page app
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const noCache = rel === '/index.html' || rel === '/admin.html';
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': noCache ? 'no-cache' : 'public, max-age=3600' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url);
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    if (!err.status) console.error(err);
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Togisumasu listening on http://localhost:${PORT} (data in ${DATA_DIR})`);
    console.log(`Question bank: ${bank.count(db)} questions in SQLite (FTS5 similarity search).`);
    console.log(AI.enabled ? `AI tutor: ${AI.provider} / ${AI.model} (limit ${AI.dailyLimit} per user per day)` : `AI tutor: off. ${AI.reason}`);
  });
  const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
module.exports = { server, db };
