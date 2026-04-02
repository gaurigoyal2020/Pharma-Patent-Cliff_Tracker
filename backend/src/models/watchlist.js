// src/models/watchlist.js
import db from '../config/database.js';

// ── Table bootstrap ───────────────────────────────────────────────────────────
export async function createWatchlistTable() {
  await db.raw(`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      drug_name     VARCHAR(255) NOT NULL,
      generic_name  VARCHAR(255) NOT NULL,
      patent_expiry DATE        NOT NULL,
      dosage_form   VARCHAR(255),
      category      VARCHAR(255),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.raw(`
    CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON user_watchlist(user_id)
  `);
  await db.raw(`
    CREATE INDEX IF NOT EXISTS idx_watchlist_expiry ON user_watchlist(patent_expiry)
  `);
  console.log('[DB] user_watchlist table ready');
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Return all watchlist entries for a user, soonest expiry first */
export async function getWatchlistByUser(userId) {
  return db('user_watchlist')
    .where({ user_id: userId })
    .orderBy('patent_expiry', 'asc');
}

/** Insert a new watchlist entry; returns the created row */
export async function addToWatchlist(userId, { drug_name, generic_name, patent_expiry, dosage_form, category }) {
  const rows = await db('user_watchlist')
    .insert({
      user_id: userId,
      drug_name:     drug_name.trim().toUpperCase(),
      generic_name:  generic_name.trim(),
      patent_expiry,
      dosage_form:   dosage_form?.trim() || null,
      category:      category?.trim()    || null,
    })
    .returning('*');
  return rows[0];
}

/** Delete a watchlist entry only if it belongs to the requesting user */
export async function removeFromWatchlist(id, userId) {
  const deleted = await db('user_watchlist')
    .where({ id, user_id: userId })
    .delete()
    .returning('id');
  return deleted.length > 0;   // true = found & deleted
}

/**
 * Returns all watchlist rows that are exactly N days from expiry
 * Used by the daily cron job to generate alerts.
 * Joins users table to get the email address.
 */
export async function getWatchlistEntriesExpiringIn(days) {
  return db('user_watchlist as w')
    .join('users as u', 'w.user_id', 'u.id')
    .select(
      'w.id',
      'w.user_id',
      'w.drug_name',
      'w.generic_name',
      'w.patent_expiry',
      'w.dosage_form',
      'w.category',
      'u.email',
      'u.name as user_name',
    )
    .whereRaw(`DATE_PART('day', w.patent_expiry::date - CURRENT_DATE) = ?`, [days]);
}