'use strict';
// Small operator CLI for bootstrapping an admin or fixing an account when the web UI is unavailable.
// Examples: node admin.js list
//           node admin.js promote you@example.com
//           docker exec togisumasu node admin.js promote you@example.com
const { db } = require('./server.js');

const command = String(process.argv[2] || 'list').toLowerCase();
const email = String(process.argv[3] || '').trim().toLowerCase();
const user = email ? db.prepare('SELECT * FROM users WHERE email = ?').get(email) : null;

function activeAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
}
function protectLastAdmin(target) {
  if (target.role === 'admin' && target.status === 'active' && activeAdmins() <= 1) {
    console.error('Refusing: this is the last active admin. Promote another account first.');
    process.exit(1);
  }
}
function requireUser() {
  if (!user) {
    console.error(`No account found for ${email || '(missing email)'}. Register it in the app first.`);
    process.exit(1);
  }
  return user;
}
function setStatus(target, status) {
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, target.id);
  if (status !== 'active') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
}

switch (command) {
  case 'list': {
    const rows = db.prepare('SELECT id, email, name, role, status, created_at FROM users ORDER BY id').all();
    for (const r of rows) {
      console.log(`${String(r.id).padStart(4)}  ${r.role.padEnd(7)}  ${r.status.padEnd(8)}  ${r.email}  (${r.name})`);
    }
    console.log(`${rows.length} account${rows.length === 1 ? '' : 's'}`);
    break;
  }
  case 'promote': {
    const target = requireUser();
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(target.id);
    console.log(`Promoted ${target.email} to admin.`);
    break;
  }
  case 'demote': {
    const target = requireUser();
    protectLastAdmin(target);
    db.prepare("UPDATE users SET role = 'student' WHERE id = ?").run(target.id);
    console.log(`Demoted ${target.email} to student.`);
    break;
  }
  case 'disable': {
    const target = requireUser();
    protectLastAdmin(target);
    setStatus(target, 'disabled');
    console.log(`Disabled ${target.email} and revoked its sessions.`);
    break;
  }
  case 'enable':
  case 'restore': {
    const target = requireUser();
    setStatus(target, 'active');
    console.log(`Restored ${target.email} to active.`);
    break;
  }
  case 'delete': {
    const target = requireUser();
    protectLastAdmin(target);
    setStatus(target, 'deleted');
    console.log(`Soft-deleted ${target.email} and revoked its sessions.`);
    break;
  }
  default:
    console.log(`Usage: node admin.js [list|promote|demote|disable|enable|restore|delete] [email]`);
    process.exitCode = 1;
}

db.close();
