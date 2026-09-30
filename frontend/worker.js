// SwachhVision Field Worker Action Portal Logic
const API_BASE = (window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.pathname.startsWith('/worker')))
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

let allTasks = [];
let activeFilter = 'ALL';
let currentResolvingIncidentId = null;
let afterFile = null;

document.addEventListener('DOMContentLoaded', () => {
  loadWorkerTasks();
});

async function loadWorkerTasks() {
  const dept = document.getElementById('dept-filter-select').value;
  const grid = document.getElementById('task-grid-container');
  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Fetching assigned civic tasks...</div>';

  try {
    let url = `${API_BASE}/incidents`;
    const params = new URLSearchParams();
    if (dept) params.append('department', dept);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load worker tasks');

    const data = await res.json();
    // Sort tasks: Critical and High first
    allTasks = data.sort((a, b) => (b.severity_score || 0) - (a.severity_score || 0));
    renderTasks();
  } catch (err) {
    console.error('Worker task error:', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #ef4444;">Error: ${err.message}</div>`;
  }
}

function setTaskFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));

  if (filter === 'ALL') document.getElementById('filter-all').classList.add('active');
  if (filter === 'ASSIGNED') document.getElementById('filter-assigned').classList.add('active');
  if (filter === 'IN_PROGRESS') document.getElementById('filter-in-progress').classList.add('active');
  if (filter === 'RESOLVED') document.getElementById('filter-resolved').classList.add('active');

  renderTasks();
}

function renderTasks() {
  const grid = document.getElementById('task-grid-container');
  grid.innerHTML = '';

  let filtered = allTasks;
  if (activeFilter !== 'ALL') {
    filtered = allTasks.filter(t => (t.status || '').toUpperCase() === activeFilter);
  }

  // Update queue badge count
  const pendingCount = allTasks.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'REPORTED'].includes((t.status || '').toUpperCase())).length;
  document.getElementById('queue-count-badge').textContent = `${pendingCount} Active`;

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No tasks matching this filter.</div>';
    return;
  }

  filtered.forEach(task => {
    const card = document.createElement('div');
    const tier = (task.severity_tier || 'MEDIUM').toLowerCase();
    card.className = `task-card card-${tier}`;

    const score = Math.round(task.severity_score || 0);
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`;
    const photoUrl = task.before_image_url || 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500';

    let actionButtonHtml = '';
    const status = (task.status || 'ASSIGNED').toUpperCase();

    if (status === 'ASSIGNED' || status === 'REPORTED') {
      actionButtonHtml = `
        <button class="btn-action-start" onclick="updateIncidentStatus(${task.id}, 'IN_PROGRESS')">
          ⚡ Start Action
        </button>
      `;
    } else if (status === 'IN_PROGRESS') {
      actionButtonHtml = `
        <button class="btn-action-resolve" onclick="openResolutionModal(${task.id}, '${task.issue_type || 'Civic Issue'}')">
          📸 Submit Resolution
        </button>
      `;
    } else {
      actionButtonHtml = `
        <div style="flex: 1; text-align: center; padding: 0.6rem; background: rgba(16, 185, 129, 0.1); color: #34d399; font-weight: 700; border-radius: 6px; font-size: 0.85rem;">
          ✓ ${status}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="task-image-wrap">
        <img src="${photoUrl}" class="task-img" alt="Issue photo" onerror="this.src='https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500'">
        <span class="task-severity-badge badge-severity severity-${tier}">
          ${(task.severity_tier || 'MEDIUM').toUpperCase()} (${score}/100)
        </span>
      </div>
      <div class="task-body">
        <div style="font-size: 0.75rem; color: #34d399; font-weight: 700; margin-bottom: 0.2rem;">#SWV-${String(task.id).padStart(5, '0')}</div>
        <div class="task-title">${formatIssueName(task.issue_type)}</div>
        <div class="task-loc">
          <span>📍</span> <span>${task.address || `${task.latitude.toFixed(4)}, ${task.longitude.toFixed(4)}`}</span>
        </div>

        <div class="task-metrics">
          <div>
            <span style="color: var(--text-muted); display: block;">Extent Score:</span>
            <strong>${task.extent_score || 3}/5</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Location Impact:</span>
            <strong>${task.location_impact_score || 3}/5</strong>
          </div>
        </div>

        <div class="task-actions">
          <a href="${navUrl}" target="_blank" rel="noopener noreferrer" class="btn-nav" title="Open GPS Navigation">
            <span>🗺️</span> Navigate
          </a>
          ${actionButtonHtml}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function formatIssueName(type) {
  if (!type) return 'Garbage Accumulation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

async function updateIncidentStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/incidents/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) throw new Error('Failed to update status');

    // Reload tasks
    await loadWorkerTasks();
  } catch (err) {
    alert(`Status update error: ${err.message}`);
  }
}

// Resolution Modal Handling
function openResolutionModal(id, issueType) {
  currentResolvingIncidentId = id;
  document.getElementById('modal-ticket-id').textContent = `#SWV-${String(id).padStart(5, '0')}`;
  document.getElementById('modal-ticket-issue').textContent = formatIssueName(issueType);
  
  const uploadGroup = document.getElementById('worker-photo-upload-group');
  if (uploadGroup) uploadGroup.style.display = 'block';

  const previewContainer = document.getElementById('after-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';

  const fileInput = document.getElementById('after-image-file');
  if (fileInput) fileInput.value = '';

  document.getElementById('resolution-notes').value = '';
  document.getElementById('resolution-modal').style.display = 'flex';
}

function closeResolutionModal() {
  document.getElementById('resolution-modal').style.display = 'none';
  currentResolvingIncidentId = null;
  afterFile = null;
}

function handleAfterImagePreview(event) {
  if (event.target.files && event.target.files[0]) {
    afterFile = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('after-preview-img').src = e.target.result;
      
      const uploadGroup = document.getElementById('worker-photo-upload-group');
      if (uploadGroup) uploadGroup.style.display = 'none';

      document.getElementById('after-preview-container').style.display = 'block';
    };
    reader.readAsDataURL(afterFile);
  }
}

function resetWorkerPhotoSelection() {
  afterFile = null;
  const fileInput = document.getElementById('after-image-file');
  if (fileInput) fileInput.value = '';

  const uploadGroup = document.getElementById('worker-photo-upload-group');
  if (uploadGroup) uploadGroup.style.display = 'block';

  const previewContainer = document.getElementById('after-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
}

async function submitResolutionProof(e) {
  e.preventDefault();
  if (!currentResolvingIncidentId) return;
  if (!afterFile) {
    alert('Please select or capture an AFTER cleanup photo.');
    return;
  }

  const btn = document.getElementById('modal-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Posting Proof...';

  try {
    const formData = new FormData();
    formData.append('image', afterFile);
    const notes = document.getElementById('resolution-notes').value.trim();
    if (notes) formData.append('notes', notes);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE}/incidents/${currentResolvingIncidentId}/resolve`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    alert(`Ticket #SWV-${String(currentResolvingIncidentId).padStart(5, '0')} has been marked VERIFIED & COMPLETED!`);
    closeResolutionModal();
    await loadWorkerTasks();
  } catch (err) {
    if (err.name === 'AbortError') {
      alert('Request timed out while uploading resolution proof.');
    } else {
      alert(`Resolution error: ${err.message}`);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>✓</span> Complete & Submit Proof';
  }
}
