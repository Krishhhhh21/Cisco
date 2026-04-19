/* ══════════════════════════════════════════════════════════
   PACKETVAULT — Admin Panel JavaScript
══════════════════════════════════════════════════════════ */

const API =
  typeof window !== 'undefined' && window.API_URL !== undefined ? window.API_URL : '';
let adminToken = localStorage.getItem('pv_admin_token') || '';
let filesList = [];
let filterExt = 'all';
let tableSearch = '';
let queueItems = [];

// ── DOM ────────────────────────────────────────────────────────────────────
const loginPage    = document.getElementById('loginPage');
const dashboardPage= document.getElementById('dashboardPage');
const toastContainer = document.getElementById('toastContainer');

// ── On Load: Check Token ───────────────────────────────────────────────────
(async function init() {
  if (!adminToken) { showLogin(); return; }
  const ok = await verifyToken();
  if (ok) { showDashboard(); }
  else    { showLogin(); }
})();

async function verifyToken() {
  try {
    const res = await fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    return res.ok;
  } catch { return false; }
}

function showLogin() {
  loginPage.style.display = 'flex';
  dashboardPage.style.display = 'none';
}
function showDashboard() {
  loginPage.style.display = 'none';
  dashboardPage.style.display = 'flex';
  loadStats();
  loadFiles();
  loadLogs();
  setInterval(loadStats, 15000);
  setInterval(loadLogs, 30000);
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');
  errEl.textContent = '';
  btn.textContent = 'Authenticating...';
  btn.style.opacity = '0.7';

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Invalid credentials';
      btn.textContent = 'Sign In';
      btn.style.opacity = '1';
      return;
    }
    adminToken = data.token;
    localStorage.setItem('pv_admin_token', adminToken);
    document.getElementById('adminUsername').textContent = data.username;
    showDashboard();
  } catch {
    errEl.textContent = 'Connection error. Is the server running?';
  } finally {
    btn.textContent = 'Sign In';
    btn.style.opacity = '1';
  }
});

// ── LOGOUT ─────────────────────────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  adminToken = '';
  localStorage.removeItem('pv_admin_token');
  showLogin();
  showToast('Signed out', 'info');
});

// ── NAV ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const target = item.dataset.section;
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('visible'));
    document.getElementById(`section-${target}`)?.classList.add('visible');
  });
});

// ── STATS ──────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('statFiles').textContent  = data.totalFiles;
    document.getElementById('statDL').textContent     = data.totalDownloads;
    document.getElementById('statStorage').textContent= formatBytes(data.totalStorage || 0);
    document.getElementById('statTypes').textContent  = (data.typeBreakdown || []).length;

    // Type breakdown bars
    renderTypeBreakdown(data.typeBreakdown || [], data.totalFiles);
  } catch { /* server down */ }
}

function renderTypeBreakdown(breakdown, total) {
  const el = document.getElementById('typeBreakdown');
  if (!el) return;
  const colors = { '.pkt': '#00d084', '.html': '#ff7043', '.js': '#ffd54f', '.txt': '#90a8c8', '.zip': '#ce93d8' };
  if (!breakdown.length) { el.innerHTML = '<p style="color:var(--ad-dim);font-size:12px">No files yet</p>'; return; }
  el.innerHTML = breakdown.map(item => `
    <div class="tb-row">
      <div class="tb-label" style="color:${colors[item._id] || '#888'}">${item._id}</div>
      <div class="tb-bar-wrap">
        <div class="tb-bar" style="width:${total ? (item.count/total*100) : 0}%;background:${colors[item._id] || '#888'}"></div>
      </div>
      <div class="tb-count">${item.count}</div>
    </div>`).join('');
}

// ── FILES TABLE ────────────────────────────────────────────────────────────
async function loadFiles() {
  try {
    const res = await fetch(`${API}/files`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) return;
    filesList = await res.json();
    renderFilesTable();
  } catch { /* offline */ }
}

function renderFilesTable() {
  const tbody = document.getElementById('filesTableBody');
  if (!tbody) return;

  let filtered = filesList;
  if (filterExt !== 'all') filtered = filtered.filter(f => f.ext === filterExt);
  if (tableSearch) {
    const q = tableSearch.toLowerCase();
    filtered = filtered.filter(f => f.originalName.toLowerCase().includes(q));
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty">
      <div class="empty-icon">📭</div>No files found</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => `
    <tr>
      <td class="td-icon">${getFileIcon(f.ext)}</td>
      <td class="td-name">
        ${escHtml(f.originalName)}
        <span class="td-ext ${getExtClass(f.ext)}">${f.ext}</span>
      </td>
      <td class="td-size">${formatBytes(f.size)}</td>
      <td class="td-date">${formatDate(f.uploadedAt)}</td>
      <td class="td-dl">${f.downloadCount}</td>
      <td>
        <button class="btn-delete" onclick="deleteFile('${f._id}', '${escHtml(f.originalName).replace(/'/g,"\\'")}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
          Delete
        </button>
      </td>
    </tr>`).join('');
}

// Table search
document.getElementById('tableSearch')?.addEventListener('input', (e) => {
  tableSearch = e.target.value.trim();
  renderFilesTable();
});

// Table filter
document.getElementById('tableFilter')?.addEventListener('change', (e) => {
  filterExt = e.target.value;
  renderFilesTable();
});

// Delete
async function deleteFile(id, name) {
  if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;
  try {
    const res = await fetch(`${API}/admin/file/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`Deleted: ${name}`, 'success');
    await loadFiles();
    await loadStats();
  } catch (err) {
    showToast(err.message || 'Delete failed', 'error');
  }
}

// ── UPLOAD ZONE ────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const uploadInput = document.getElementById('uploadInput');

uploadZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  addFilesToQueue([...e.dataTransfer.files]);
});
uploadInput?.addEventListener('change', () => {
  addFilesToQueue([...uploadInput.files]);
  uploadInput.value = '';
});

function addFilesToQueue(files) {
  const ALLOWED = ['.pkt', '.html', '.js', '.txt', '.zip'];
  files.forEach(f => {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      showToast(`Not allowed: ${f.name} (${ext})`, 'error'); return;
    }
    if (f.size > 20 * 1024 * 1024) {
      showToast(`Too large: ${f.name} (max 20MB)`, 'error'); return;
    }
    queueItems.push({ file: f, status: 'pending', progress: 0 });
  });
  renderQueue();
  document.getElementById('btnUploadFiles').disabled = queueItems.length === 0;
}

function renderQueue() {
  const el = document.getElementById('uploadQueueList');
  if (!el) return;
  if (!queueItems.length) { el.innerHTML = ''; return; }
  el.innerHTML = queueItems.map((item, i) => `
    <div class="queue-item">
      <div class="qi-top">
        <span class="qi-icon">${getFileIcon('.' + item.file.name.split('.').pop().toLowerCase())}</span>
        <span class="qi-name">${escHtml(item.file.name)}</span>
        <span class="qi-size">${formatBytes(item.file.size)}</span>
        ${item.status === 'pending'
          ? `<button class="qi-remove" onclick="removeFromQueue(${i})" title="Remove">×</button>`
          : ''}
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" id="qpb-${i}" style="width:${item.progress}%"></div>
      </div>
      <div class="qi-status ${item.status}">${
        item.status === 'pending'   ? 'Waiting...' :
        item.status === 'uploading' ? 'Uploading...' :
        item.status === 'done'      ? '✓ Uploaded successfully' :
        item.status === 'error'     ? '✗ Upload failed' : ''
      }</div>
    </div>`).join('');
}

function removeFromQueue(i) {
  queueItems.splice(i, 1);
  renderQueue();
  document.getElementById('btnUploadFiles').disabled = queueItems.length === 0;
}

document.getElementById('btnUploadFiles')?.addEventListener('click', async () => {
  const pending = queueItems.filter(i => i.status === 'pending');
  if (!pending.length) return;

  const form = new FormData();
  pending.forEach(item => form.append('files', item.file));

  pending.forEach(item => { item.status = 'uploading'; item.progress = 0; });
  renderQueue();

  // Simulate progress (XHR for real progress)
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API}/upload`);
  xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      pending.forEach((item, i) => {
        item.progress = pct;
        const bar = document.getElementById(`qpb-${queueItems.indexOf(item)}`);
        if (bar) bar.style.width = pct + '%';
      });
    }
  });

  xhr.onload = async () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText);
      pending.forEach(item => { item.status = 'done'; item.progress = 100; });
      renderQueue();
      showToast(data.message, 'success');
      await loadFiles();
      await loadStats();
      setTimeout(() => {
        queueItems = queueItems.filter(i => i.status !== 'done');
        renderQueue();
        document.getElementById('btnUploadFiles').disabled = queueItems.length === 0;
      }, 2500);
    } else {
      const data = JSON.parse(xhr.responseText);
      pending.forEach(item => { item.status = 'error'; });
      renderQueue();
      showToast(data.error || 'Upload failed', 'error');
    }
  };

  xhr.onerror = () => {
    pending.forEach(item => { item.status = 'error'; });
    renderQueue();
    showToast('Network error during upload', 'error');
  };

  xhr.send(form);
});

document.getElementById('btnClearQueue')?.addEventListener('click', () => {
  queueItems = queueItems.filter(i => i.status !== 'pending');
  renderQueue();
  document.getElementById('btnUploadFiles').disabled = true;
});

// ── LOGS ───────────────────────────────────────────────────────────────────
async function loadLogs() {
  try {
    const res = await fetch(`${API}/admin/logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (!res.ok) return;
    const logs = await res.json();
    renderLogs(logs);
  } catch { /* offline */ }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty">
      <div class="empty-icon">📋</div>No activity yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(log => `
    <tr>
      <td><span class="action-badge ${log.action}">${
        log.action === 'upload' ? '↑ Upload' :
        log.action === 'download' ? '↓ Download' : '✕ Delete'
      }</span></td>
      <td class="td-name">${escHtml(log.fileName)}</td>
      <td class="td-size">${formatBytes(log.fileSize || 0)}</td>
      <td class="td-date" style="font-family:'Share Tech Mono',monospace">${log.ip || 'unknown'}</td>
      <td class="td-date">${formatDateTime(log.timestamp)}</td>
    </tr>`).join('');
}

document.getElementById('btnRefreshLogs')?.addEventListener('click', loadLogs);

// ── HELPERS ────────────────────────────────────────────────────────────────
function getFileIcon(ext) {
  const m = { '.pkt': '🔌', '.html': '🌐', '.js': '⚡', '.txt': '📄', '.zip': '📦' };
  return m[ext] || '📁';
}
function getExtClass(ext) {
  const m = { '.pkt': 'ft-pkt', '.html': 'ft-html', '.js': 'ft-js', '.txt': 'ft-txt', '.zip': 'ft-zip' };
  return m[ext] || '';
}
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
         date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  t.innerHTML = `<span style="font-size:15px">${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  toastContainer.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('show')); });
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 350);
  }, 4000);
}

// Make functions available globally for HTML onclick attributes
window.deleteFile = deleteFile;
window.removeFromQueue = removeFromQueue;
window.loadFiles = loadFiles;
window.loadStats = loadStats;
window.loadLogs = loadLogs;
