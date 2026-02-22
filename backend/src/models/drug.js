// src/models/drug.js
// SQLite uses ? placeholders instead of $1, $2
// better-sqlite3 is synchronous (no async/await needed for queries)

import db from '../config/database.js';

class Drug {
  static findById(id) {
    return db.prepare('SELECT * FROM drugs WHERE id = ?').get(id);
  }

  static search({ q, category, limit = 50 }) {
    let sql = 'SELECT * FROM drugs WHERE 1=1';
    const params = [];

    if (q) {
      // Search generic_name or inside the brand_names JSON string
      sql += ' AND (generic_name LIKE ? OR brand_names LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params);
  }

  static getWithDetails(id) {
    const drug = this.findById(id);
    if (!drug) return null;

    // Parse brand_names back from JSON string
    if (drug.brand_names) {
      try { drug.brand_names = JSON.parse(drug.brand_names); }
      catch { drug.brand_names = []; }
    }

    const patents = db
      .prepare('SELECT * FROM patents WHERE drug_id = ? ORDER BY expiry_date ASC')
      .all(id);

    const prediction = db
      .prepare('SELECT * FROM predictions WHERE drug_id = ?')
      .get(id);

    return { drug, patents, prediction: prediction || null };
  }

  static getCategories() {
    return db
      .prepare('SELECT category, COUNT(*) as count FROM drugs GROUP BY category ORDER BY count DESC')
      .all();
  }
}

export default Drug;