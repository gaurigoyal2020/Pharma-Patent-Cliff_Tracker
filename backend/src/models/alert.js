// src/models/alert.js
import db from '../config/database.js';

// ── Table bootstrap ───────────────────────────────────────────────────────────
export async function createAlertsTable() {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS user_alerts (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      drug_name   VARCHAR(255) NOT NULL,
      alert_type  VARCHAR(50)  NOT NULL,   -- '30-day' | '90-day' | '180-day' | '365-day' | 'generic_available'
      message     TEXT         NOT NULL,
      read        BOOLEAN      NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await db.raw(`
    CREATE INDEX IF NOT EXISTS idx_alerts_user_id    ON user_alerts(user_id)
  `);
  await db.raw(`
    CREATE INDEX IF NOT EXISTS idx_alerts_read       ON user_alerts(user_id, read)
  `);
  console.log('[DB] user_alerts table ready');
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Return all alerts for a user, newest first */
export async function getAlertsByUser(userId) {
  return db('user_alerts')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc');
}

/** Insert an alert and return the created row */
export async function createAlert(userId, { drug_name, alert_type, message }) {
  const rows = await db('user_alerts')
    .insert({ user_id: userId, drug_name, alert_type, message })
    .returning('*');
  return rows[0];
}

/** Mark a single alert as read; returns true if found */
export async function markAlertRead(id, userId) {
  const updated = await db('user_alerts')
    .where({ id, user_id: userId })
    .update({ read: true })
    .returning('id');
  return updated.length > 0;
}

/** Delete a single alert; returns true if found */
export async function deleteAlert(id, userId) {
  const deleted = await db('user_alerts')
    .where({ id, user_id: userId })
    .delete()
    .returning('id');
  return deleted.length > 0;
}

/**
 * Checks whether an alert of the same type for the same drug
 * has already been sent to this user today. Used by the cron
 * to prevent duplicate alerts on re-runs.
 */
export async function alertAlreadySentToday(userId, drug_name, alert_type) {
  const row = await db('user_alerts')
    .where({ user_id: userId, drug_name, alert_type })
    .whereRaw(`created_at::date = CURRENT_DATE`)
    .first();
  return Boolean(row);
}