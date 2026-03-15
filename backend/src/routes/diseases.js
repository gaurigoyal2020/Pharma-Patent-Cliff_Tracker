// src/routes/diseases.js

import { Router } from 'express';
import { getAllDiseases, getDrugsByDiseaseForFrontend } from '../models/disease.js';

const router = Router();

// GET /api/diseases
// Returns the list of supported disease names.
// Response: { success: true, data: ["Diabetes", "Heart Disease", ...] }
router.get('/', (req, res) => {
  try {
    const diseases = getAllDiseases();
    res.json({ success: true, count: diseases.length, data: diseases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/diseases/:disease/drugs
// Returns drugs for a given disease in frontend card format.
// Response: { success, count, data: [{id, app_no, name, generic_name,
//              dosage_form, strength, patent_expired, patent_expiry?}, ...] }
router.get('/:disease/drugs', (req, res) => {
  try {
    const disease = decodeURIComponent(req.params.disease);
    const drugs = getDrugsByDiseaseForFrontend(disease);

    if (drugs === null) {
      return res.status(404).json({
        success: false,
        error: `Unknown disease: "${disease}". Call GET /api/diseases for the full list.`,
      });
    }

    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
