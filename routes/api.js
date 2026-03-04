const express = require('express');
const router  = express.Router();
const { readData } = require('../db/store');

// GET /api/menu — active menu items grouped by category
router.get('/menu', (req, res) => {
  const data   = readData();
  const active = (data.menus || []).find(m => m.id === data.active_menu_id) || (data.menus || [])[0];
  if (!active) return res.json({ categories: [], grouped: {}, menuName: '' });
  const grouped = {};
  active.categories.forEach(cat => { grouped[cat] = []; });
  (active.items || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach(item => { if (grouped[item.category]) grouped[item.category].push(item); });
  res.json({ categories: active.categories, grouped, menuName: active.name });
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

// GET /api/about
router.get('/about', (_req, res) => {
  const data = readData();
  res.json({
    about_page: data.about_page || {},
    team: (data.team || []).sort((a, b) => a.sort_order - b.sort_order)
  });
});

module.exports = router;
