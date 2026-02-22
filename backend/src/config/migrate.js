// src/config/migrate.js
// Runs automatically on app startup. Safe to run multiple times (uses IF NOT EXISTS).

import db from './database.js';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      generic_name TEXT NOT NULL,
      brand_names TEXT,        -- stored as JSON string, e.g. '["Lipitor"]'
      strength TEXT,
      dosage_form TEXT,
      category TEXT,
      fda_application_number TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name);
    CREATE INDEX IF NOT EXISTS idx_drugs_category ON drugs(category);

    CREATE TABLE IF NOT EXISTS patents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER REFERENCES drugs(id) ON DELETE CASCADE,
      patent_number TEXT UNIQUE NOT NULL,
      patent_type TEXT,
      expiry_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_patents_drug_id ON patents(drug_id);
    CREATE INDEX IF NOT EXISTS idx_patents_expiry_date ON patents(expiry_date);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      drug_id INTEGER UNIQUE REFERENCES drugs(id) ON DELETE CASCADE,
      predicted_entry_date TEXT,
      strategy TEXT,
      confidence_score REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Migrations complete');
}