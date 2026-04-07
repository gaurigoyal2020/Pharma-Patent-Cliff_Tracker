// src/routes/ocr.js
// Proxies image uploads to OCR.space so the API key stays server-side.

import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

const router = Router();

// Store the file in memory (no disk writes needed — we stream it straight to OCR.space)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/ocr/extract
 * Accepts: multipart/form-data  { image: <file> }
 * Returns: { success: true, parsedText: string }
 *          { success: false, error: string }
 */
router.post('/extract', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file provided' });
  }

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    console.error('[OCR] OCR_SPACE_API_KEY env variable is not set');
    return res.status(500).json({ success: false, error: 'OCR service is not configured' });
  }

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');
    form.append('detectOrientation', 'true');
    form.append('scale', 'true');
    form.append('OCREngine', '2');

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: apiKey,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!ocrResponse.ok) {
      throw new Error(`OCR.space returned HTTP ${ocrResponse.status}`);
    }

    const data = await ocrResponse.json();

    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.[0] || 'OCR processing failed');
    }

    const parsedText = data.ParsedResults?.[0]?.ParsedText || '';
    return res.json({ success: true, parsedText });
  } catch (err) {
    console.error('[OCR] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to process image' });
  }
});

export default router;