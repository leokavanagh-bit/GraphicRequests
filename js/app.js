'use strict';

// ── Firebase ──────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyA3bxeYrFeXht_tqOwiN6QzrbE0CMn_wMg",
  authDomain:        "gfx-request-system.firebaseapp.com",
  projectId:         "gfx-request-system",
  storageBucket:     "gfx-request-system.firebasestorage.app",
  messagingSenderId: "55828193866",
  appId:             "1:55828193866:web:0bdec879af40c50054bcb3"
};

firebase.initializeApp(firebaseConfig);
const db         = firebase.firestore();
const COLLECTION = 'requests';

// ── Local cache ───────────────────────────────────────────────────────────────
// onSnapshot keeps this in sync. Synchronous reads (getRequests, getRequestById)
// pull from here so the rest of the app needs no async changes.

let _cache          = [];
let _cacheReady     = false;
let _readyCallbacks = [];

function whenCacheReady(cb) {
  if (_cacheReady) { cb(); return; }
  _readyCallbacks.push(cb);
}

document.addEventListener('DOMContentLoaded', () => {
  db.collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snapshot => {
        _cache      = snapshot.docs.map(doc => doc.data());
        _cacheReady = true;
        // Fire one-time ready callbacks (used on first load)
        _readyCallbacks.forEach(cb => cb());
        _readyCallbacks = [];
        // Re-render live views on any subsequent change
        if (typeof renderBoard   === 'function') renderBoard();
        if (typeof renderGallery === 'function') renderGallery();
      },
      err => {
        console.error('Firestore error:', err);
        showDbError();
      }
    );
});

function showDbError() {
  const el = document.getElementById('db-error');
  if (el) el.style.display = 'block';
}

// ── Data API ──────────────────────────────────────────────────────────────────

function getRequests() {
  return _cache;
}

function getRequestById(id) {
  return _cache.find(r => r.id === id) || null;
}

async function getNextId() {
  const counterRef = db.collection('meta').doc('counter');
  return db.runTransaction(async tx => {
    const doc = await tx.get(counterRef);
    const n   = doc.exists ? doc.data().value + 1 : 1;
    tx.set(counterRef, { value: n });
    return 'REQ-' + String(n).padStart(4, '0');
  });
}

function saveRequest(request) {
  const existing = _cache.find(r => r.id === request.id);
  const ts       = new Date().toISOString();
  const data     = existing
    ? { ...existing, ...request, updatedAt: ts }
    : { ...request, createdAt: ts, updatedAt: ts };
  return db.collection(COLLECTION).doc(request.id).set(data);
}

function deleteRequest(id) {
  return db.collection(COLLECTION).doc(id).delete();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS = ['Requested', 'Assigned', 'In Progress', 'Pending Approval', 'Approved'];

const STATUS_OPTIONS = [
  'Requested', 'Assigned', 'In Progress',
  'Pending Approval', 'Changes Required', 'Approved'
];

const GRAPHIC_TYPES = [
  'Full Frame', 'Animation', 'Map', 'Special Project',
  'Xpression', 'VR Set', 'Infographic'
];

const DESTINATIONS = ['Streamline', 'GV', 'Xpression', 'File Transfer'];

const MARKETS = [
  'Vancouver', 'Toronto', 'Calgary', 'Edmonton', 'Saskatoon',
  'Regina', 'Halifax', 'New Brunswick', 'Montreal', 'Peterborough',
  'Durham', 'Kingston', 'Ottawa', 'All Markets'
];

const SHOWS = [
  'Morning', 'Noon', 'Evening', 'Late', 'Global National',
  'TWB', 'TMS', 'Radio', 'Podcast', 'Online',
  'Promo & Marketing', 'Elections', 'NND', 'Crime Beat', 'Ben Mulroney'
];

const ARTISTS = [
  'Bajaj, Sunny', 'Collins, Michael', 'Gomez, Henry',
  'Griffin, Amanda', 'Hawkins, James', 'Jadua, Laith',
  'Jeri, Chris', 'Kavanagh, Leo', 'Lapalme, Mike',
  'Meusey, Cyril', 'Miller, Andrew', 'Mutahar, Ata',
  'Nesbitt, Caroline', 'Pearson, Brad', 'Royer, Brian',
  'Sangani, Neil', 'Sharma, Deepak', 'Sieving, Fasai'
];

const QUICK_PICKS = [
  '30 Mins', '60 Mins', '90 Mins',
  '2 Hours', '3 Hours', '4 Hours',
  'Tomorrow', 'Next Week'
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function parseDueDateTime(request) {
  if (!request.requiredDate) return null;
  const [y, m, d] = request.requiredDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 23, 59, 0);
  if (request.dueTime) {
    const match = String(request.dueTime).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (match) {
      let h = parseInt(match[1]);
      const min = parseInt(match[2]);
      const ap  = match[3];
      if (ap) {
        if (ap.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (ap.toUpperCase() === 'AM' && h === 12) h = 0;
      }
      dt.setHours(h, min, 0, 0);
    }
  }
  return dt;
}

function getCardColor(request) {
  if (request.status === 'Approved')          return '#61dd33';
  if (request.status === 'Changes Required')  return '#e03232';
  const due = parseDueDateTime(request);
  if (!due) return '#ffffff';
  const mins = (due - Date.now()) / 60000;
  if (mins < 0)  return '#e88949';
  if (mins < 30) return '#eaea47';
  if (mins < 90) return '#45aded';
  return '#ffffff';
}

function getColumnForStatus(status) {
  const map = {
    'Requested':       'Requested',
    'Assigned':        'Assigned',
    'In Progress':     'In Progress',
    'Changes Required':'In Progress',
    'Pending Approval':'Pending Approval',
    'Approved':        'Approved'
  };
  return map[status] || 'Requested';
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function formatTimeFromDate(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function applyQuickPick(pick) {
  const now = new Date();
  const addMins = n => new Date(now.getTime() + n * 60000);
  const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  switch (pick) {
    case '30 Mins':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(30))  };
    case '60 Mins':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(60))  };
    case '90 Mins':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(90))  };
    case '2 Hours':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(120)) };
    case '3 Hours':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(180)) };
    case '4 Hours':  return { requiredDate: todayStr(), dueTime: formatTimeFromDate(addMins(240)) };
    case 'Tomorrow': { const t = new Date(now); t.setDate(t.getDate()+1); return { requiredDate: ds(t), dueTime: null }; }
    case 'Next Week':{ const t = new Date(now); t.setDate(t.getDate()+7); return { requiredDate: ds(t), dueTime: null }; }
    default: return { requiredDate: null, dueTime: null };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)    return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
