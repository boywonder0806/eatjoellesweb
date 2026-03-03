const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const { readData, writeData } = require('./db/store');

const app = express();

// ── First-run setup: hash default password if not set ──────────────────────
(function init() {
  const data = readData();
  if (!data.admin.passwordHash) {
    data.admin.passwordHash = bcrypt.hashSync('joells2026', 10);
    writeData(data);
    console.log('Admin account initialised. Login: admin / joells2026');
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

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nJoell's Lounge is running!`);
  console.log(`  Public site : http://localhost:${PORT}`);
  console.log(`  Admin panel : http://localhost:${PORT}/admin\n`);
});
