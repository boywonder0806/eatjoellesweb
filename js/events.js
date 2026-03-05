/* ── Events page calendar ────────────────────────────────────────────────── */
(function () {
  'use strict';

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  let _events   = [];
  let _year     = new Date().getFullYear();
  let _month    = new Date().getMonth(); // 0-based
  let _selected = null; // 'YYYY-MM-DD' or null

  // ── Fetch events ──────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('/api/events');
      _events   = await res.json();
    } catch (e) {
      _events = [];
    }
    renderCalendar();
    showUpcoming();
    attachNav();
  }

  // ── Calendar render ───────────────────────────────────────────────────────
  function renderCalendar() {
    document.getElementById('calMonthLabel').textContent =
      MONTHS[_month] + ' ' + _year;

    const container = document.getElementById('calDays');
    container.innerHTML = '';

    const todayStr  = toDateStr(new Date());
    const firstDay  = new Date(_year, _month, 1).getDay(); // 0=Sun
    const daysInMo  = new Date(_year, _month + 1, 0).getDate();

    // Event date set for quick lookup
    const eventDates = new Set(_events.map(e => e.date));

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'ev-cal__day ev-cal__day--empty';
      container.appendChild(blank);
    }

    // Day cells
    for (let d = 1; d <= daysInMo; d++) {
      const dateStr = toDateStr(new Date(_year, _month, d));
      const cell    = document.createElement('div');
      cell.className = 'ev-cal__day';
      cell.dataset.date = dateStr;

      const num = document.createElement('span');
      num.textContent = d;
      cell.appendChild(num);

      const dot = document.createElement('span');
      dot.className = 'ev-dot';
      cell.appendChild(dot);

      if (dateStr === todayStr)   cell.classList.add('ev-cal__day--today');
      if (eventDates.has(dateStr)) cell.classList.add('ev-cal__day--has-events');
      if (dateStr === _selected)  cell.classList.add('ev-cal__day--selected');

      cell.addEventListener('click', () => selectDay(dateStr));
      container.appendChild(cell);
    }
  }

  function attachNav() {
    document.getElementById('calPrev').addEventListener('click', () => {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      renderCalendar();
    });
    document.getElementById('evPanelClose').addEventListener('click', () => {
      _selected = null;
      renderCalendar();
      showUpcoming();
    });
  }

  // ── Day selection ─────────────────────────────────────────────────────────
  function selectDay(dateStr) {
    _selected = dateStr;
    renderCalendar();

    const dayEvents = _events.filter(e => e.date === dateStr);
    const label = document.getElementById('evPanelDate');
    const close = document.getElementById('evPanelClose');
    const list  = document.getElementById('evPanelList');
    const empty = document.getElementById('evPanelEmpty');

    // Format date nicely: "Saturday, March 15"
    const d = new Date(dateStr + 'T12:00:00');
    label.textContent = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    close.classList.remove('hidden');

    if (dayEvents.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = dayEvents.map(buildCard).join('');
    }
  }

  // ── Upcoming events (default state) ──────────────────────────────────────
  function showUpcoming() {
    const label = document.getElementById('evPanelDate');
    const close = document.getElementById('evPanelClose');
    const list  = document.getElementById('evPanelList');
    const empty = document.getElementById('evPanelEmpty');

    label.textContent = 'Upcoming Events';
    close.classList.add('hidden');

    const todayStr = toDateStr(new Date());
    const upcoming = _events
      .filter(e => e.date >= todayStr)
      .slice(0, 8);

    if (upcoming.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
    } else {
      empty.classList.add('hidden');
      list.innerHTML = upcoming.map(ev => {
        const d = new Date(ev.date + 'T12:00:00');
        const dateLabel = d.toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric'
        });
        return buildCard(ev, dateLabel);
      }).join('');
    }
  }

  // ── Card HTML ─────────────────────────────────────────────────────────────
  function buildCard(ev, datePrefix) {
    const timeStr = [
      datePrefix ? '<span style="opacity:0.6;margin-right:0.5rem">' + esc(datePrefix) + '</span>' : '',
      ev.startTime ? esc(ev.startTime) : '',
      ev.endTime   ? ' &ndash; ' + esc(ev.endTime) : ''
    ].join('');

    const imgEl = ev.image
      ? '<img class="ev-card__img" src="' + esc(ev.image) + '" alt="' + esc(ev.title) + '" loading="lazy" />'
      : '<div class="ev-card__img-placeholder">&#127917;</div>';

    const cancelledOverlay = ev.cancelled
      ? '<div class="ev-card__cancelled-overlay"><span class="ev-card__cancelled-label">Event Cancelled</span></div>'
      : '';

    return `
      <div class="ev-card${ev.featured ? ' ev-card--featured' : ''}${ev.cancelled ? ' ev-card--cancelled' : ''}">
        <div class="ev-card__media">
          ${imgEl}
          ${cancelledOverlay}
        </div>
        <div class="ev-card__body">
          ${ev.featured && !ev.cancelled ? '<div class="ev-card__featured-badge">&#9733; Featured</div>' : ''}
          ${ev.cancelled ? '<div class="ev-card__cancelled-badge">&#10005; Cancelled</div>' : ''}
          <div class="ev-card__title">${esc(ev.title)}</div>
          ${timeStr ? '<div class="ev-card__time">' + timeStr + '</div>' : ''}
          ${ev.description ? '<div class="ev-card__desc">' + esc(ev.description) + '</div>' : ''}
        </div>
      </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toDateStr(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  init();
})();
