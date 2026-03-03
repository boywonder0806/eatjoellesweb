const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { readData, writeData, getNextId } = require('../db/store');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = readData();
  if (
    username !== data.admin.username ||
    !bcrypt.compareSync(password, data.admin.passwordHash)
  ) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.userId   = 1;
  req.session.username = data.admin.username;
  res.json({ success: true });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/admin/check — verify session is active
router.get('/check', requireAuth, (req, res) => {
  res.json({ ok: true, username: req.session.username });
});

// ── MENU ─────────────────────────────────────────

// GET /api/admin/menu
router.get('/menu', requireAuth, (req, res) => {
  const { menu } = readData();
  res.json(menu.sort((a, b) => a.category.localeCompare(b.category) || a.sort_order - b.sort_order));
});

// POST /api/admin/menu
router.post('/menu', requireAuth, (req, res) => {
  const { category, name, description, price } = req.body;
  if (!category || !name || !price) {
    return res.status(400).json({ error: 'category, name and price are required' });
  }
  const data      = readData();
  const catItems  = data.menu.filter(i => i.category === category);
  const newItem   = {
    id:          getNextId(data.menu),
    category,
    name,
    description: description || '',
    price,
    sort_order:  catItems.length
  };
  data.menu.push(newItem);
  writeData(data);
  res.json(newItem);
});

// PUT /api/admin/menu/:id
router.put('/menu/:id', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  const idx  = data.menu.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  data.menu[idx] = { ...data.menu[idx], ...req.body, id };
  writeData(data);
  res.json(data.menu[idx]);
});

// DELETE /api/admin/menu/:id
router.delete('/menu/:id', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  data.menu  = data.menu.filter(i => i.id !== id);
  writeData(data);
  res.json({ success: true });
});

// ── HOURS ────────────────────────────────────────

// GET /api/admin/hours
router.get('/hours', requireAuth, (req, res) => {
  const { hours } = readData();
  res.json(hours.sort((a, b) => a.sort_order - b.sort_order));
});

// POST /api/admin/hours
router.post('/hours', requireAuth, (req, res) => {
  const { days, time_range } = req.body;
  if (!days || !time_range) {
    return res.status(400).json({ error: 'days and time_range are required' });
  }
  const data    = readData();
  const newRow  = { id: getNextId(data.hours), days, time_range, sort_order: data.hours.length };
  data.hours.push(newRow);
  writeData(data);
  res.json(newRow);
});

// PUT /api/admin/hours/:id
router.put('/hours/:id', requireAuth, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  const idx  = data.hours.findIndex(h => h.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Row not found' });
  data.hours[idx] = { ...data.hours[idx], ...req.body, id };
  writeData(data);
  res.json(data.hours[idx]);
});

// DELETE /api/admin/hours/:id
router.delete('/hours/:id', requireAuth, (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const data  = readData();
  data.hours  = data.hours.filter(h => h.id !== id);
  writeData(data);
  res.json({ success: true });
});

// ── SETTINGS ─────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', requireAuth, (req, res) => {
  const { settings } = readData();
  res.json(settings);
});

// PUT /api/admin/settings
router.put('/settings', requireAuth, (req, res) => {
  const data     = readData();
  const allowed  = ['address', 'phone', 'email'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) data.settings[key] = req.body[key];
  });
  writeData(data);
  res.json(data.settings);
});

module.exports = router;
