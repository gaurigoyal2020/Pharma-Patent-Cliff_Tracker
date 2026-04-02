// src/routes/users.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getWatchlistByUser,
  addToWatchlist,
  removeFromWatchlist,
} from '../models/watchlist.js';
import {
  getAlertsByUser,
  markAlertRead,
  deleteAlert,
} from '../models/alert.js';

const router = Router();

// All /api/users routes require a valid JWT
router.use(authenticate);

// ══════════════════════════════════════════════════════════════
//  WATCHLIST
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/users/watchlist
 * Returns the authenticated user's watchlist, sorted by expiry date asc.
 */
router.get('/watchlist', async (req, res) => {
  try {
    const list = await getWatchlistByUser(req.user.id);
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    console.error('[Watchlist] GET error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/users/watchlist
 * Body: { drug_name, generic_name, patent_expiry, dosage_form?, category? }
 * Adds a drug to the authenticated user's watchlist.
 */
router.post('/watchlist', async (req, res) => {
  const { drug_name, generic_name, patent_expiry, dosage_form, category } = req.body;

  if (!drug_name || !generic_name || !patent_expiry) {
    return res.status(400).json({
      success: false,
      error: 'drug_name, generic_name, and patent_expiry are required',
    });
  }

  // Validate date format
  const expiry = new Date(patent_expiry);
  if (isNaN(expiry.getTime())) {
    return res.status(400).json({ success: false, error: 'patent_expiry must be a valid date (YYYY-MM-DD)' });
  }

  try {
    const entry = await addToWatchlist(req.user.id, {
      drug_name,
      generic_name,
      patent_expiry,
      dosage_form,
      category,
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    console.error('[Watchlist] POST error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/watchlist/:id
 * Removes a watchlist entry that belongs to the authenticated user.
 */
router.delete('/watchlist/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid watchlist entry id' });
  }

  try {
    const deleted = await removeFromWatchlist(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Watchlist entry not found' });
    }
    res.json({ success: true, message: 'Entry removed from watchlist' });
  } catch (err) {
    console.error('[Watchlist] DELETE error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════
//  ALERTS
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/users/alerts
 * Returns all alerts for the authenticated user, newest first.
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await getAlertsByUser(req.user.id);
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    console.error('[Alerts] GET error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/users/alerts/:id/read
 * Marks a single alert as read.
 */
router.patch('/alerts/:id/read', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid alert id' });
  }

  try {
    const updated = await markAlertRead(id, req.user.id);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, message: 'Alert marked as read' });
  } catch (err) {
    console.error('[Alerts] PATCH error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/users/alerts/:id
 * Deletes (dismisses) a single alert.
 */
router.delete('/alerts/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ success: false, error: 'Invalid alert id' });
  }

  try {
    const deleted = await deleteAlert(id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, message: 'Alert dismissed' });
  } catch (err) {
    console.error('[Alerts] DELETE error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;