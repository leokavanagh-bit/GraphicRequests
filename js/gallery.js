'use strict';

let galFilter = 'all';
let galFrom   = '';
let galTo     = '';

document.addEventListener('DOMContentLoaded', () => {
  const to   = new Date();
  const from = new Date(); from.setDate(from.getDate() - 14);
  document.getElementById('gal-to').value   = dateStr(to);
  document.getElementById('gal-from').value = dateStr(from);
  galFrom = document.getElementById('gal-from').value;
  galTo   = document.getElementById('gal-to').value;

  document.getElementById('gal-btn-all').addEventListener('click', () => {
    galFilter = 'all';
    const to   = new Date();
    const from = new Date(); from.setDate(from.getDate() - 14);
    document.getElementById('gal-to').value   = dateStr(to);
    document.getElementById('gal-from').value = dateStr(from);
    galFrom = document.getElementById('gal-from').value;
    galTo   = document.getElementById('gal-to').value;
    updateGalBtns(); renderGallery();
  });

  document.getElementById('gal-btn-today').addEventListener('click', () => {
    galFilter = 'today';
    document.getElementById('gal-from').value = todayStr();
    document.getElementById('gal-to').value   = todayStr();
    galFrom = galTo = todayStr();
    updateGalBtns(); renderGallery();
  });

  document.getElementById('gal-btn-yesterday').addEventListener('click', () => {
    galFilter = 'yesterday';
    document.getElementById('gal-from').value = yesterdayStr();
    document.getElementById('gal-to').value   = yesterdayStr();
    galFrom = galTo = yesterdayStr();
    updateGalBtns(); renderGallery();
  });

  document.getElementById('gal-from').addEventListener('change', e => {
    galFrom = e.target.value; galFilter = 'range';
    updateGalBtns(); renderGallery();
  });

  document.getElementById('gal-to').addEventListener('change', e => {
    galTo = e.target.value; galFilter = 'range';
    updateGalBtns(); renderGallery();
  });

  // Initial render fires when Firestore cache is ready
  whenCacheReady(renderGallery);
});

function updateGalBtns() {
  ['all', 'today', 'yesterday'].forEach(f => {
    const btn = document.getElementById('gal-btn-' + f);
    if (btn) btn.classList.toggle('active', f === galFilter);
  });
}

function matchesFilter(request) {
  const reqDate = request.requiredDate || '';
  switch (galFilter) {
    case 'today':     return reqDate === todayStr();
    case 'yesterday': return reqDate === yesterdayStr();
    case 'range':
    case 'all':
    default:
      if (galFrom && reqDate && reqDate < galFrom) return false;
      if (galTo   && reqDate && reqDate > galTo)   return false;
      return true;
  }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const items = [];
  getRequests().forEach(r => {
    const d = r.deliverable;
    if (!d || !d.images || !d.images.length) return;
    if (!matchesFilter(r)) return;
    d.images.forEach(img => {
      items.push({ request: r, img, fileName: d.fileName, location: d.location });
    });
  });

  if (!items.length) {
    grid.innerHTML = '<div class="gallery-empty">No deliverables found for this date range.</div>';
    return;
  }

  grid.innerHTML = items.map(({ request: r, img, fileName, location }) => `
    <div class="gallery-item" onclick="window.location.href='request.html?id=${encodeURIComponent(r.id)}'">
      <div class="gallery-thumb-wrap">
        <img src="${img.data}" class="gallery-thumb" alt="${escapeHtml(fileName || img.name || '')}">
      </div>
      <div class="gallery-info">
        <div class="gallery-req-id">${escapeHtml(r.id)}</div>
        <div class="gallery-title">${escapeHtml(r.title || 'Untitled')}</div>
        ${fileName ? `<div class="gallery-filename">${escapeHtml(fileName)}</div>` : ''}
        ${location ? `<div class="gallery-location">${escapeHtml(location)}</div>` : ''}
        ${r.requiredDate ? `<div class="gallery-date">${formatDate(r.requiredDate)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function dateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
