const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const { readData, writeData } = require('./db/store');

const app = express();

// ── First-run / migration setup ────────────────────────────────────────────
(function init() {
  const data = readData();
  if (data.admin) {
    // Migrate legacy single-admin format → users array
    const hash = data.admin.passwordHash || bcrypt.hashSync('joelles2026', 10);
    data.users = [{
      id:                1,
      username:          data.admin.username || 'admin',
      email:             'admin@joelleslounge.com',
      role:              'admin',
      passwordHash:      hash,
      active:            true,
      mustChangePassword: false,
      createdAt:         new Date().toISOString()
    }];
    delete data.admin;
    writeData(data);
    console.log('✓ Migrated to multi-user system. Existing admin password preserved.');
  } else if (!data.users) {
    data.users = [{
      id:                1,
      username:          'admin',
      email:             'admin@joelleslounge.com',
      role:              'admin',
      passwordHash:      bcrypt.hashSync('joelles2026', 10),
      active:            true,
      mustChangePassword: false,
      createdAt:         new Date().toISOString()
    }];
    writeData(data);
    console.log('✓ Admin account initialised. Login: admin / joelles2026');
  }

  // ── Multi-menu migration ──────────────────────────────────────────────────
  if (!data.menus) {
    data.menus = [{
      id:         1,
      name:       'Regular Menu',
      categories: ['starters', 'mains', 'desserts', 'drinks'],
      items:      data.menu || []
    }];
    data.active_menu_id = 1;
    delete data.menu;
    writeData(data);
    console.log('✓ Migrated to multi-menu system.');
  }
})();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            'joells-lounge-change-me-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// ── Public API routes ───────────────────────────────────────────────────────
app.use('/api',       require('./routes/api'));
app.use('/api/admin', require('./routes/admin'));

// ── Admin HTML routes (auth-gated) ─────────────────────────────────────────

// Redirect direct file access back through the auth-gated route
app.get('/admin/index.html', (req, res) => res.redirect(301, '/admin'));
app.get('/admin/login.html', (req, res) => res.redirect(301, '/admin/login'));

app.get('/admin/login', (req, res) => {
  if (req.session.userId) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.userId) return res.redirect('/admin/login');
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// Serve admin CSS/JS without auth (they contain no sensitive data)
app.use('/admin', express.static(path.join(__dirname, 'admin'), { index: false }));

// ── Public static files ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), { index: false }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nJoelle's Lounge is running!`);
  console.log(`  Public site : http://localhost:${PORT}`);
  console.log(`  Admin panel : http://localhost:${PORT}/admin\n`);
});
