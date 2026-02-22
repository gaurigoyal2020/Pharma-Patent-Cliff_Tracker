// src/config/database.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB file lives in /app/data/database.db inside the container,
// which maps to ./data/database.db on your hard disk via the Docker volume.
const DB_PATH = path.join(__dirname, '../../data/database.db');

const db = new Database(DB_PATH);

// Better performance settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`✅ SQLite connected: ${DB_PATH}`);

export default db;