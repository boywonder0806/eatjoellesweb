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

    loadMenus();
    loadHours();
    if (data.role === 'admin') {
      loadSettings();
      loadUsers();
      loadAboutPage();
      loadTeam();
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

let allMenus      = [];
let currentMenuId = null;
let allMenuItems  = [];
let activeCat     = 'all';
let menuSortCol   = null;
let menuSortDir   = 'asc';

async function loadMenus() {
  const res = await fetch('/api/admin/menus');
  if (!res.ok) return;
  allMenus = await res.json();
  renderMenuSelector();
  const active = allMenus.find(m => m.active) || allMenus[0];
  if (active) await selectMenu(active.id);
}

function renderMenuSelector() {
  const sel = document.getElementById('menuSelector');
  if (!sel) return;
  sel.innerHTML = allMenus.map(m => `
    <button class="menu-pill${m.id === currentMenuId ? ' active' : ''}" data-menu-id="${m.id}">
      ${esc(m.name)}${m.active ? ' <span class="live-badge">LIVE</span>' : ''}
    </button>
  `).join('');
}

async function selectMenu(id) {
  currentMenuId = id;
  renderMenuSelector();
  const menu    = allMenus.find(m => m.id === id);
  const isAdmin = currentUser?.role === 'admin';
  const setLiveBtn    = document.getElementById('setLiveBtn');
  const deleteMenuBtn = document.getElementById('deleteMenuBtn');
  if (setLiveBtn)    setLiveBtn.style.display    = (menu && !menu.active && isAdmin) ? '' : 'none';
  if (deleteMenuBtn) deleteMenuBtn.style.display = (allMenus.length > 1 && isAdmin)  ? '' : 'none';
  renderCategoryBar(menu);
  activeCat = 'all';
  await loadMenuItems(id);
}

function renderCategoryBar(menu) {
  const catTagsEl   = document.getElementById('catTags');
  const catTabsEl   = document.getElementById('catTabs');
  const catSelectEl = document.getElementById('addItemCategory');
  const cats        = menu ? (menu.categories || []) : [];
  const isAdmin     = currentUser?.role === 'admin';
  const cap         = s => s.charAt(0).toUpperCase() + s.slice(1);

  if (catTagsEl) {
    catTagsEl.innerHTML = cats.length
      ? cats.map(cat => `
          <span class="cat-chip">
            ${esc(cap(cat))}
            ${isAdmin ? `<button class="cat-chip__remove" onclick="removeCategory('${esc(cat)}')" title="Remove">×</button>` : ''}
          </span>`).join('')
      : '<span class="cat-empty-hint">No categories yet.</span>';
  }

  if (catTabsEl) {
    catTabsEl.innerHTML = '<button class="cat-tab active" data-cat="all">All</button>' +
      cats.map(cat => `<button class="cat-tab" data-cat="${esc(cat)}">${esc(cap(cat))}</button>`).join('');
  }

  if (catSelectEl) {
    catSelectEl.innerHTML = cats.length
      ? cats.map(cat => `<option value="${esc(cat)}">${esc(cap(cat))}</option>`).join('')
      : '<option value="" disabled selected>Add a category first</option>';
  }
}

async function loadMenuItems(menuId) {
  const res = await fetch(`/api/admin/menus/${menuId}/items`);
  if (!res.ok) return;
  allMenuItems = await res.json();
  renderMenuTable();
}

function renderMenuTable() {
  const tbody = document.getElementById('menuTbody');
  const empty = document.getElementById('menuEmpty');
  let items = activeCat === 'all'
    ? [...allMenuItems]
    : allMenuItems.filter(i => i.category === activeCat);

  // ── Sort ──────────────────────────────────────
  if (menuSortCol) {
    items.sort((a, b) => {
      let va, vb;
      if (menuSortCol === 'price') {
        const parse = s => parseFloat((s || '').replace(/[^0-9.]/g, '')) || 0;
        va = parse(a.price); vb = parse(b.price);
      } else if (menuSortCol === 'available') {
        va = a.available === false ? 1 : 0;
        vb = b.available === false ? 1 : 0;
      } else {
        va = (a[menuSortCol] || '').toLowerCase();
        vb = (b[menuSortCol] || '').toLowerCase();
      }
      if (va < vb) return menuSortDir === 'asc' ? -1 : 1;
      if (va > vb) return menuSortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }

  // ── Update sort icons ─────────────────────────
  document.querySelectorAll('#panel-menu .th-sort').forEach(th => {
    th.querySelector('.sort-icon').textContent =
      th.dataset.sort === menuSortCol ? (menuSortDir === 'asc' ? ' ▲' : ' ▼') : '';
  });

  if (items.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = items.map(item => `
    <tr data-id="${item.id}"${item.available === false ? ' style="opacity:0.6"' : ''}>
      <td><span class="badge badge--${esc(item.category)}">${esc(item.category)}</span></td>
      <td${item.available === false ? ' style="text-decoration:line-through;color:var(--muted)"' : ''}>${esc(item.name)}</td>
      <td style="color:var(--muted)">${esc(item.description)}</td>
      <td style="color:var(--gold)">${esc(item.price)}</td>
      <td>
        <button class="${item.available === false ? 'btn-toggle-unavail' : 'btn-toggle-avail'}"
                onclick="toggleMenuAvailability(${item.id})">
          ${item.available === false ? '✗ Out of Stock' : '✓ In Stock'}
        </button>
      </td>
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
  const menu = allMenus.find(m => m.id === currentMenuId);
  const cats = menu ? menu.categories : [];
  const tr   = document.querySelector(`#menuTbody tr[data-id="${id}"]`);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td>
      <select data-field="category">
        ${cats.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </td>
    <td><input data-field="name" value="${esc(item.name)}" /></td>
    <td><input data-field="description" value="${esc(item.description)}" /></td>
    <td><input data-field="price" value="${esc(item.price)}" style="width:90px" /></td>
    <td></td>
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
  const res = await fetch(`/api/admin/menus/${currentMenuId}/items/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  if (res.ok) await loadMenuItems(currentMenuId);
}

async function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  await fetch(`/api/admin/menus/${currentMenuId}/items/${id}`, { method: 'DELETE' });
  await loadMenuItems(currentMenuId);
}

async function toggleMenuAvailability(id) {
  const item = allMenuItems.find(i => i.id === id);
  if (!item) return;
  await fetch(`/api/admin/menus/${currentMenuId}/items/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ available: item.available === false })
  });
  await loadMenuItems(currentMenuId);
}

// ── Menu management ───────────────────────────

async function createMenu(name) {
  const res = await fetch('/api/admin/menus', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name })
  });
  if (res.ok) {
    const newMenu = await res.json();
    allMenus.push({ ...newMenu, active: false });
    await selectMenu(newMenu.id);
    renderMenuSelector();
  }
}

async function activateCurrentMenu() {
  if (!currentMenuId) return;
  const res = await fetch(`/api/admin/menus/${currentMenuId}/activate`, { method: 'PUT' });
  if (res.ok) {
    allMenus.forEach(m => m.active = m.id === currentMenuId);
    renderMenuSelector();
    const setLiveBtn = document.getElementById('setLiveBtn');
    if (setLiveBtn) setLiveBtn.style.display = 'none';
  }
}

async function deleteCurrentMenu() {
  const menu = allMenus.find(m => m.id === currentMenuId);
  if (!menu) return;
  if (!confirm(`Delete "${menu.name}"? All items will be permanently removed.`)) return;
  const res = await fetch(`/api/admin/menus/${currentMenuId}`, { method: 'DELETE' });
  if (res.ok) {
    allMenus      = allMenus.filter(m => m.id !== currentMenuId);
    currentMenuId = null;
    const next = allMenus.find(m => m.active) || allMenus[0];
    renderMenuSelector();
    if (next) await selectMenu(next.id);
  } else {
    const d = await res.json();
    alert(d.error || 'Cannot delete this menu');
  }
}

async function addCategory(catName) {
  catName = (catName || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!catName) return;
  const menu = allMenus.find(m => m.id === currentMenuId);
  if (!menu || menu.categories.includes(catName)) return;
  const updated = [...menu.categories, catName];
  const res = await fetch(`/api/admin/menus/${currentMenuId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ categories: updated })
  });
  if (res.ok) {
    menu.categories = updated;
    renderCategoryBar(menu);
  }
}

async function removeCategory(catName) {
  const menu = allMenus.find(m => m.id === currentMenuId);
  if (!menu) return;
  const hasItems = allMenuItems.some(i => i.category === catName);
  if (hasItems && !confirm(`"${catName}" still has items. Remove category anyway?`)) return;
  const updated = menu.categories.filter(c => c !== catName);
  const res = await fetch(`/api/admin/menus/${currentMenuId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ categories: updated })
  });
  if (res.ok) {
    menu.categories = updated;
    if (activeCat === catName) activeCat = 'all';
    renderCategoryBar(menu);
    renderMenuTable();
  }
}

// ── Add item form ─────────────────────────────

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
  const res = await fetch(`/api/admin/menus/${currentMenuId}/items`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(Object.fromEntries(fd))
  });
  if (res.ok) {
    e.target.reset();
    document.getElementById('addItemForm').classList.add('hidden');
    document.getElementById('addItemBtn').classList.remove('hidden');
    // Re-populate category select after reset
    const menu = allMenus.find(m => m.id === currentMenuId);
    if (menu) renderCategoryBar(menu);
    await loadMenuItems(currentMenuId);
  }
});

// Column sort
document.querySelector('#panel-menu .data-table thead').addEventListener('click', (e) => {
  const th = e.target.closest('.th-sort');
  if (!th) return;
  const col = th.dataset.sort;
  if (menuSortCol === col) {
    menuSortDir = menuSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    menuSortCol = col;
    menuSortDir = 'asc';
  }
  renderMenuTable();
});

// Category filter tabs (event delegation)
document.getElementById('catTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-tab');
  if (!btn) return;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCat = btn.dataset.cat;
  renderMenuTable();
});

// Menu selector pills (event delegation)
document.getElementById('menuSelector').addEventListener('click', (e) => {
  const pill = e.target.closest('.menu-pill');
  if (!pill) return;
  selectMenu(parseInt(pill.dataset.menuId, 10));
});

// New menu
document.getElementById('addMenuBtn').addEventListener('click', () => {
  const name = prompt('Enter a name for the new menu:');
  if (name && name.trim()) createMenu(name.trim());
});

// Set as Live
document.getElementById('setLiveBtn').addEventListener('click', activateCurrentMenu);

// Delete menu
document.getElementById('deleteMenuBtn').addEventListener('click', deleteCurrentMenu);

// Add category
document.getElementById('addCatBtn').addEventListener('click', () => {
  const input = document.getElementById('newCatInput');
  addCategory(input.value);
  input.value = '';
});

document.getElementById('newCatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('newCatInput');
    addCategory(input.value);
    input.value = '';
  }
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

// ── ABOUT PAGE ────────────────────────────────

async function loadAboutPage() {
  const res = await fetch('/api/admin/about-page');
  const d   = await res.json();
  document.getElementById('ap-headline').value      = d.headline       || '';
  document.getElementById('ap-tagline').value       = d.tagline        || '';
  document.getElementById('ap-overview').value      = d.overview       || '';
  document.getElementById('ap-overview-img').value  = d.overview_image || '';
}

document.getElementById('aboutPageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd  = new FormData(e.target);
  const res = await fetch('/api/admin/about-page', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(Object.fromEntries(fd))
  });
  const msg = document.getElementById('aboutPageMsg');
  if (res.ok) {
    showMsg(msg, '✓ Saved successfully');
  } else {
    showMsg(msg, '✗ Save failed', true);
  }
});

// ── TEAM MEMBERS ──────────────────────────────

let allTeam = [];

async function loadTeam() {
  const res = await fetch('/api/admin/team');
  allTeam   = await res.json();
  renderTeamTable();
}

function renderTeamTable() {
  const tbody = document.getElementById('teamTbody');
  const empty = document.getElementById('teamEmpty');

  if (!allTeam.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = allTeam.map(m => `
    <tr data-id="${m.id}">
      <td>${esc(m.name)}</td>
      <td style="color:var(--muted)">${esc(m.role)}</td>
      <td>${m.image_url
        ? `<img src="${esc(m.image_url)}" alt="${esc(m.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" onerror="this.replaceWith(document.createTextNode('—'))">`
        : '—'}</td>
      <td style="color:var(--muted);font-size:0.83rem">${esc(m.blurb).substring(0, 80)}${m.blurb.length > 80 ? '…' : ''}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit" onclick="editTeamRow(${m.id})">Edit</button>
          <button class="btn-delete" onclick="deleteTeamMember(${m.id})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editTeamRow(id) {
  const m = allTeam.find(x => x.id === id);
  if (!m) return;
  const tr = document.querySelector(`#teamTbody tr[data-id="${id}"]`);
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input data-field="name" value="${esc(m.name)}" placeholder="Full name" /></td>
    <td><input data-field="role" value="${esc(m.role)}" placeholder="e.g. Head Chef" /></td>
    <td><input data-field="image_url" value="${esc(m.image_url)}" placeholder="https://..." style="width:120px" /></td>
    <td><textarea data-field="blurb" rows="3" style="width:100%">${esc(m.blurb)}</textarea></td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveTeamRow(${id})">Save</button>
        <button class="btn-cancel" onclick="renderTeamTable()">Cancel</button>
      </div>
    </td>
  `;
}

async function saveTeamRow(id) {
  const tr      = document.querySelector(`#teamTbody tr[data-id="${id}"]`);
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
  fields.forEach(f => payload[f.dataset.field] = f.value.trim());

  const res = await fetch(`/api/admin/team/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  if (res.ok) await loadTeam();
}

async function deleteTeamMember(id) {
  if (!confirm('Remove this team member?')) return;
  await fetch(`/api/admin/team/${id}`, { method: 'DELETE' });
  await loadTeam();
}

document.getElementById('addTeamMemberBtn').addEventListener('click', () => {
  const tbody  = document.getElementById('teamTbody');
  const tempId = 'new-' + Date.now();
  const tr     = document.createElement('tr');
  tr.dataset.id = tempId;
  tr.classList.add('editing');
  tr.innerHTML = `
    <td><input data-field="name" placeholder="Full name" /></td>
    <td><input data-field="role" placeholder="e.g. Head Chef" /></td>
    <td><input data-field="image_url" placeholder="https://..." style="width:120px" /></td>
    <td><textarea data-field="blurb" rows="3" style="width:100%" placeholder="Brief bio..."></textarea></td>
    <td>
      <div class="action-btns">
        <button class="btn-save" onclick="saveNewTeamMember(this)">Save</button>
        <button class="btn-cancel" onclick="this.closest('tr').remove()">Cancel</button>
      </div>
    </td>
  `;
  document.getElementById('teamEmpty').classList.add('hidden');
  tbody.appendChild(tr);
  tr.querySelector('input').focus();
});

async function saveNewTeamMember(btn) {
  const tr      = btn.closest('tr');
  const fields  = tr.querySelectorAll('[data-field]');
  const payload = {};
  fields.forEach(f => payload[f.dataset.field] = f.value.trim());
  if (!payload.name || !payload.role) return;

  await fetch('/api/admin/team', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });
  await loadTeam();
}
