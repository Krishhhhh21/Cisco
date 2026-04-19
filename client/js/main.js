/* ══════════════════════════════════════════════════════════
   PACKETVAULT — Main Workspace JavaScript
   User-facing: file list, download, search, network canvas
══════════════════════════════════════════════════════════ */

const API = '';  // same origin
const FILES_PER_PAGE = 12;

// State
let allFiles = [];
let currentFilter = 'all';
let searchTerm = '';
let currentPage = 1;
let adminToken = localStorage.getItem('pv_admin_token');
let isAdmin = !!adminToken;

// ── DOM References ─────────────────────────────────────────────────────────
const filesList        = document.getElementById('filesList');
const fileCountBadge   = document.getElementById('fileCountBadge');
const panelSearch      = document.getElementById('panelSearch');
const filterChips      = document.querySelectorAll('.pf-chip');
const paginationBar    = document.getElementById('paginationBar');
const statusMsg        = document.getElementById('statusMsg');
const clockDisplay     = document.getElementById('clockDisplay');
const mouseX           = document.getElementById('mouseX');
const mouseY           = document.getElementById('mouseY');
const dropZoneOverlay  = document.getElementById('dropZoneOverlay');
const toastContainer   = document.getElementById('toastContainer');
const canvasEl         = document.getElementById('networkCanvas');
const statusTime       = document.getElementById('statusTime');
const runBtn           = document.getElementById('runBtn');
const tbSearchInput    = document.getElementById('tbSearchInput');

// ── Clock ──────────────────────────────────────────────────────────────────
let startTime = Date.now();
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  if (clockDisplay) clockDisplay.textContent = `${h}:${m}:${s}`;

  // Session uptime for status bar
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const eh = String(Math.floor(elapsed / 3600)).padStart(2,'0');
  const em = String(Math.floor((elapsed % 3600) / 60)).padStart(2,'0');
  const es = String(elapsed % 60).padStart(2,'0');
  if (statusTime) statusTime.textContent = `${eh}:${em}:${es}`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Mouse coords on canvas ─────────────────────────────────────────────────
const canvasArea = document.querySelector('.pt-canvas-area');
if (canvasArea) {
  canvasArea.addEventListener('mousemove', (e) => {
    const rect = canvasArea.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    if (mouseX) mouseX.textContent = x;
    if (mouseY) mouseY.textContent = y;
    const coord = document.getElementById('coordDisplay');
    if (coord) coord.textContent = `x: ${x}, y: ${y}`;
  });
}

// ── Network Canvas (blank white workspace) ────────────────────────────────
(function initNetworkCanvas() {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');

  function drawBlank() {
    canvasEl.width  = canvasEl.parentElement.clientWidth;
    canvasEl.height = canvasEl.parentElement.clientHeight - 14;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
  }

  drawBlank();
  window.addEventListener('resize', drawBlank);
})();

// ── File Type Helpers ──────────────────────────────────────────────────────
function getFileIcon(ext) {
  const icons = { '.pkt': '🔌', '.html': '🌐', '.js': '⚡', '.txt': '📄', '.zip': '📦' };
  return icons[ext] || '📁';
}
function getFileClass(ext) {
  const classes = { '.pkt': 'ft-pkt', '.html': 'ft-html', '.js': 'ft-js', '.txt': 'ft-txt', '.zip': 'ft-zip' };
  return classes[ext] || '';
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Fetch & Render Files ───────────────────────────────────────────────────
async function fetchFiles() {
  try {
    setStatus('Fetching files from server...', 'info');
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (currentFilter !== 'all') params.set('ext', currentFilter);

    const res = await fetch(`${API}/files?${params.toString()}`);
    if (!res.ok) throw new Error('Server error');
    allFiles = await res.json();
    currentPage = 1;
    renderFiles();
    setStatus(`Ready — ${allFiles.length} file(s) available`, '');
  } catch (err) {
    setStatus('Connection error. Is the server running?', 'error');
    renderError();
  }
}

function renderFiles() {
  const start = (currentPage - 1) * FILES_PER_PAGE;
  const page  = allFiles.slice(start, start + FILES_PER_PAGE);

  if (fileCountBadge) fileCountBadge.textContent = allFiles.length;

  if (!allFiles.length) {
    filesList.innerHTML = `
      <div class="pf-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 7h18M3 12h18M3 17h18"/>
        </svg>
        <div>No files available yet.<br/>Ask the admin to upload lab files.</div>
      </div>`;
    paginationBar.innerHTML = '';
    return;
  }

  filesList.innerHTML = page.map(f => {
    const safeName = f.originalName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
    <div class="file-card">
      <div class="fc-icon ${getFileClass(f.ext)}">${getFileIcon(f.ext)}</div>
      <div class="fc-meta">
        <div class="fc-name" title="${f.originalName}">${f.originalName}</div>
        <div class="fc-info">
          <span>${formatBytes(f.size)}</span>
          <span>${formatDate(f.uploadedAt)}</span>
        </div>
      </div>
      <div class="fc-actions">
        <button class="fc-dl-btn" onclick="downloadFile('${f._id}','${safeName}')" title="Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
          </svg>
        </button>
        <div class="fc-dl-count">${f.downloadCount} ↓</div>
      </div>
    </div>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.ceil(allFiles.length / FILES_PER_PAGE);
  if (totalPages <= 1) { paginationBar.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pg-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }
  paginationBar.innerHTML = html;
}

function goPage(n) { currentPage = n; renderFiles(); }

function renderError() {
  filesList.innerHTML = `<div class="pf-empty"><div style="color:#f06060">⚠ Unable to reach server.</div></div>`;
}

// ── Download ───────────────────────────────────────────────────────────────
async function downloadFile(id, name) {
  setStatus(`Downloading: ${name}...`, 'info');
  try {
    const res = await fetch(`${API}/download/${id}`);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a);
    a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${name}`, 'success');
    setStatus(`Download complete: ${name}`, '');
    setTimeout(fetchFiles, 800);
  } catch (err) {
    showToast('Download failed', 'error');
    setStatus('Download failed', 'error');
  }
}

// ── Search & Filter ────────────────────────────────────────────────────────
if (panelSearch) {
  panelSearch.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    debounce(fetchFiles, 350)();
  });
}
if (tbSearchInput) {
  tbSearchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    if (panelSearch) panelSearch.value = searchTerm;
    debounce(fetchFiles, 350)();
  });
}

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.ext;
    fetchFiles();
  });
});

// ── Upload Modal (admin only) ──────────────────────────────────────────────
const uploadModalBackdrop = document.getElementById('uploadModalBackdrop');
const loginModalBackdrop  = document.getElementById('loginModalBackdrop');

document.getElementById('btnUpload')?.addEventListener('click', () => {
  if (!isAdmin) {
    loginModalBackdrop?.classList.add('open');
  } else {
    uploadModalBackdrop?.classList.add('open');
  }
});

document.getElementById('btnRefresh')?.addEventListener('click', fetchFiles);

// Close modals
document.getElementById('closeUploadModal')?.addEventListener('click', () => {
  uploadModalBackdrop?.classList.remove('open');
});
document.getElementById('closeLoginModal')?.addEventListener('click', () => {
  loginModalBackdrop?.classList.remove('open');
});
uploadModalBackdrop?.addEventListener('click', (e) => {
  if (e.target === uploadModalBackdrop) uploadModalBackdrop.classList.remove('open');
});
loginModalBackdrop?.addEventListener('click', (e) => {
  if (e.target === loginModalBackdrop) loginModalBackdrop.classList.remove('open');
});

// Drop Zone
const modalDropZone  = document.getElementById('modalDropZone');
const modalFileInput = document.getElementById('modalFileInput');
const modalUploadQueue = document.getElementById('modalUploadQueue');

modalDropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  modalDropZone.classList.add('drag-over');
});
modalDropZone?.addEventListener('dragleave', () => modalDropZone.classList.remove('drag-over'));
modalDropZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  modalDropZone.classList.remove('drag-over');
  addFilesToQueue([...e.dataTransfer.files]);
});
document.getElementById('modalBrowseBtn')?.addEventListener('click', () => modalFileInput?.click());
modalFileInput?.addEventListener('change', () => {
  addFilesToQueue([...modalFileInput.files]);
  modalFileInput.value = '';
});

// Canvas drag-drop (admin)
const dropZoneOverlayEl = document.getElementById('dropZoneOverlay');
canvasArea?.addEventListener('dragover', (e) => {
  if (!isAdmin) return;
  e.preventDefault();
  dropZoneOverlayEl?.classList.add('active');
});
canvasArea?.addEventListener('dragleave', () => dropZoneOverlayEl?.classList.remove('active'));
canvasArea?.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZoneOverlayEl?.classList.remove('active');
  if (!isAdmin) { showToast('Admin login required to upload', 'error'); return; }
  addFilesToQueue([...e.dataTransfer.files]);
  uploadModalBackdrop?.classList.add('open');
});

let queueItems = [];
function addFilesToQueue(files) {
  const ALLOWED = ['.pkt', '.html', '.js', '.txt', '.zip'];
  files.forEach(f => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      showToast(`Skipped: ${f.name} (type not allowed)`, 'error'); return;
    }
    if (f.size > 20 * 1024 * 1024) {
      showToast(`Skipped: ${f.name} (exceeds 20MB)`, 'error'); return;
    }
    queueItems.push({ file: f, status: 'pending', progress: 0 });
  });
  renderUploadQueue();
  const uploadBtn = document.getElementById('btnUploadNow');
  if (uploadBtn) uploadBtn.disabled = queueItems.length === 0;
}

function renderUploadQueue() {
  if (!modalUploadQueue) return;
  if (!queueItems.length) { modalUploadQueue.innerHTML = ''; return; }

  modalUploadQueue.innerHTML = queueItems.map((item, i) => `
    <div class="queue-item" id="qi-${i}">
      <div class="qi-top">
        <span class="qi-icon">${getFileIcon('.' + item.file.name.split('.').pop().toLowerCase())}</span>
        <span class="qi-name">${item.file.name}</span>
        <span class="qi-size">${formatBytes(item.file.size)}</span>
      </div>
      <div class="progress-wrap">
        <div class="progress-fill" style="width:${item.progress}%"></div>
      </div>
      <div class="qi-status ${item.status}">${
        item.status === 'pending'   ? 'Pending' :
        item.status === 'uploading' ? 'Uploading...' :
        item.status === 'done'      ? '✓ Done' :
        item.status === 'error'     ? '✗ Failed' : ''
      }</div>
    </div>`).join('');
}

document.getElementById('btnUploadNow')?.addEventListener('click', async () => {
  if (!queueItems.length) return;
  const form = new FormData();
  queueItems.forEach(item => { if (item.status === 'pending') form.append('files', item.file); });

  queueItems.forEach(item => { if (item.status === 'pending') item.status = 'uploading'; });
  renderUploadQueue();

  try {
    const res = await fetch(`${API}/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    queueItems.forEach(item => { item.status = 'done'; item.progress = 100; });
    renderUploadQueue();
    showToast(data.message, 'success');
    setStatus(data.message, '');
    setTimeout(() => {
      queueItems = [];
      renderUploadQueue();
      uploadModalBackdrop?.classList.remove('open');
      fetchFiles();
    }, 1500);
  } catch (err) {
    queueItems.forEach(item => { if (item.status === 'uploading') item.status = 'error'; });
    renderUploadQueue();
    showToast(err.message, 'error');
    if (err.message.includes('token') || err.message.includes('denied')) {
      isAdmin = false; adminToken = null; localStorage.removeItem('pv_admin_token');
      uploadModalBackdrop?.classList.remove('open');
      loginModalBackdrop?.classList.add('open');
    }
  }
});

document.getElementById('btnCancelUpload')?.addEventListener('click', () => {
  queueItems = [];
  renderUploadQueue();
  uploadModalBackdrop?.classList.remove('open');
});

// ── Admin Login Modal (from workspace) ────────────────────────────────────
document.getElementById('loginFormWs')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('wsUsername').value.trim();
  const password = document.getElementById('wsPassword').value;
  const errEl    = document.getElementById('wsLoginError');
  errEl.textContent = '';

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed'; return; }
    adminToken = data.token;
    isAdmin = true;
    localStorage.setItem('pv_admin_token', adminToken);
    loginModalBackdrop?.classList.remove('open');
    showToast(`Logged in as ${data.username}`, 'success');
    setStatus(`Admin session active — ${data.username}`, 'success');
    document.getElementById('btnUpload')?.classList.add('primary');
  } catch {
    errEl.textContent = 'Connection error';
  }
});

// ── Status Bar ─────────────────────────────────────────────────────────────
function setStatus(msg, type) {
  if (!statusMsg) return;
  statusMsg.textContent = msg;
  statusMsg.className = 'status-message' + (type ? ` ${type}` : '');
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span style="font-size:14px">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

// ── Debounce ───────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Admin badge check ──────────────────────────────────────────────────────
(async function checkAdminToken() {
  if (!adminToken) return;
  try {
    const res = await fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.ok) {
      isAdmin = true;
      document.getElementById('btnUpload')?.classList.add('primary');
      setStatus('Admin session active', 'success');
    } else {
      isAdmin = false;
      adminToken = null;
      localStorage.removeItem('pv_admin_token');
    }
  } catch { /* offline, keep token for now */ }
})();

// ── Toolbar type filter ────────────────────────────────────────────────────
document.getElementById('tbTypeFilter')?.addEventListener('change', (e) => {
  currentFilter = e.target.value;
  filterChips.forEach(c => {
    c.classList.toggle('active', c.dataset.ext === currentFilter);
  });
  fetchFiles();
});

// ── Auto-refresh every 30s ─────────────────────────────────────────────────
setInterval(fetchFiles, 30000);

// ── Init ───────────────────────────────────────────────────────────────────
fetchFiles();
