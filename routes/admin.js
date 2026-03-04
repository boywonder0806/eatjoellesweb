const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { readData, writeData, getNextId } = require('../db/store');

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden — Admin only' });
  next();
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.username === username && u.active);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.userId             = user.id;
  req.session.username           = user.username;
  req.session.role               = user.role;
  req.session.mustChangePassword = user.mustChangePassword;
  res.json({ success: true });
});

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/admin/check
router.get('/check', requireAuth, (req, res) => {
  res.json({
    ok:                true,
    username:          req.session.username,
    role:              req.session.role,
    mustChangePassword: req.session.mustChangePassword
  });
});

// POST /api/admin/change-password — any logged-in user
router.post('/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const data = readData();
  const idx  = data.users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users[idx].passwordHash      = bcrypt.hashSync(newPassword, 10);
  data.users[idx].mustChangePassword = false;
  writeData(data);
  req.session.mustChangePassword = false;
  res.json({ success: true });
});

// ── MENUS (requireAdmin — admin only for menu management) ────────────────────

// GET /api/admin/menus
router.get('/menus', requireAuth, (req, res) => {
  const data = readData();
  res.json((data.menus || []).map(m => ({
    id:         m.id,
    name:       m.name,
    categories: m.categories,
    active:     m.id === data.active_menu_id,
    itemCount:  (m.items || []).length
  })));
});

// POST /api/admin/menus
router.post('/menus', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const data = readData();
  const menu = { id: getNextId(data.menus), name, categories: [], items: [] };
  data.menus.push(menu);
  writeData(data);
  res.json(menu);
});

// PUT /api/admin/menus/:id
router.put('/menus/:id', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  const idx  = data.menus.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Menu not found' });
  if (req.body.name       !== undefined) data.menus[idx].name       = req.body.name;
  if (req.body.categories !== undefined) data.menus[idx].categories = req.body.categories;
  writeData(data);
  res.json({ id: data.menus[idx].id, name: data.menus[idx].name, categories: data.menus[idx].categories });
});

// DELETE /api/admin/menus/:id
router.delete('/menus/:id', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  if (data.active_menu_id === id) return res.status(400).json({ error: 'Cannot delete the active menu' });
  if (data.menus.length <= 1)     return res.status(400).json({ error: 'Cannot delete the only menu' });
  data.menus = data.menus.filter(m => m.id !== id);
  writeData(data);
  res.json({ success: true });
});

// PUT /api/admin/menus/:id/activate
router.put('/menus/:id/activate', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  if (!data.menus.find(m => m.id === id)) return res.status(404).json({ error: 'Menu not found' });
  data.active_menu_id = id;
  writeData(data);
  res.json({ success: true, active_menu_id: id });
});

// ── MENU ITEMS (requireAuth — both roles) ─────────────────────────────────────

// GET /api/admin/menus/:menuId/items
router.get('/menus/:menuId/items', requireAuth, (req, res) => {
  const menuId = parseInt(req.params.menuId, 10);
  const data   = readData();
  const menu   = data.menus.find(m => m.id === menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  res.json((menu.items || []).sort((a, b) => a.category.localeCompare(b.category) || a.sort_order - b.sort_order));
});

// POST /api/admin/menus/:menuId/items
router.post('/menus/:menuId/items', requireAuth, (req, res) => {
  const menuId = parseInt(req.params.menuId, 10);
  const { category, name, description, price } = req.body;
  if (!category || !name || !price) return res.status(400).json({ error: 'category, name and price are required' });
  const data = readData();
  const menu = data.menus.find(m => m.id === menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  menu.items = menu.items || [];
  const catItems = menu.items.filter(i => i.category === category);
  const newItem  = {
    id:          getNextId(menu.items),
    category,
    name,
    description: description || '',
    price,
    sort_order:  catItems.length
  };
  menu.items.push(newItem);
  writeData(data);
  res.json(newItem);
});

// PUT /api/admin/menus/:menuId/items/:id
router.put('/menus/:menuId/items/:id', requireAuth, (req, res) => {
  const menuId = parseInt(req.params.menuId, 10);
  const id     = parseInt(req.params.id, 10);
  const data   = readData();
  const menu   = data.menus.find(m => m.id === menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  const idx = (menu.items || []).findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  menu.items[idx] = { ...menu.items[idx], ...req.body, id };
  writeData(data);
  res.json(menu.items[idx]);
});

// DELETE /api/admin/menus/:menuId/items/:id
router.delete('/menus/:menuId/items/:id', requireAuth, (req, res) => {
  const menuId = parseInt(req.params.menuId, 10);
  const id     = parseInt(req.params.id, 10);
  const data   = readData();
  const menu   = data.menus.find(m => m.id === menuId);
  if (!menu) return res.status(404).json({ error: 'Menu not found' });
  menu.items = (menu.items || []).filter(i => i.id !== id);
  writeData(data);
  res.json({ success: true });
});

// ── HOURS (requireAuth — both roles) ─────────────────────────────────────────

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
  const data   = readData();
  const newRow = { id: getNextId(data.hours), days, time_range, sort_order: data.hours.length };
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
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  data.hours = data.hours.filter(h => h.id !== id);
  writeData(data);
  res.json({ success: true });
});

// ── SETTINGS (requireAdmin — admin only) ─────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', requireAdmin, (req, res) => {
  const { settings } = readData();
  res.json(settings);
});

// PUT /api/admin/settings
router.put('/settings', requireAdmin, (req, res) => {
  const data    = readData();
  const allowed = ['address', 'phone', 'email'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) data.settings[key] = req.body[key];
  });
  writeData(data);
  res.json(data.settings);
});

// ── USERS (requireAdmin — admin only) ────────────────────────────────────────

// GET /api/admin/users
router.get('/users', requireAdmin, (req, res) => {
  const { users } = readData();
  res.json(users.map(({ passwordHash, ...u }) => u));
});

// POST /api/admin/users
router.post('/users', requireAdmin, (req, res) => {
  const { username, email, role, tempPassword } = req.body;
  if (!username || !email || !role || !tempPassword) {
    return res.status(400).json({ error: 'username, email, role and tempPassword are required' });
  }
  if (!['admin', 'manager'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or manager' });
  }
  const data = readData();
  if (data.users.find(u => u.username === username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const newUser = {
    id:                getNextId(data.users),
    username,
    email,
    role,
    passwordHash:      bcrypt.hashSync(tempPassword, 10),
    active:            true,
    mustChangePassword: true,
    createdAt:         new Date().toISOString()
  };
  data.users.push(newUser);
  writeData(data);
  const { passwordHash, ...safeUser } = newUser;
  res.json(safeUser);
});

// PUT /api/admin/users/:id
router.put('/users/:id', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();
  const idx  = data.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  // Cannot demote yourself
  if (id === req.session.userId && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  // Cannot remove last active admin
  if ((req.body.role === 'manager' || req.body.active === false) && data.users[idx].role === 'admin') {
    const otherActiveAdmins = data.users.filter(u => u.role === 'admin' && u.active && u.id !== id);
    if (otherActiveAdmins.length === 0) {
      return res.status(400).json({ error: 'Cannot demote or deactivate the last active admin' });
    }
  }

  const allowed = ['username', 'email', 'role', 'active'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) data.users[idx][key] = req.body[key];
  });
  writeData(data);
  const { passwordHash, ...safeUser } = data.users[idx];
  res.json(safeUser);
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, (req, res) => {
  const id   = parseInt(req.params.id, 10);
  const data = readData();

  if (id === req.session.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const target = data.users.find(u => u.id === id);
  if (target && target.role === 'admin') {
    const otherActiveAdmins = data.users.filter(u => u.role === 'admin' && u.active && u.id !== id);
    if (otherActiveAdmins.length === 0) {
      return res.status(400).json({ error: 'Cannot delete the last active admin' });
    }
  }

  data.users = data.users.filter(u => u.id !== id);
  writeData(data);
  res.json({ success: true });
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  const id           = parseInt(req.params.id, 10);
  const { tempPassword } = req.body;
  if (!tempPassword) return res.status(400).json({ error: 'tempPassword is required' });

  const data = readData();
  const idx  = data.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  data.users[idx].passwordHash      = bcrypt.hashSync(tempPassword, 10);
  data.users[idx].mustChangePassword = true;
  writeData(data);
  res.json({ success: true });
});

// ── ABOUT PAGE SETTINGS (requireAdmin) ───────────────────────────────────────

// GET /api/admin/about-page
router.get('/about-page', requireAdmin, (_req, res) => {
  res.json(readData().about_page || {});
});

// PUT /api/admin/about-page
router.put('/about-page', requireAdmin, (req, res) => {
  const { headline, tagline, overview, overview_image } = req.body;
  const data = readData();
  data.about_page = { headline, tagline, overview, overview_image };
  writeData(data);
  res.json(data.about_page);
});

// ── TEAM MEMBERS (requireAdmin) ───────────────────────────────────────────────

// GET /api/admin/team
router.get('/team', requireAdmin, (_req, res) => {
  const data = readData();
  res.json((data.team || []).sort((a, b) => a.sort_order - b.sort_order));
});

// POST /api/admin/team
router.post('/team', requireAdmin, (req, res) => {
  const { name, role, blurb, image_url } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const data = readData();
  data.team = data.team || [];
  const member = {
    id:         getNextId(data.team),
    name,
    role,
    blurb:      blurb     || '',
    image_url:  image_url || '',
    sort_order: data.team.length
  };
  data.team.push(member);
  writeData(data);
  res.json(member);
});

// PUT /api/admin/team/:id
router.put('/team/:id', requireAdmin, (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const data = readData();
  const idx  = (data.team || []).findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Team member not found' });
  data.team[idx] = { ...data.team[idx], ...req.body, id };
  writeData(data);
  res.json(data.team[idx]);
});

// DELETE /api/admin/team/:id
router.delete('/team/:id', requireAdmin, (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const data = readData();
  data.team  = (data.team || []).filter(m => m.id !== id);
  writeData(data);
  res.json({ success: true });
});

module.exports = router;
