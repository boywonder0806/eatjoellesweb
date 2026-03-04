/* =============================================
   JOELLE'S LOUNGE — admin.js
   ============================================= */

// ── Auth check ───────────────────────────────
let currentUser = null;

fetch('/api/admin/check')
  .then(r => {
    if (!r.ok) window.location.href = '/admin/login';
    return r.json();
  })
  .then(data => {
    currentUser = data;

    document.getElementById('adminUsername').textContent = data.username;
    const avatar = document.getElementById('adminAvatar');
    if (avatar) avatar.textContent = data.username.charAt(0).toUpperCase();

    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
      roleBadge.textContent = data.role === 'admin' ? 'Admin' : 'Manager';
      roleBadge.className   = `role-badge role-badge--${data.role}`;
    }

    applyRoleGating(data.role);

    if (data.mustChangePassword) {
      showChangePwModal(true); // forced — no cancel
    }

    loadMenu();
    loadHours();
    if (data.role === 'admin') {
      loadSettings();
      loadUsers();
    }
  })
  .catch(() => window.location.href = '/admin/login');

// ── Role gating ──────────────────────────────
function applyRoleGating(role) {
  if (role !== 'admin') {
    document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.add('hidden'));
  }
}

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
  setTimeout(() => { el.textContent = ''; }, 3500);
}

// ── Change Password Modal ─────────────────────

function showChangePwModal(forced = false) {
  const modal     = document.getElementById('changePwModal');
  const cancelBtn = document.getElementById('changePwCancel');
  const sub       = document.getElementById('changePwSub');

  if (forced) {
    cancelBtn.classList.add('hidden');
    sub.textContent = 'You must set a new password before you can continue.';
  } else {
    cancelBtn.classList.remove('hidden');
    sub.textContent = 'Choose a new password for your account.';
  }

  document.getElementById('changePwError').textContent = '';
  document.getElementById('changePwForm').reset();
  modal.classList.remove('hidden');
  document.getElementById('newPassword').focus();
}

document.getElementById('changePwCancel').addEventListener('click', () => {
  document.getElementById('changePwModal').classList.add('hidden');
  document.getElementById('changePwForm').reset();
  document.getElementById('changePwError').textContent = '';
});

document.getElementById('changePwBtn').addEventListener('click', () => {
  showChangePwModal(false);
});

document.getElementById('changePwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPw  = document.getElementById('newPassword').value;
  const confPw = document.getElementById('confirmPassword').value;
  const errEl  = document.getElementById('changePwError');

  errEl.textContent = '';

  if (newPw !== confPw) { errEl.textContent = 'Passwords do not match'; return; }
  if (newPw.length < 8)  { errEl.textContent = 'Password must be at least 8 characters'; return; }

  const res = await fetch('/api/admin/change-password', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ newPassword: newPw })
  });

  if (res.ok) {
    document.getElementById('changePwModal').classList.add('hidden');
    document.getElementById('changePwForm').reset();
    if (currentUser) currentUser.mustChangePassword = false;
  } else {
    const data = await res.json();
    errEl.textContent = data.error || 'Failed to update password';
  }
});

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
  const tr      = document.querySelector(`#menuTbody tr[data-id="${id}"]`);
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
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
  const tbody  = document.getElementById('hoursTbody');
  const tempId = 'new-' + Date.now();
  const tr     = document.createElement('tr');
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

// ── USERS ─────────────────────────────────────

let allUsers = [];

async function loadUsers() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) return;
  allUsers = await res.json();
  renderUsersTable();
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTbody');
  const empty = document.getElementById('usersEmpty');

  if (!allUsers.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = allUsers.map(u => `
    <tr data-id="${u.id}">
      <td>${esc(u.username)}</td>
      <td style="color:var(--muted)">${esc(u.email)}</td>
      <td><span class="role-badge role-badge--${esc(u.role)}">${esc(u.role)}</span></td>
      <td><span class="badge badge--${u.active ? 'active' : 'inactive'}">${u.active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editUserRow(${u.id})">Edit</button>
          <button class="btn-edit" style="color:var(--muted)" onclick="resetUserPassword(${u.id})">Reset PW</button>
          <button class="btn-delete" onclick="deleteUser(${u.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editUserRow(id) {
  const user = allUsers.find(u => u.id === id);
  if (!user) return;
  const tr = document.querySelector(`#usersTbody tr[data-id="${id}"]`);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input data-field="username" value="${esc(user.username)}" /></td>
    <td><input data-field="email" type="email" value="${esc(user.email)}" /></td>
    <td>
      <select data-field="role">
        <option value="admin"   ${user.role === 'admin'   ? 'selected' : ''}>Admin</option>
        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
      </select>
    </td>
    <td>
      <select data-field="active">
        <option value="true"  ${user.active  ? 'selected' : ''}>Active</option>
        <option value="false" ${!user.active ? 'selected' : ''}>Inactive</option>
      </select>
    </td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveUserRow(${id})">Save</button>
        <button class="btn-cancel" onclick="renderUsersTable()">Cancel</button>
      </div>
    </td>
  `;
}

async function saveUserRow(id) {
  const tr      = document.querySelector(`#usersTbody tr[data-id="${id}"]`);
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
  fields.forEach(f => {
    payload[f.dataset.field] = f.dataset.field === 'active' ? f.value === 'true' : f.value.trim();
  });

  const res = await fetch(`/api/admin/users/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  if (res.ok) {
    await loadUsers();
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to save changes');
    renderUsersTable();
  }
}

async function deleteUser(id) {
  if (!confirm('Delete this user account? This cannot be undone.')) return;
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await loadUsers();
  } else {
    const data = await res.json();
    alert(data.error || 'Failed to delete user');
  }
}

async function resetUserPassword(id) {
  const tempPw = prompt('Enter a temporary password for this user.\nThey will be required to change it on next login:');
  if (!tempPw) return;
  const res = await fetch(`/api/admin/users/${id}/reset-password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ tempPassword: tempPw })
  });
  const msg = document.getElementById('usersMsg');
  if (res.ok) {
    showMsg(msg, '✓ Password reset — user must change on next login');
  } else {
    const data = await res.json();
    showMsg(msg, data.error || 'Failed to reset password', true);
  }
}

// Add user form
document.getElementById('addUserBtn').addEventListener('click', () => {
  document.getElementById('addUserForm').classList.remove('hidden');
  document.getElementById('addUserBtn').classList.add('hidden');
});

document.getElementById('cancelAddUserBtn').addEventListener('click', () => {
  document.getElementById('addUserForm').classList.add('hidden');
  document.getElementById('addUserBtn').classList.remove('hidden');
  document.getElementById('addUserForm').reset();
});

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const res = await fetch('/api/admin/users', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(Object.fromEntries(fd))
  });
  const msg = document.getElementById('usersMsg');
  if (res.ok) {
    e.target.reset();
    document.getElementById('addUserForm').classList.add('hidden');
    document.getElementById('addUserBtn').classList.remove('hidden');
    await loadUsers();
    showMsg(msg, '✓ User created — they must change password on first login');
  } else {
    const data = await res.json();
    showMsg(msg, data.error || 'Failed to create user', true);
  }
});
