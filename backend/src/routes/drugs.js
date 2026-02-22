// src/routes/drugs.js
import { Router } from 'express';
import {
  getAllDrugs,
  getDrugByAppNo,
  searchDrugs,
  getDrugsByDisease,
  getExpiringPatents,
  getPatentStatus,
} from '../models/drug.js';

const router = Router();

// GET /api/drugs
// Returns all drugs with summary (product count, patent count, expiry dates)
router.get('/', (req, res) => {
  try {
    const drugs = getAllDrugs();
    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/search?q=rivaroxaban
// Search by brand name or generic name
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
  }
  try {
    const results = searchDrugs(q.trim());
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/expiring?days=365
// Patents expiring within N days
router.get('/expiring', (req, res) => {
  const days = parseInt(req.query.days) || 365;
  try {
    const patents = getExpiringPatents(days);
    res.json({ success: true, count: patents.length, data: patents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/disease/:disease
// e.g. /api/drugs/disease/Diabetes
router.get('/disease/:disease', (req, res) => {
  try {
    const drugs = getDrugsByDisease(req.params.disease);
    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/:app_no
// Full drug detail with products and patents
router.get('/:app_no', (req, res) => {
  try {
    const drug = getDrugByAppNo(req.params.app_no);
    if (!drug) return res.status(404).json({ success: false, error: 'Drug not found' });
    res.json({ success: true, data: drug });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/:app_no/patents
// Patent status for a specific drug
router.get('/:app_no/patents', (req, res) => {
  try {
    const patents = getPatentStatus(req.params.app_no);
    if (!patents.length) return res.status(404).json({ success: false, error: 'No patents found' });
    res.json({ success: true, count: patents.length, data: patents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;