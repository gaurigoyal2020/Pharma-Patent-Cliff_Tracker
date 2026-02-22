// src/models/user.js
import db from '../config/database.js';
import bcrypt from 'bcrypt';

class User {
  static findById(id) {
    return db
      .prepare('SELECT id, email, first_name, last_name, created_at FROM users WHERE id = ?')
      .get(id);
  }

  static findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  static async create({ email, password, firstName, lastName }) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db
      .prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES (?, ?, ?, ?)`
      )
      .run(email, hashedPassword, firstName || null, lastName || null);

    // Return the new user (without password_hash)
    return this.findById(result.lastInsertRowid);
  }

  static async verifyPassword(email, password) {
    const user = this.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    delete user.password_hash;
    return user;
  }
}

export default User;