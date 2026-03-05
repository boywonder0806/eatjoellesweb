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

// ── Menu tabs (built dynamically by renderMenu) ────────────────────────────

// ── Contact form ───────────────────────────────
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn  = contactForm.querySelector('button[type="submit"]');
    const note = document.getElementById('contactNote');
    btn.disabled    = true;
    btn.textContent = 'Sending…';
    note.textContent = '';

    const fd  = new FormData(contactForm);
    const res = await fetch('/api/contact', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(Object.fromEntries(fd))
    });

    if (res.ok) {
      note.style.color = 'var(--color-gold)';
      note.textContent = '✓ Message sent! We\'ll be in touch soon.';
      contactForm.reset();
    } else {
      note.style.color = '#ef4444';
      note.textContent = 'Something went wrong. Please try again.';
    }
    btn.disabled    = false;
    btn.textContent = 'Send Message';
  });
}

// ── Scroll Reveal ─────────────────────────────
const staggerDelays = ['', 'delay-1', 'delay-2', 'delay-3', 'delay-4', 'delay-5'];

const revealObserver = window.__revealObserver = new IntersectionObserver((entries) => {
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

// panels are built dynamically by renderMenu()

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
    renderOpenStatus(hoursData, settings.closure);
  } catch {
    // Server unavailable — page stays with whatever is in the HTML
  }
}

function renderDietaryTags(dietary) {
  if (!dietary || dietary.length === 0) return '';
  const labels = { gf: 'GF', v: 'V', vg: 'VG', spicy: '🌶 Spicy', nuts: '⚠ Nuts' };
  const tags = dietary.map(d =>
    '<span class="menu__tag menu__tag--' + escHtml(d) + '">' + (labels[d] || escHtml(d)) + '</span>'
  ).join('');
  return '<div class="menu__item-tags">' + tags + '</div>';
}

function renderMenu(data) {
  const { categories = [], grouped = {} } = data;
  const tabsEl   = document.getElementById('menuTabs');
  const panelsEl = document.getElementById('menuPanels');
  if (!tabsEl || !panelsEl) return;

  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Build tabs
  tabsEl.innerHTML = categories.map((cat, i) =>
    `<button class="menu__tab${i === 0 ? ' active' : ''}" data-tab="${cat}">${capitalize(cat)}</button>`
  ).join('');

  // Build panels + item cards
  panelsEl.innerHTML = categories.map((cat, i) => {
    const items = grouped[cat] || [];
    return `
      <div class="menu__panel${i === 0 ? ' active' : ''}" id="tab-${cat}">
        <div class="menu__grid" id="grid-${cat}">
          ${items.map(item => `
            <div class="menu__item${item.available === false ? ' menu__item--unavailable' : ''}">
              ${item.available === false ? `
                <div class="menu__unavailable-overlay">
                  <span>Temporarily Unavailable</span>
                  <small>We&rsquo;ll have this back soon!</small>
                </div>` : ''}
              ${item.image ? `<img class="menu__item-img" src="/uploads/menu/${escHtml(item.image)}" alt="${escHtml(item.name)}" loading="lazy">` : ''}
              <div class="menu__item-body">
                <div class="menu__item-info">
                  <h3>${escHtml(item.name)}</h3>
                  ${item.description ? `<p>${escHtml(item.description)}</p>` : ''}
                </div>
                <span class="menu__price">${escHtml(item.price)}</span>
              </div>
              ${renderDietaryTags(item.dietary)}
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  // Tab click handler (event delegation)
  tabsEl.addEventListener('click', e => {
    const tab = e.target.closest('.menu__tab');
    if (!tab) return;
    tabsEl.querySelectorAll('.menu__tab').forEach(t => t.classList.remove('active'));
    panelsEl.querySelectorAll('.menu__panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('tab-' + tab.dataset.tab);
    if (panel) panel.classList.add('active');
  });

  // Scroll-reveal on new items
  categories.forEach(cat => {
    const grid = document.getElementById('grid-' + cat);
    if (grid) observeNewItems(grid);
  });
}

const _DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function _parseTimeToMin(str) {
  const m = str.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ap  = m[3].toUpperCase();
  if (ap === 'AM' && h === 12) h = 0;
  if (ap === 'PM' && h !== 12) h += 12;
  return h * 60 + min;
}

function _getOpenStatus(hoursData) {
  const todayRow = hoursData.find(r => _rowMatchesToday(r.days));
  if (!todayRow) return { isOpen: false, todayRow: null };

  const parts = (todayRow.time_range || '').split(/\s*[-–—]\s*/);
  if (parts.length < 2) return { isOpen: false, todayRow };

  const openMin  = _parseTimeToMin(parts[0]);
  const closeMin = _parseTimeToMin(parts[1]);
  if (openMin === null || closeMin === null) return { isOpen: false, todayRow };

  // Current time in CST minutes since midnight
  const cstStr = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false
  });
  const [ch, cm] = cstStr.split(':').map(Number);
  const nowMin = ch * 60 + cm;

  // Normalise close for cross-midnight ranges (e.g. 10 PM – 2 AM)
  const effectiveClose = closeMin <= openMin ? closeMin + 24 * 60 : closeMin;
  const effectiveNow   = nowMin < openMin && closeMin <= openMin ? nowMin + 24 * 60 : nowMin;

  const isOpen      = effectiveNow >= openMin && effectiveNow < effectiveClose;
  const closingSoon = isOpen  && (effectiveClose - effectiveNow) <= 30;
  const openingSoon = !isOpen && (openMin - effectiveNow) >= 0 && (openMin - effectiveNow) <= 30;

  return { isOpen, closingSoon, openingSoon, openMin, closeMin: effectiveClose, todayRow };
}

function _fmtMin(min) {
  const h  = Math.floor(min % (24 * 60) / 60);
  const m  = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ap}` : `${h12}:${String(m).padStart(2,'0')} ${ap}`;
}

const _CLOSURE_LABELS = {
  power_outage:     'Power Outage',
  weather:          'Severe Weather',
  family_emergency: 'Family Emergency',
  staff_emergency:  'Emergency',
  private_event:    'Private Event',
  maintenance:      'Maintenance',
  holiday:          'Holiday',
  other:            'Temporarily Closed'
};

function renderOpenStatus(hoursData, closure) {
  // Temporary closure overrides everything
  if (closure && closure.active) {
    const heroStatus = document.getElementById('heroStatus');
    const heroBadge  = document.getElementById('heroStatusBadge');
    const heroHours  = document.getElementById('heroStatusHours');
    const hoursBar   = document.getElementById('hoursStatusBar');
    const hoursBadge = document.getElementById('hoursStatusBadge');
    const hoursText  = document.getElementById('hoursStatusText');
    const label      = _CLOSURE_LABELS[closure.reason] || 'Temporarily Closed';

    if (heroStatus) {
      heroBadge.textContent    = 'Temporarily Closed';
      heroBadge.className      = 'hero__status-badge hero__status-badge--closed';
      heroHours.textContent    = closure.message || label;
      heroStatus.style.display = '';
    }
    if (hoursBar) {
      hoursBadge.textContent = 'Temporarily Closed';
      hoursBadge.className   = 'hours__status-pill hours__status-pill--closed';
      hoursText.textContent  = closure.message || label;
      hoursBar.style.display = '';
    }
    return;
  }

  const { isOpen, closingSoon, openingSoon, openMin, closeMin, todayRow } = _getOpenStatus(hoursData);

  // Hero badge
  const heroStatus = document.getElementById('heroStatus');
  const heroBadge  = document.getElementById('heroStatusBadge');
  const heroHours  = document.getElementById('heroStatusHours');

  // Hours section bar
  const hoursBar    = document.getElementById('hoursStatusBar');
  const hoursBadge  = document.getElementById('hoursStatusBadge');
  const hoursText   = document.getElementById('hoursStatusText');

  if (!heroStatus) return;

  if (!todayRow) {
    // No entry for today — closed
    heroBadge.textContent    = 'Closed Today';
    heroBadge.className      = 'hero__status-badge hero__status-badge--closed';
    heroHours.textContent    = '';
    heroStatus.style.display = '';
    if (hoursBar) {
      hoursBadge.textContent    = 'Closed Today';
      hoursBadge.className      = 'hours__status-pill hours__status-pill--closed';
      hoursText.textContent     = '';
      hoursBar.style.display    = '';
    }
    return;
  }

  const timeLabel = todayRow.time_range;

  if (isOpen && closingSoon) {
    heroBadge.textContent = 'Closing Soon';
    heroBadge.className   = 'hero__status-badge hero__status-badge--soon';
    heroHours.textContent = closeMin !== null ? `Closes at ${_fmtMin(closeMin)}` : timeLabel;
    if (hoursBar) {
      hoursBadge.textContent = 'Closing Soon';
      hoursBadge.className   = 'hours__status-pill hours__status-pill--soon';
      hoursText.textContent  = `Today: ${timeLabel}`;
    }
  } else if (isOpen) {
    heroBadge.textContent = 'Open Now';
    heroBadge.className   = 'hero__status-badge hero__status-badge--open';
    heroHours.textContent = closeMin !== null ? `Closes at ${_fmtMin(closeMin)}` : timeLabel;
    if (hoursBar) {
      hoursBadge.textContent = 'Open Now';
      hoursBadge.className   = 'hours__status-pill hours__status-pill--open';
      hoursText.textContent  = `Today: ${timeLabel}`;
    }
  } else if (openingSoon) {
    heroBadge.textContent = 'Opening Soon';
    heroBadge.className   = 'hero__status-badge hero__status-badge--opening';
    heroHours.textContent = openMin !== null ? `Opens at ${_fmtMin(openMin)}` : timeLabel;
    if (hoursBar) {
      hoursBadge.textContent = 'Opening Soon';
      hoursBadge.className   = 'hours__status-pill hours__status-pill--opening';
      hoursText.textContent  = `Today: ${timeLabel}`;
    }
  } else {
    heroBadge.textContent = 'Closed Now';
    heroBadge.className   = 'hero__status-badge hero__status-badge--closed';
    heroHours.textContent = openMin !== null ? `Opens at ${_fmtMin(openMin)}` : timeLabel;
    if (hoursBar) {
      hoursBadge.textContent = 'Closed Now';
      hoursBadge.className   = 'hours__status-pill hours__status-pill--closed';
      hoursText.textContent  = `Today: ${timeLabel}`;
    }
  }

  heroStatus.style.display = '';
  if (hoursBar) hoursBar.style.display = '';
}

function _rowMatchesToday(daysStr) {
  const today    = _DAY_NAMES[new Date().getDay()];
  const s        = daysStr.trim();
  const todayIdx = _DAY_NAMES.indexOf(today);

  // Direct / comma-separated match
  const parts = s.split(/,\s*/);
  if (parts.some(p => _DAY_NAMES.findIndex(d => d.toLowerCase().startsWith(p.trim().toLowerCase())) === todayIdx)) return true;

  // Range: "Monday - Friday" or "Monday – Friday"
  const rangeMatch = s.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (rangeMatch) {
    const startIdx = _DAY_NAMES.findIndex(d => d.toLowerCase().startsWith(rangeMatch[1].trim().toLowerCase()));
    const endIdx   = _DAY_NAMES.findIndex(d => d.toLowerCase().startsWith(rangeMatch[2].trim().toLowerCase()));
    if (startIdx >= 0 && endIdx >= 0) {
      return startIdx <= endIdx
        ? todayIdx >= startIdx && todayIdx <= endIdx
        : todayIdx >= startIdx || todayIdx <= endIdx; // wraps week (e.g. Fri–Mon)
    }
  }
  return false;
}

function renderHours(rows) {
  const table = document.getElementById('hours-table');
  if (!table) return;
  table.innerHTML = rows.map(row => {
    const todayClass = _rowMatchesToday(row.days) ? ' hours__row--today' : '';
    return `
    <div class="hours__row${todayClass} reveal">
      <span>${escHtml(row.days)}</span>
      <span>${escHtml(row.time_range)}</span>
    </div>`;
  }).join('');
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

  // Announcement banner
  const banner     = document.getElementById('siteBanner');
  const bannerText = document.getElementById('siteBannerText');
  if (!banner || !bannerText) return;

  const dismissable   = data.banner_dismissable !== false; // default true
  const dismissedText = sessionStorage.getItem('bannerDismissedText');
  const dismissed     = dismissable && dismissedText === data.banner_text;
  const closeBtn      = document.getElementById('siteBannerClose');
  if (closeBtn) closeBtn.style.display = dismissable ? '' : 'none';

  if (data.banner_enabled && data.banner_text && !dismissed) {
    bannerText.textContent = data.banner_text;
    banner.className = 'site-banner site-banner--' + (data.banner_type || 'info');
    document.body.classList.add('has-banner');
  } else {
    banner.classList.add('hidden');
    document.body.classList.remove('has-banner');
  }
}

document.getElementById('siteBannerClose')?.addEventListener('click', () => {
  const banner = document.getElementById('siteBanner');
  if (!banner) return;
  // Store the exact text so only THIS message is dismissed; a new message will show again
  sessionStorage.setItem('bannerDismissedText', document.getElementById('siteBannerText').textContent);
  document.body.classList.remove('has-banner'); // nav slides up immediately
  banner.classList.add('site-banner--dismissing');
  banner.addEventListener('animationend', () => {
    banner.classList.add('hidden');
    banner.classList.remove('site-banner--dismissing');
  }, { once: true });
});

loadSiteData();
