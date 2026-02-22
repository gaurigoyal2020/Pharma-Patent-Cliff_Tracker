// UPDATE your existing: backend/src/routes/drugs.js

const express = require('express');
const router = express.Router();
const Drug = require('../models/Drug');

// Search drugs
router.get('/search', async (req, res) => {
  try {
    const { q, category } = req.query;
    
    const drugs = await Drug.search({
      q,
      category,
      limit: 50
    });

    res.json(drugs);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get drug by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const result = await Drug.getWithDetails(req.params.id);
    
    if (!result || !result.drug) {
      return res.status(404).json({ error: 'Drug not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get drug error:', error);
    res.status(500).json({ error: 'Failed to fetch drug details' });
  }
});

// Get drug categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Drug.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;