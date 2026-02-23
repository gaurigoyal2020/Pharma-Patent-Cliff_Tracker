// src/models/user.js
import db from '../config/database.js';

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// ── Prepared statements ──────────────────────────────────────────────────────

const stmtInsert = db.prepare(`
  INSERT INTO users (name, email, password, role)
  VALUES (:name, :email, :password, :role)
`);

const stmtFindByEmail = db.prepare(`
  SELECT * FROM users WHERE email = ? LIMIT 1
`);

const stmtFindById = db.prepare(`
  SELECT id, name, email, role, created_at FROM users WHERE id = ? LIMIT 1
`);

const stmtAll = db.prepare(`
  SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC
`);

// ── Model functions ──────────────────────────────────────────────────────────

export function createUser({ name, email, password, role = 'user' }) {
  const result = stmtInsert.run({ name, email, password, role });
  return { id: result.lastInsertRowid, name, email, role };
}

export function findUserByEmail(email) {
  return stmtFindByEmail.get(email) || null;
}

export function findUserById(id) {
  return stmtFindById.get(id) || null;
}

export function getAllUsers() {
  return stmtAll.all();
}