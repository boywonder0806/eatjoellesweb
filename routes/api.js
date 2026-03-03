const express = require('express');
const router  = express.Router();
const { readData } = require('../db/store');

// GET /api/menu — all items grouped by category
router.get('/menu', (req, res) => {
  const { menu } = readData();
  const grouped = { starters: [], mains: [], desserts: [], drinks: [] };
  menu
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach(item => {
      if (grouped[item.category]) grouped[item.category].push(item);
    });
  res.json(grouped);
});

// GET /api/hours
router.get('/hours', (req, res) => {
  const { hours } = readData();
  res.json(hours.sort((a, b) => a.sort_order - b.sort_order));
});

// GET /api/settings
router.get('/settings', (req, res) => {
  const { settings } = readData();
  res.json(settings);
});

module.exports = router;
