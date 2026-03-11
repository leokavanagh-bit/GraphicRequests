'use strict';

let currentRequest    = null;
let pageFiles         = [];
let deliverableImages = [];
let pendingReads      = 0;
let pmTasks           = [];   // working copy of project manager tasks
let pmEnabled         = false;

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
    pmTasks           = ((currentRequest.projectManager || {}).tasks || []).map(t => ({...t}));
    pmEnabled         = !!(currentRequest.projectManager && currentRequest.projectManager.enabled);

    renderRequest();
    if (pmEnabled) openPM();

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
        urgent:        !!(document.getElementById('f-urgent') || {}).checked,
        files:         pageFiles.slice(),
        deliverable: {
          fileName: fval('d-fileName'),
          location: fval('d-location'),
          images:   deliverableImages.slice(),
        },
        projectManager: {
          enabled: pmEnabled,
          tasks:   collectPMTasks(),
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

    document.getElementById('btn-manage-project').addEventListener('click', () => {
      pmEnabled = !pmEnabled;
      if (pmEnabled) { openPM(); } else { closePM(); }
    });

    document.getElementById('pm-add-task').addEventListener('click', () => addPMTask());
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

  const urgentEl = document.getElementById('f-urgent');
  if (urgentEl) urgentEl.checked = !!r.urgent;

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

// ── Project Manager ───────────────────────────────────────────────────────────

const PM_STATUSES = ['To Do', 'In Progress', 'Pending Approval', 'Approved'];

const PM_STATUS_CLASS = {
  'To Do':            'pm-status-todo',
  'In Progress':      'pm-status-inprogress',
  'Pending Approval': 'pm-status-pending',
  'Approved':         'pm-status-approved',
};

function openPM() {
  pmEnabled = true;
  const section = document.getElementById('pm-section');
  const btn     = document.getElementById('btn-manage-project');
  if (section) section.style.display = 'block';
  if (btn)     btn.textContent = '✕ Hide Project Manager';
  renderPMTasks();
}

function closePM() {
  pmEnabled = false;
  const section = document.getElementById('pm-section');
  const btn     = document.getElementById('btn-manage-project');
  if (section) section.style.display = 'none';
  if (btn)     btn.textContent = '📋 Manage Project';
}

function syncPMFromDOM() {
  document.querySelectorAll('.pm-row').forEach((row, i) => {
    if (!pmTasks[i]) return;
    pmTasks[i].name    = row.querySelector('.pm-name').value    || '';
    pmTasks[i].status  = row.querySelector('.pm-status').value  || 'To Do';
    pmTasks[i].artist  = row.querySelector('.pm-artist').value  || '';
    pmTasks[i].dueDate = row.querySelector('.pm-date').value    || '';
  });
}

function addPMTask() {
  syncPMFromDOM();
  pmTasks.push({ id: Date.now() + Math.random(), name: '', status: 'To Do', artist: '', dueDate: '' });
  renderPMTasks();
  const rows = document.querySelectorAll('.pm-row');
  if (rows.length) {
    const lastInput = rows[rows.length - 1].querySelector('input[type="text"]');
    if (lastInput) lastInput.focus();
  }
}

function removePMTask(idx) {
  syncPMFromDOM();
  pmTasks.splice(idx, 1);
  renderPMTasks();
}

function collectPMTasks() {
  const rows = document.querySelectorAll('.pm-row');
  return Array.from(rows).map((row, i) => ({
    id:      pmTasks[i] ? pmTasks[i].id : Date.now() + i,
    name:    row.querySelector('.pm-name').value   || '',
    status:  row.querySelector('.pm-status').value || 'To Do',
    artist:  row.querySelector('.pm-artist').value || '',
    dueDate: row.querySelector('.pm-date').value   || '',
  }));
}

function renderPMTasks() {
  const container = document.getElementById('pm-tasks');
  const empty     = document.getElementById('pm-empty');
  if (!container) return;

  if (!pmTasks.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  container.innerHTML = pmTasks.map((task, i) => {
    const artistOpts = ARTISTS.map(a =>
      `<option value="${escapeHtml(a)}" ${a === task.artist ? 'selected' : ''}>${escapeHtml(a)}</option>`
    ).join('');

    const statusOpts = PM_STATUSES.map(s =>
      `<option value="${escapeHtml(s)}" ${s === task.status ? 'selected' : ''}>${escapeHtml(s)}</option>`
    ).join('');

    const statusClass = PM_STATUS_CLASS[task.status] || '';

    return `
      <div class="pm-row" data-idx="${i}">
        <div class="pm-cell">
          <input type="text" class="pm-name" value="${escapeHtml(task.name)}" placeholder="Task name…">
        </div>
        <div class="pm-cell">
          <select class="pm-status ${statusClass}" onchange="onPMStatusChange(this)">
            ${statusOpts}
          </select>
        </div>
        <div class="pm-cell">
          <select class="pm-artist">
            <option value="">Assign artist…</option>
            ${artistOpts}
          </select>
        </div>
        <div class="pm-cell">
          <input type="date" class="pm-date" value="${escapeHtml(task.dueDate || '')}">
        </div>
        <div class="pm-cell">
          <button type="button" class="pm-row-add-btn" onclick="addPMTask()" title="Add new task">+ Add Task</button>
        </div>
        <div class="pm-cell">
          <button type="button" class="pm-delete-btn" onclick="removePMTask(${i})" title="Remove task">✕</button>
        </div>
      </div>`;
  }).join('');

  // Enter key on name field adds a new row
  container.querySelectorAll('.pm-name').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addPMTask(); }
    });
  });
}

function onPMStatusChange(sel) {
  // Remove all status classes then apply the correct one
  Object.values(PM_STATUS_CLASS).forEach(c => sel.classList.remove(c));
  const cls = PM_STATUS_CLASS[sel.value];
  if (cls) sel.classList.add(cls);
}
