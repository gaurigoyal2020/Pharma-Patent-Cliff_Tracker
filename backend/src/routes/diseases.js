import { Router } from 'express';
import { getAllDiseases, getDrugsByDiseaseForFrontend } from '../models/disease.js';

const router = Router();

// GET /api/diseases
router.get('/', (req, res) => {
  try {
    const diseases = getAllDiseases();
    res.json({ success: true, count: diseases.length, data: diseases });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/diseases/:disease/drugs
router.get('/:disease/drugs', async (req, res) => {
  try {
    const disease = decodeURIComponent(req.params.disease);
    const drugs = await getDrugsByDiseaseForFrontend(disease);

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