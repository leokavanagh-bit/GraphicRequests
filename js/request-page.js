'use strict';

let currentRequest    = null;
let pageFiles         = [];
let deliverableImages = [];
let pendingReads      = 0;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');
  if (!id) { window.location.href = 'index.html'; return; }

  // Wait for Firestore cache before looking up the request
  whenCacheReady(() => {
    currentRequest = getRequestById(id);

    if (!currentRequest) {
      document.body.innerHTML = `
        <div style="padding:60px;text-align:center;font-family:sans-serif;">
          <h2>Request not found</h2>
          <p style="color:#888;margin:12px 0;">No request with ID: <strong>${escapeHtml(id)}</strong></p>
          <a href="index.html" style="color:#231f20;font-weight:700;">← Back to Board</a>
        </div>`;
      return;
    }

    pageFiles         = (currentRequest.files || []).slice();
    deliverableImages = ((currentRequest.deliverable || {}).images || []).slice();

    renderRequest();

    document.getElementById('status').addEventListener('change', updateColorIndicator);

    setupDropZone('dropZone', 'fileInput', false, files => {
      files.forEach(file => readFile(file, data => {
        pageFiles.push({ name: file.name, type: file.type, size: file.size, data });
        renderFiles();
      }));
    });

    setupDropZone('deliverableDropZone', 'deliverableFileInput', true, files => {
      files.forEach(file => readFile(file, data => {
        deliverableImages.push({ name: file.name, type: file.type, size: file.size, data, addedAt: new Date().toISOString() });
        renderDeliverables();
      }));
    });

    document.getElementById('btn-update').addEventListener('click', async () => {
      if (pendingReads > 0) { alert('Please wait — files are still loading.'); return; }
      const btn = document.getElementById('btn-update');
      btn.disabled    = true;
      btn.textContent = 'Saving…';
      const updated = {
        ...currentRequest,
        title:         fval('f-title'),
        storyBin:      fval('f-storyBin'),
        graphicType:   fval('f-graphicType'),
        destination:   fval('f-destination'),
        market:        fval('f-market'),
        show:          fval('f-show'),
        requestedBy:   fval('f-requestedBy'),
        email:         fval('f-email'),
        phone:         fval('f-phone'),
        requiredDate:  fval('f-requiredDate'),
        dueTime:       fval('f-dueTime'),
        estimatedTime: fval('f-estimatedTime'),
        keywords:      fval('f-keywords'),
        details:       fval('f-details'),
        status:        fval('status'),
        artist:        fval('artist'),
        files:         pageFiles.slice(),
        deliverable: {
          fileName: fval('d-fileName'),
          location: fval('d-location'),
          images:   deliverableImages.slice(),
        },
      };
      try {
        await saveRequest(updated);
        window.location.href = 'index.html';
      } catch (e) {
        btn.disabled    = false;
        btn.textContent = 'Update Request';
        console.error(e);
        alert('Failed to save. Please check your connection and try again.');
      }
    });

    document.getElementById('btn-delete').addEventListener('click', async () => {
      if (confirm(`Delete ${currentRequest.id}? This cannot be undone.`)) {
        try {
          await deleteRequest(currentRequest.id);
          window.location.href = 'index.html';
        } catch (e) {
          console.error(e);
          alert('Failed to delete. Please check your connection.');
        }
      }
    });
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fval(id) { return (document.getElementById(id) || {}).value || ''; }

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

function readFile(file, cb) {
  pendingReads++;
  const reader = new FileReader();
  reader.onload  = e => { pendingReads--; cb(e.target.result); };
  reader.onerror = ()  => { pendingReads--; };
  reader.readAsDataURL(file);
}

function setupDropZone(zoneId, inputId, imagesOnly, onFiles) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input) return;
  input.addEventListener('change', () => { onFiles(Array.from(input.files)); input.value = ''; });
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => !imagesOnly || f.type.startsWith('image/'));
    onFiles(files);
  });
  zone.addEventListener('click', () => input.click());
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderRequest() {
  const r = currentRequest;
  document.title = `${r.id} — ${r.title || 'Request'}`;

  document.getElementById('req-id').textContent    = r.id;
  document.getElementById('req-title').textContent = r.title || 'Untitled';

  populateSelect('status',        STATUS_OPTIONS, 'Set status…');
  populateSelect('artist',        ARTISTS,        'Assign artist…');
  populateSelect('f-graphicType', GRAPHIC_TYPES,  'Select type…');
  populateSelect('f-destination', DESTINATIONS,   'Select destination…');
  populateSelect('f-market',      MARKETS,        'Select market…');
  populateSelect('f-show',        SHOWS,          'Select show…');

  setVal('status',         r.status);
  setVal('artist',         r.artist);
  setVal('f-title',        r.title);
  setVal('f-storyBin',     r.storyBin);
  setVal('f-graphicType',  r.graphicType);
  setVal('f-destination',  r.destination);
  setVal('f-market',       r.market);
  setVal('f-show',         r.show);
  setVal('f-requestedBy',  r.requestedBy);
  setVal('f-email',        r.email);
  setVal('f-phone',        r.phone);
  setVal('f-requiredDate', r.requiredDate);
  setVal('f-dueTime',      r.dueTime);
  setVal('f-estimatedTime',r.estimatedTime);
  setVal('f-keywords',     r.keywords);
  setVal('f-details',      r.details);

  const d = r.deliverable || {};
  setVal('d-fileName', d.fileName);
  setVal('d-location', d.location);

  const crEl = document.getElementById('req-created');
  const upEl = document.getElementById('req-updated');
  if (crEl && r.createdAt) crEl.textContent = new Date(r.createdAt).toLocaleString();
  if (upEl && r.updatedAt) upEl.textContent = new Date(r.updatedAt).toLocaleString();

  renderFiles();
  renderDeliverables();
  updateColorIndicator();
}

function updateColorIndicator() {
  const el       = document.getElementById('card-color-indicator');
  const statusEl = document.getElementById('status');
  if (!el) return;
  const preview = { ...currentRequest, status: statusEl ? statusEl.value : currentRequest.status };
  el.style.backgroundColor = getCardColor(preview);
}

function removeFile(i) { pageFiles.splice(i, 1); renderFiles(); }

function renderFiles() {
  const list = document.getElementById('req-files');
  if (!list) return;
  if (!pageFiles.length) { list.innerHTML = '<p class="no-files">No files attached.</p>'; return; }
  list.innerHTML = pageFiles.map((f, i) => {
    const isImg = f.type && f.type.startsWith('image/');
    return `
      <div class="file-item">
        ${isImg && f.data ? `<img src="${f.data}" class="file-thumb" alt="${escapeHtml(f.name)}">` : '<span class="file-icon">📄</span>'}
        <div class="file-info">
          <span class="file-name">${escapeHtml(f.name)}</span>
          <span class="file-size">${formatFileSize(f.size)}</span>
          ${f.data ? `<a href="${f.data}" download="${escapeHtml(f.name)}" class="file-download">Download</a>` : ''}
        </div>
        <button type="button" class="file-remove" onclick="removeFile(${i})">✕</button>
      </div>`;
  }).join('');
}

function removeDeliverable(i) { deliverableImages.splice(i, 1); renderDeliverables(); }

function renderDeliverables() {
  const wrap = document.getElementById('deliverable-thumbs');
  if (!wrap) return;
  if (!deliverableImages.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = deliverableImages.map((img, i) => `
    <div class="deliverable-thumb-item">
      <img src="${img.data}" class="deliverable-thumb" alt="${escapeHtml(img.name)}">
      <div class="deliverable-thumb-name">${escapeHtml(img.name)}</div>
      <button type="button" class="file-remove deliverable-remove" onclick="removeDeliverable(${i})">✕</button>
    </div>
  `).join('');
}

function populateSelect(id, options, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
}
