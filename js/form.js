'use strict';

let uploadedFiles = [];
let pendingReads  = 0;

document.addEventListener('DOMContentLoaded', () => {
  populateSelect('graphicType', GRAPHIC_TYPES, 'Select type…');
  populateSelect('destination',  DESTINATIONS,  'Select destination…');
  populateSelect('market',       MARKETS,       'Select market…');
  populateSelect('show',         SHOWS,         'Select show…');
  populateSelect('quickPick',    QUICK_PICKS,   'Quick Pick…');

  document.getElementById('quickPick').addEventListener('change', e => {
    const { requiredDate, dueTime } = applyQuickPick(e.target.value);
    if (requiredDate) document.getElementById('requiredDate').value = requiredDate;
    if (dueTime)      document.getElementById('dueTime').value      = dueTime;
  });

  const fileInput = document.getElementById('fileInput');
  const dropZone  = document.getElementById('dropZone');

  fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });
  dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  dropZone.addEventListener('click', () => fileInput.click());

  document.getElementById('request-form').addEventListener('submit', e => {
    e.preventDefault();
    if (pendingReads > 0) { alert('Please wait — files are still loading.'); return; }
    submitForm();
  });
});

function populateSelect(id, options, placeholder) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
}

function handleFiles(files) {
  Array.from(files).forEach(file => {
    pendingReads++;
    setSubmitState();
    const reader = new FileReader();
    reader.onload = e => {
      uploadedFiles.push({ name: file.name, type: file.type, size: file.size, data: e.target.result });
      pendingReads--;
      setSubmitState();
      renderFileList();
    };
    reader.onerror = () => { pendingReads--; setSubmitState(); };
    reader.readAsDataURL(file);
  });
}

function setSubmitState(loading) {
  const btn = document.getElementById('submit-btn');
  if (!btn) return;
  const busy = loading || pendingReads > 0;
  btn.disabled    = busy;
  btn.textContent = pendingReads > 0 ? `Loading files… (${pendingReads})` :
                    loading           ? 'Submitting…' : 'Submit Request';
}

function renderFileList() {
  const list = document.getElementById('file-list');
  list.innerHTML = uploadedFiles.map((f, i) => {
    const isImg = f.type && f.type.startsWith('image/');
    return `
      <div class="file-item">
        ${isImg && f.data ? `<img src="${f.data}" class="file-thumb" alt="${escapeHtml(f.name)}">` : '<span class="file-icon">📄</span>'}
        <div class="file-info">
          <span class="file-name">${escapeHtml(f.name)}</span>
          <span class="file-size">${formatFileSize(f.size)}</span>
        </div>
        <button type="button" class="file-remove" onclick="removeFile(${i})">✕</button>
      </div>`;
  }).join('');
}

function removeFile(i) { uploadedFiles.splice(i, 1); renderFileList(); }

function val(id) { return (document.getElementById(id) || {}).value || ''; }

async function submitForm() {
  const title = val('title');
  if (!title.trim()) {
    alert('Please enter a title for the request.');
    document.getElementById('title').focus();
    return;
  }

  setSubmitState(true);

  try {
    const id = await getNextId();
    const request = {
      id,
      title,
      storyBin:      val('storyBin'),
      graphicType:   val('graphicType'),
      destination:   val('destination'),
      market:        val('market'),
      show:          val('show'),
      requestedBy:   val('requestedBy'),
      email:         val('email'),
      phone:         val('phone'),
      requiredDate:  val('requiredDate'),
      dueTime:       val('dueTime'),
      quickPick:     val('quickPick'),
      estimatedTime: val('estimatedTime'),
      keywords:      val('keywords'),
      details:       val('details'),
      status:        'Requested',
      artist:        '',
      files:         uploadedFiles.slice(),
    };
    await saveRequest(request);
    window.location.href = 'index.html';
  } catch (e) {
    setSubmitState(false);
    console.error(e);
    alert('Failed to submit request. Please check your connection and try again.');
  }
}
