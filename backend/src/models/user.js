import db from '../config/database.js';

// Creates the users table if it doesn't exist.
// Called once during server startup from server.js
export async function createUsersTable() {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.raw(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);
  console.log('[DB] Users table ready');
}

export async function createUser({ name, email, password, role = 'user' }) {
  const rows = await db('users')
    .insert({ name, email, password, role })
    .returning(['id', 'name', 'email', 'role']);
  return rows[0];
}

export async function findUserByEmail(email) {
  const row = await db('users').where({ email }).first();
  return row || null;
}

export async function findUserById(id) {
  const row = await db('users')
    .select('id', 'name', 'email', 'role', 'created_at')
    .where({ id })
    .first();
  return row || null;
}

export async function getAllUsers() {
  return db('users')
    .select('id', 'name', 'email', 'role', 'created_at')
    .orderBy('created_at', 'desc');
}