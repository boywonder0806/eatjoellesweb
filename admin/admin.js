/* =============================================
   JOELL'S LOUNGE — admin.js
   ============================================= */

// ── Auth check ───────────────────────────────
fetch('/api/admin/check')
  .then(r => {
    if (!r.ok) window.location.href = '/admin/login';
    return r.json();
  })
  .then(data => {
    document.getElementById('adminUsername').textContent = data.username;
  })
  .catch(() => window.location.href = '/admin/login');

// ── Sidebar navigation ───────────────────────
document.querySelectorAll('.sidebar__link').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar__link').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  });
});

// ── Logout ───────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login';
});

// ── Helpers ──────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function showMsg(el, text, isError = false) {
  el.textContent = text;
  el.style.color = isError ? 'var(--danger-lt)' : 'var(--success)';
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// ── MENU ─────────────────────────────────────

let allMenuItems = [];
let activeCat    = 'all';

async function loadMenu() {
  const res   = await fetch('/api/admin/menu');
  allMenuItems = await res.json();
  renderMenuTable();
}

function renderMenuTable() {
  const tbody = document.getElementById('menuTbody');
  const empty = document.getElementById('menuEmpty');
  const items = activeCat === 'all'
    ? allMenuItems
    : allMenuItems.filter(i => i.category === activeCat);

  if (items.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = items.map(item => `
    <tr data-id="${item.id}">
      <td><span class="badge badge--${esc(item.category)}">${esc(item.category)}</span></td>
      <td>${esc(item.name)}</td>
      <td style="color:var(--muted)">${esc(item.description)}</td>
      <td style="color:var(--gold)">${esc(item.price)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editMenuRow(${item.id})">Edit</button>
          <button class="btn-delete" onclick="deleteMenuItem(${item.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editMenuRow(id) {
  const item = allMenuItems.find(i => i.id === id);
  if (!item) return;
  const tr = document.querySelector(`#menuTbody tr[data-id="${id}"]`);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td>
      <select data-field="category">
        ${['starters','mains','desserts','drinks'].map(c =>
          `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`
        ).join('')}
      </select>
    </td>
    <td><input data-field="name" value="${esc(item.name)}" /></td>
    <td><input data-field="description" value="${esc(item.description)}" /></td>
    <td><input data-field="price" value="${esc(item.price)}" style="width:90px" /></td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveMenuRow(${id})">Save</button>
        <button class="btn-cancel" onclick="renderMenuTable()">Cancel</button>
      </div>
    </td>
  `;
}

async function saveMenuRow(id) {
  const tr       = document.querySelector(`#menuTbody tr[data-id="${id}"]`);
  const fields   = tr.querySelectorAll('[data-field]');
  const payload  = {};
  fields.forEach(f => payload[f.dataset.field] = f.value.trim());

  const res = await fetch(`/api/admin/menu/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  if (res.ok) {
    await loadMenu();
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
  await loadMenu();
}

// Add item form
document.getElementById('addItemBtn').addEventListener('click', () => {
  document.getElementById('addItemForm').classList.remove('hidden');
  document.getElementById('addItemBtn').classList.add('hidden');
});

document.getElementById('cancelAddBtn').addEventListener('click', () => {
  document.getElementById('addItemForm').classList.add('hidden');
  document.getElementById('addItemBtn').classList.remove('hidden');
  document.getElementById('addItemForm').reset();
});

document.getElementById('addItemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const res = await fetch('/api/admin/menu', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(Object.fromEntries(fd))
  });
  if (res.ok) {
    e.target.reset();
    document.getElementById('addItemForm').classList.add('hidden');
    document.getElementById('addItemBtn').classList.remove('hidden');
    await loadMenu();
  }
});

// Category tabs
document.getElementById('catTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-tab');
  if (!btn) return;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  renderMenuTable();
});

// ── HOURS ─────────────────────────────────────

async function loadHours() {
  const res   = await fetch('/api/admin/hours');
  const hours = await res.json();
  renderHoursTable(hours);
}

function renderHoursTable(hours) {
  const tbody = document.getElementById('hoursTbody');
  tbody.innerHTML = hours.map(row => `
    <tr data-id="${row.id}">
      <td>${esc(row.days)}</td>
      <td>${esc(row.time_range)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editHoursRow(${row.id}, '${esc(row.days)}', '${esc(row.time_range)}')">Edit</button>
          <button class="btn-delete" onclick="deleteHoursRow(${row.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editHoursRow(id, days, timeRange) {
  const tr = document.querySelector(`#hoursTbody tr[data-id="${id}"]`);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input data-field="days" value="${days}" /></td>
    <td><input data-field="time_range" value="${timeRange}" /></td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveHoursRow(${id})">Save</button>
        <button class="btn-cancel" onclick="loadHours()">Cancel</button>
      </div>
    </td>
  `;
}

async function saveHoursRow(id) {
  const tr      = document.querySelector(`#hoursTbody tr[data-id="${id}"]`);
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
  fields.forEach(f => payload[f.dataset.field] = f.value.trim());

  await fetch(`/api/admin/hours/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  await loadHours();
}

async function deleteHoursRow(id) {
  if (!confirm('Delete this hours row?')) return;
  await fetch(`/api/admin/hours/${id}`, { method: 'DELETE' });
  await loadHours();
}

document.getElementById('addHoursBtn').addEventListener('click', () => {
  const tbody = document.getElementById('hoursTbody');
  const tempId = 'new-' + Date.now();
  const tr = document.createElement('tr');
  tr.dataset.id = tempId;
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input data-field="days" placeholder="e.g. Monday – Friday" /></td>
    <td><input data-field="time_range" placeholder="e.g. 5:00 PM – 10:00 PM" /></td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveNewHoursRow(this)">Save</button>
        <button class="btn-cancel" onclick="this.closest('tr').remove()">Cancel</button>
      </div>
    </td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('input').focus();
});

async function saveNewHoursRow(btn) {
  const tr      = btn.closest('tr');
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
  fields.forEach(f => payload[f.dataset.field] = f.value.trim());
  if (!payload.days || !payload.time_range) return;

  await fetch('/api/admin/hours', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  await loadHours();
}

// ── SETTINGS ──────────────────────────────────

async function loadSettings() {
  const res  = await fetch('/api/admin/settings');
  const data = await res.json();
  document.getElementById('s-address').value = data.address || '';
  document.getElementById('s-phone').value   = data.phone   || '';
  document.getElementById('s-email').value   = data.email   || '';
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const res = await fetch('/api/admin/settings', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(Object.fromEntries(fd))
  });
  const msg = document.getElementById('settingsMsg');
  if (res.ok) {
    showMsg(msg, '✓ Saved successfully');
  } else {
    showMsg(msg, '✗ Save failed', true);
  }
});

// ── Init ──────────────────────────────────────
loadMenu();
loadHours();
loadSettings();
