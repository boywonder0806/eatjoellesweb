/* =============================================
   JOELLE'S LOUNGE — main.js
   ============================================= */

// ── Nav: shrink on scroll ─────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

// ── Nav: mobile toggle + hamburger morph ──────
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', isOpen);
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ── Nav: active section highlight ─────────────
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav__links a[href^="#"]');

function updateActiveNav() {
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 140) current = section.getAttribute('id');
  });
  navAnchors.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + current);
  });
}
window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();

// ── Menu tabs ─────────────────────────────────
const tabs   = document.querySelectorAll('.menu__tab');
const panels = document.querySelectorAll('.menu__panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ── Reservation form ──────────────────────────
const dateInput = document.getElementById('date');
if (dateInput) {
  dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
}

const form = document.getElementById('reservationForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.innerHTML = `
      <div class="form__success" style="display:block">
        <p style="font-size:2rem; margin-bottom:0.5rem;">&#10003;</p>
        <p><strong>Reservation request received!</strong></p>
        <p style="margin-top:0.5rem; color: var(--color-muted); font-size:0.95rem;">
          We'll confirm your table by email within 24 hours.<br/>
          We look forward to seeing you!
        </p>
      </div>
    `;
  });
}

// ── Scroll Reveal ─────────────────────────────
const staggerDelays = ['', 'delay-1', 'delay-2', 'delay-3', 'delay-4', 'delay-5'];

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

function markReveal(selector, classes = [], stagger = false) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add('reveal', ...classes);
    if (stagger) {
      const d = staggerDelays[Math.min(i, staggerDelays.length - 1)];
      if (d) el.classList.add(d);
    }
    revealObserver.observe(el);
  });
}

function observeNewItems(container) {
  container.querySelectorAll('.menu__item').forEach((el, i) => {
    if (el.classList.contains('reveal')) return; // already registered
    el.classList.add('reveal', 'from-scale');
    const d = staggerDelays[Math.min(i, staggerDelays.length - 1)];
    if (d) el.classList.add(d);
    revealObserver.observe(el);
  });
}

// Static element reveals
markReveal('.section__label');
markReveal('.section__title',  ['delay-1']);
markReveal('.about__text p',   [], true);
markReveal('.about__image',    ['from-right', 'delay-1']);
markReveal('.hours__row',      [], true);   // re-applied after load
markReveal('.hours__address',  ['delay-3']);
markReveal('.hours__map',      ['from-right', 'delay-1']);
markReveal('.contact__sub',    ['delay-1']);
markReveal('.contact__form',   ['from-scale', 'delay-2']);
markReveal('.footer__brand',   []);
markReveal('.footer__links',   ['delay-1']);
markReveal('.footer__social',  ['delay-2']);

panels.forEach(panel => observeNewItems(panel));

// ── XSS-safe text helper ──────────────────────
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Dynamic data loading ──────────────────────
async function loadSiteData() {
  try {
    const [menuRes, hoursRes, settingsRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/hours'),
      fetch('/api/settings')
    ]);
    if (!menuRes.ok) return; // server not running — keep any static fallback

    const [menuData, hoursData, settings] = await Promise.all([
      menuRes.json(),
      hoursRes.json(),
      settingsRes.json()
    ]);

    renderMenu(menuData);
    renderHours(hoursData);
    renderSettings(settings);
  } catch {
    // Server unavailable — page stays with whatever is in the HTML
  }
}

function renderMenu(data) {
  ['starters', 'mains', 'desserts', 'drinks'].forEach(cat => {
    const grid  = document.getElementById('grid-' + cat);
    if (!grid) return;
    const items = data[cat] || [];
    grid.innerHTML = items.map(item => `
      <div class="menu__item">
        <div class="menu__item-info">
          <h3>${escHtml(item.name)}</h3>
          <p>${escHtml(item.description)}</p>
        </div>
        <span class="menu__price">${escHtml(item.price)}</span>
      </div>
    `).join('');
    observeNewItems(grid);
  });
}

function renderHours(rows) {
  const table = document.getElementById('hours-table');
  if (!table) return;
  table.innerHTML = rows.map(row => `
    <div class="hours__row reveal">
      <span>${escHtml(row.days)}</span>
      <span>${escHtml(row.time_range)}</span>
    </div>
  `).join('');
  table.querySelectorAll('.hours__row').forEach((el, i) => {
    const d = staggerDelays[Math.min(i, staggerDelays.length - 1)];
    if (d) el.classList.add(d);
    revealObserver.observe(el);
  });
}

function renderSettings(data) {
  const addr  = document.getElementById('contact-address');
  const phone = document.getElementById('contact-phone');
  const email = document.getElementById('contact-email');
  if (addr  && data.address) addr.textContent  = data.address;
  if (phone && data.phone)   phone.textContent = data.phone;
  if (email && data.email)   email.textContent = data.email;
}

loadSiteData();
