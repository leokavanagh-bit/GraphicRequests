'use strict';

let currentFilter  = 'all';
let searchQuery    = '';
let popup          = null;
let pmFilterActive = false;
let artistFilter   = '';

// ── Filtering ─────────────────────────────────────────────────────────────────

function filterRequests(requests) {
  const today = todayStr();
  const yest  = yesterdayStr();
  switch (currentFilter) {
    case 'today':     return requests.filter(r => r.requiredDate === today);
    case 'yesterday': return requests.filter(r => r.requiredDate === yest);
    case 'all':
    default: {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 14);
      const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth()+1)}-${pad(cutoff.getDate())}`;
      return requests.filter(r => {
        const col = getColumnForStatus(r.status);
        if (col !== 'Approved') return true;
        return !r.requiredDate || r.requiredDate >= cutoffStr;
      });
    }
  }
}

function matchesPMFilter(r) {
  if (!pmFilterActive) return true;
  return !!(r.projectManager && r.projectManager.enabled);
}

function matchesArtistFilter(r) {
  if (!artistFilter) return true;
  return (r.artist || '') === artistFilter;
}

function matchesSearch(r) {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return (r.id          || '').toLowerCase().includes(q) ||
         (r.title       || '').toLowerCase().includes(q) ||
         (r.requestedBy || '').toLowerCase().includes(q) ||
         (r.keywords    || '').toLowerCase().includes(q) ||
         (r.market      || '').toLowerCase().includes(q) ||
         (r.show        || '').toLowerCase().includes(q);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderBoard() {
  const all      = getRequests();
  const filtered = filterRequests(all).filter(matchesSearch).filter(matchesPMFilter).filter(matchesArtistFilter);

  COLUMNS.forEach(col => {
    const colId    = 'col-' + col.replace(/\s+/g, '-').toLowerCase();
    const countId  = 'count-' + col.replace(/\s+/g, '-').toLowerCase();
    const container = document.getElementById(colId);
    const countEl   = document.getElementById(countId);
    if (!container) return;

    const cards = filtered
      .filter(r => getColumnForStatus(r.status) === col)
      .sort((a, b) => {
        const da = parseDueDateTime(a), db = parseDueDateTime(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });

    container.innerHTML = '';
    cards.forEach(req => container.appendChild(createCard(req)));
    if (countEl) countEl.textContent = cards.length;
  });
}

function createCard(request) {
  const card = document.createElement('div');
  card.className = 'request-card' + (request.urgent ? ' urgent' : '');
  card.dataset.id = request.id;

  const bg = getCardColor(request);
  card.style.cssText = `background:${bg};border:2px solid #231f20;color:#231f20;`;

  const due = parseDueDateTime(request);
  const dueLabel = due
    ? `<span class="card-due">${formatDate(request.requiredDate)}${request.dueTime ? ' · ' + request.dueTime : ''}</span>`
    : '';

  const pmBadge = (request.projectManager && request.projectManager.enabled)
    ? `<span class="card-pm-badge">Project</span>` : '';

  card.innerHTML = `
    <div class="card-id">${escapeHtml(request.id)}</div>
    <div class="card-title">${escapeHtml(request.title || 'Untitled')}</div>
    <div class="card-footer">
      ${request.graphicType ? `<span class="card-type">${escapeHtml(request.graphicType)}</span>` : ''}
      ${pmBadge}
      ${dueLabel}
    </div>
  `;

  card.addEventListener('click',      () => window.location.href = `request.html?id=${encodeURIComponent(request.id)}`);
  card.addEventListener('mouseenter', e  => showPopup(e, request));
  card.addEventListener('mouseleave', ()  => hidePopup());
  card.addEventListener('mousemove',  e  => positionPopup(e));
  return card;
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function showPopup(e, request) {
  hidePopup();
  popup = document.createElement('div');
  popup.className = 'card-popup';
  const due = request.requiredDate
    ? `${formatDate(request.requiredDate)}${request.dueTime ? ' at ' + request.dueTime : ''}`
    : null;
  popup.innerHTML = `
    <div class="popup-id">${escapeHtml(request.id)}</div>
    <div class="popup-title">${escapeHtml(request.title || 'Untitled')}</div>
    ${request.graphicType ? `<div class="popup-row"><strong>Type:</strong> ${escapeHtml(request.graphicType)}</div>` : ''}
    ${request.market      ? `<div class="popup-row"><strong>Market:</strong> ${escapeHtml(request.market)}</div>` : ''}
    ${request.show        ? `<div class="popup-row"><strong>Show:</strong> ${escapeHtml(request.show)}</div>` : ''}
    ${request.requestedBy ? `<div class="popup-row"><strong>Requested By:</strong> ${escapeHtml(request.requestedBy)}</div>` : ''}
    ${request.artist      ? `<div class="popup-row"><strong>Artist:</strong> ${escapeHtml(request.artist)}</div>` : ''}
    ${due                 ? `<div class="popup-row"><strong>Due:</strong> ${escapeHtml(due)}</div>` : ''}
    <div class="popup-divider"></div>
    <div class="popup-details-label">Details</div>
    <div class="popup-details">${escapeHtml(request.details || 'No details provided.')}</div>
  `;
  document.body.appendChild(popup);
  positionPopup(e);
}

function positionPopup(e) {
  if (!popup) return;
  const margin = 16;
  const pw = popup.offsetWidth  || 290;
  const ph = popup.offsetHeight || 200;
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  if (x + pw > window.innerWidth  - margin) x = e.clientX - pw - margin;
  if (y + ph > window.innerHeight - margin) y = e.clientY - ph - margin;
  popup.style.left = x + 'px';
  popup.style.top  = y + 'px';
}

function hidePopup() {
  if (popup) { popup.remove(); popup = null; }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Initial render fires when Firestore cache is ready
  whenCacheReady(renderBoard);

  document.getElementById('btn-all').addEventListener('click', () => {
    currentFilter = 'all'; updateFilterBtns(); renderBoard();
  });
  document.getElementById('btn-today').addEventListener('click', () => {
    currentFilter = 'today'; updateFilterBtns(); renderBoard();
  });
  document.getElementById('btn-yesterday').addEventListener('click', () => {
    currentFilter = 'yesterday'; updateFilterBtns(); renderBoard();
  });

  const search = document.getElementById('search-input');
  if (search) {
    search.addEventListener('input', () => { searchQuery = search.value; renderBoard(); });
  }

  const pmBtn = document.getElementById('btn-pm-filter');
  if (pmBtn) {
    pmBtn.addEventListener('click', () => {
      pmFilterActive = !pmFilterActive;
      pmBtn.classList.toggle('active', pmFilterActive);
      renderBoard();
    });
  }

  const artistSel = document.getElementById('artist-filter');
  if (artistSel) {
    ARTISTS.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      artistSel.appendChild(opt);
    });
    artistSel.addEventListener('change', () => {
      artistFilter = artistSel.value;
      renderBoard();
    });
  }

  setInterval(renderBoard, 60000);
});

function updateFilterBtns() {
  ['all', 'today', 'yesterday'].forEach(f => {
    const btn = document.getElementById('btn-' + f);
    if (btn) btn.classList.toggle('active', f === currentFilter);
  });
}
