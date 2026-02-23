// src/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById, getAllUsers } from '../models/user.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 12;

/** Helper: sign a JWT for a user */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Body: { name, email, password }
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'name, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' });
  }

  try {
    const existing = findUserByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = createUser({ name, email: email.toLowerCase(), password: hashed });
    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  try {
    const user = findUserByEmail(email.toLowerCase());
    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Protected: returns current user profile from token
router.get('/me', authenticate, (req, res) => {
  try {
    const user = findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('[Auth] Me error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/auth/users ───────────────────────────────────────────────────────
// Protected + Admin only: list all users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  try {
    const users = getAllUsers();
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    console.error('[Auth] Users list error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
