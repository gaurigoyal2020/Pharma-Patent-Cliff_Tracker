import { Router } from 'express';
import {
  getAllDrugs,
  getDrugByAppNo,
  searchDrugsForFrontend,
  getDrugAlternativesForFrontend,
  getExpiringPatents,
  getPatentStatus,
  matchDrugFromOCRText,
} from '../models/drug.js';

const router = Router();

// GET /api/drugs
router.get('/', async (req, res) => {
  try {
    const drugs = await getAllDrugs();
    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/search?q=lipitor
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
  }
  try {
    const results = await searchDrugsForFrontend(q.trim());
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/alternatives/:app_no
router.get('/alternatives/:app_no', async (req, res) => {
  try {
    const result = await getDrugAlternativesForFrontend(req.params.app_no);
    if (!result) return res.status(404).json({ success: false, error: 'Drug not found' });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/expiring?days=365
router.get('/expiring', async (req, res) => {
  const days = parseInt(req.query.days) || 365;
  try {
    const patents = await getExpiringPatents(days);
    res.json({ success: true, count: patents.length, data: patents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/drugs/match
// Body: { text: "<raw OCR text>" }
// Returns the first drug name found in the text, matched against the DB.
// Used by the frontend after OCR to replace the hardcoded knownDrugs list.
router.post('/match', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'Request body must include a non-empty "text" field' });
  }
  try {
    const matchedName = await matchDrugFromOCRText(text);
    if (!matchedName) {
      return res.status(404).json({ success: false, error: 'No drug name found in the provided text' });
    }
    res.json({ success: true, drugName: matchedName });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/:app_no
router.get('/:app_no', async (req, res) => {
  try {
    const drug = await getDrugByAppNo(req.params.app_no);
    if (!drug) return res.status(404).json({ success: false, error: 'Drug not found' });
    res.json({ success: true, data: drug });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/drugs/:app_no/patents
router.get('/:app_no/patents', async (req, res) => {
  try {
    const patents = await getPatentStatus(req.params.app_no);
    if (!patents.length) return res.status(404).json({ success: false, error: 'No patents found' });
    res.json({ success: true, count: patents.length, data: patents });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;