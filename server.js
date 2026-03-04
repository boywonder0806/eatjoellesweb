const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcryptjs');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');
const { readData, writeData } = require('./db/store');

// ── Image upload (multer) ────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads', 'menu');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const menuImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file,  cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, safe);
  }
});
const uploadMenuImage = multer({
  storage:  menuImageStorage,
  limits:   { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const app = express();
const ROLE_PERMISSION_PANELS = ['menu', 'hours', 'settings', 'about', 'messages', 'users', 'roles', 'security'];
const DEFAULT_ROLE_PERMISSIONS = Object.fromEntries(
  ROLE_PERMISSION_PANELS.map(panel => [panel, 'hidden'])
);

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

  // ── User profile fields migration ────────────────────────────────────────
  const dataP = readData();
  let profileMigrated = false;
  (dataP.users || []).forEach(u => {
    if (u.firstName     === undefined) { u.firstName     = ''; profileMigrated = true; }
    if (u.lastName      === undefined) { u.lastName      = ''; profileMigrated = true; }
    if (u.phone         === undefined) { u.phone         = ''; profileMigrated = true; }
    if (u.profilePicture === undefined) { u.profilePicture = ''; profileMigrated = true; }
  });
  if (profileMigrated) { writeData(dataP); console.log('✓ User profile fields added.'); }

  // ── Roles migration ───────────────────────────────────────────────────────
  const data2 = readData();
  if (!data2.roles) {
    data2.roles = [{
      id:          1,
      name:        'manager',
      description: 'Restaurant manager with limited admin access',
      color:       '#7b8fa1',
      permissions: {
        menu: 'full', hours: 'full',
        settings: 'view', about: 'view',
        users: 'hidden', roles: 'hidden',
        messages: 'view', security: 'hidden'
      }
    }];
    writeData(data2);
    console.log('✓ Roles system initialised.');
  } else {
    // Backfill role fields for existing installs.
    let roleMigrated = false;
    (data2.roles || []).forEach(r => {
      if (r.color === undefined) { r.color = '#9a9088'; roleMigrated = true; }
      if (!r.permissions || typeof r.permissions !== 'object') {
        r.permissions = { ...DEFAULT_ROLE_PERMISSIONS };
        roleMigrated = true;
      }
      ROLE_PERMISSION_PANELS.forEach(panel => {
        if (r.permissions[panel] === undefined) {
          r.permissions[panel] = DEFAULT_ROLE_PERMISSIONS[panel];
          roleMigrated = true;
        }
      });
    });
    if (roleMigrated) { writeData(data2); console.log('✓ Role fields migrated.'); }
  }

  // ── Messages migration ────────────────────────────────────────────────────
  const data3 = readData();
  if (!data3.messages) {
    data3.messages = [];
    writeData(data3);
    console.log('✓ Messages system initialised.');
  }

  // ── Audit log migration ───────────────────────────────────────────────────
  const data4 = readData();
  if (!data4.logs) {
    data4.logs = [];
    writeData(data4);
    console.log('✓ Audit log initialised.');
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

// ── Menu image upload ────────────────────────────────────────────────────────
app.post('/api/admin/upload/menu-image',
  (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
  },
  uploadMenuImage.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ filename: req.file.filename });
  }
);

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
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
