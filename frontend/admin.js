// SwachhVision Admin Console Logic
const API_BASE = window.location.protocol.startsWith('http')
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';
const DEFAULT_PASSCODE = 'admin123';
const INDIA_BOUNDS = [[6.4, 68.0], [37.2, 97.5]];

let allComplaints = [];
let currentFilter = 'ALL';
let resolvingId = null;
let afterFileSelected = null;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

function checkAuth() {
  const isAuth = sessionStorage.getItem('swachh_admin_auth') === 'true';
  const authModal = document.getElementById('auth-modal');
  const mainContent = document.getElementById('admin-main-content');

  if (isAuth) {
    authModal.style.display = 'none';
    mainContent.style.display = 'block';
    loadAdminFeed();
  } else {
    authModal.style.display = 'flex';
    mainContent.style.display = 'none';
  }
}

function handlePasscodeAuth(e) {
  e.preventDefault();
  const input = document.getElementById('admin-passcode').value.trim();
  const errorMsg = document.getElementById('auth-error');

  if (input === DEFAULT_PASSCODE || input === 'swachh2026') {
    sessionStorage.setItem('swachh_admin_auth', 'true');
    errorMsg.style.display = 'none';
    checkAuth();
  } else {
    errorMsg.style.display = 'block';
    document.getElementById('admin-passcode').value = '';
    document.getElementById('admin-passcode').focus();
  }
}

function logoutAdmin() {
  sessionStorage.removeItem('swachh_admin_auth');
  checkAuth();
}

let cityMap = null;
let cityMapMarkers = [];
let currentSpotIndex = 0;

async function loadAdminFeed() {
  const feed = document.getElementById('admin-feed-container');
  feed.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Fetching civic complaints feed...</div>';

  try {
    const res = await fetch(`${API_BASE}/incidents/?limit=100`);
    if (!res.ok) throw new Error('Failed to load incidents');

    allComplaints = await res.json();
    updateAdminStats();
    initOrUpdateCityMap();
    renderFeed();
  } catch (err) {
    console.error('Feed error:', err);
    feed.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem;">Error: ${err.message}</div>`;
  }
}

function updateAdminStats() {
  const total = allComplaints.length;
  const working = allComplaints.filter(c => ['IN_PROGRESS', 'WORKING', 'ASSIGNED'].includes((c.status || '').toUpperCase())).length;
  const completed = allComplaints.filter(c => ['RESOLVED', 'VERIFIED', 'COMPLETED', 'CLOSED'].includes((c.status || '').toUpperCase())).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-working').textContent = working;
  document.getElementById('stat-completed').textContent = completed;
}

function setAdminFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));

  if (filter === 'ALL') document.getElementById('tab-all').classList.add('active');
  if (filter === 'OPEN') document.getElementById('tab-open').classList.add('active');
  if (filter === 'WORKING') document.getElementById('tab-working').classList.add('active');
  if (filter === 'COMPLETED') document.getElementById('tab-completed').classList.add('active');

  renderFeed();
}

function filterAdminFeed() {
  renderFeed();
}

function resolveImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

function initOrUpdateCityMap() {
  const mapEl = document.getElementById('admin-city-map');
  const countBadge = document.getElementById('map-spots-count');
  const spotTitle = document.getElementById('map-current-spot-title');
  const spotSub = document.getElementById('map-current-spot-sub');

  if (!mapEl) return;
  if (typeof L === 'undefined') {
    setTimeout(initOrUpdateCityMap, 200);
    return;
  }

  const validIncidents = (allComplaints || []).filter(c => c && c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined);
  if (countBadge) {
    countBadge.textContent = `${validIncidents.length} Waste Sites`;
  }

  // Initialize Map if not already created
  if (!cityMap) {
    const rawLat = validIncidents.length > 0 ? validIncidents[0].latitude : 12.9716;
    const rawLng = validIncidents.length > 0 ? validIncidents[0].longitude : 77.5946;
    const initLat = Math.min(Math.max(rawLat, 6.4), 37.2);
    const initLng = Math.min(Math.max(rawLng, 68.0), 97.5);

    cityMap = L.map('admin-city-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 1.0,
      minZoom: 4
    }).setView([initLat, initLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(cityMap);
  }

  // Ensure map tiles calculate correct dimension once container is visible
  setTimeout(() => {
    if (cityMap) cityMap.invalidateSize();
  }, 100);
  setTimeout(() => {
    if (cityMap) cityMap.invalidateSize();
  }, 300);

  // Clear existing markers
  cityMapMarkers.forEach(m => cityMap.removeLayer(m));
  cityMapMarkers = [];

  if (validIncidents.length === 0) {
    if (spotTitle) spotTitle.textContent = 'No Active Garbage Sites';
    if (spotSub) spotSub.textContent = 'Reported waste sites will appear live on this city map';
    return;
  }

  // Create custom color-coded pins for each garbage incident
  validIncidents.forEach((item, idx) => {
    const tier = (item.severity_tier || 'MEDIUM').toUpperCase();
    let pinColor = '#F59E0B'; // Medium/Yellow
    if (tier === 'CRITICAL') pinColor = '#EF4444'; // Red
    else if (tier === 'HIGH') pinColor = '#EA580C'; // Orange
    else if (tier === 'LOW') pinColor = '#10B981'; // Green

    const pinIcon = L.divIcon({
      className: 'admin-hotspot-pin',
      html: `<div style="background: ${pinColor}; color: #FFFFFF; font-size: 0.95rem; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 2px solid #FFFFFF;"><span style="transform: rotate(45deg);">🗑️</span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const marker = L.marker([item.latitude, item.longitude], { icon: pinIcon }).addTo(cityMap);
    
    const photo = resolveImageUrl(item.before_image_url);

    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; line-height: 1.4; min-width: 250px; max-width: 290px; color: #14213D;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: #D97706; font-size: 13px;">#SWV-${String(item.id).padStart(5, '0')}</strong>
          <span style="font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 10px; background: ${pinColor}20; color: ${pinColor}; border: 1px solid ${pinColor}60;">${tier} (${Math.round(item.severity_score || 50)}/100)</span>
        </div>

        <div style="height: 140px; border-radius: 8px; overflow: hidden; margin-bottom: 8px; border: 1px solid #E2E8F0; background: #000000;">
          <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Garbage Site Photo">
        </div>

        <div style="font-size: 12px; font-weight: 700; color: #0F172A; margin-bottom: 4px; line-height: 1.35;">
          📍 ${item.address || `${item.latitude}, ${item.longitude}`}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748B; padding-top: 4px; border-top: 1px solid #E2E8F0;">
          <span>Extent: <strong>${item.extent_score || 3}/5 (${(item.extent_percentage || 35).toFixed(1)}%)</strong></span>
          <span style="color: #10B981; font-weight: 700;">${item.status || 'REPORTED'}</span>
        </div>
      </div>
    `, {
      maxWidth: 310
    });

    marker.on('click', () => {
      currentSpotIndex = idx;
      updateSpotNavigationUI(validIncidents);
    });

    cityMapMarkers.push(marker);
  });

  // Fit bounds to show all garbage sites
  if (cityMapMarkers.length > 0) {
    const group = L.featureGroup(cityMapMarkers);
    cityMap.fitBounds(group.getBounds().pad(0.2));
  }

  // Set initial spot navigation state
  currentSpotIndex = 0;
  updateSpotNavigationUI(validIncidents);
}

function updateSpotNavigationUI(validIncidents) {
  const spotTitle = document.getElementById('map-current-spot-title');
  const spotSub = document.getElementById('map-current-spot-sub');

  if (!validIncidents || validIncidents.length === 0) {
    if (spotTitle) spotTitle.textContent = 'No Active Garbage Sites';
    if (spotSub) spotSub.textContent = 'Use arrows to jump between reported garbage locations';
    return;
  }

  const active = validIncidents[currentSpotIndex];
  if (spotTitle && active) {
    const tier = (active.severity_tier || 'MEDIUM').toUpperCase();
    spotTitle.textContent = `Spot ${currentSpotIndex + 1} of ${validIncidents.length}: #SWV-${String(active.id).padStart(5, '0')} (${tier})`;
  }
  if (spotSub && active) {
    spotSub.textContent = `📍 ${active.address || `${active.latitude}, ${active.longitude}`}`;
  }
}

function navigateMapSpot(direction) {
  const validIncidents = (allComplaints || []).filter(c => c && c.latitude !== null && c.latitude !== undefined && c.longitude !== null && c.longitude !== undefined);
  if (validIncidents.length === 0) return;

  currentSpotIndex = (currentSpotIndex + direction + validIncidents.length) % validIncidents.length;
  const target = validIncidents[currentSpotIndex];

  if (cityMap && target) {
    cityMap.flyTo([target.latitude, target.longitude], 17, {
      animate: true,
      duration: 1.0
    });

    const marker = cityMapMarkers[currentSpotIndex];
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }
  }

  updateSpotNavigationUI(validIncidents);
}

function renderFeed() {
  const feed = document.getElementById('admin-feed-container');
  const search = document.getElementById('feed-search').value.toLowerCase().trim();

  let filtered = allComplaints;

  // Filter tab
  if (currentFilter === 'OPEN') {
    filtered = filtered.filter(c => ['REPORTED', 'OPEN'].includes((c.status || '').toUpperCase()));
  } else if (currentFilter === 'WORKING') {
    filtered = filtered.filter(c => ['ASSIGNED', 'IN_PROGRESS', 'WORKING'].includes((c.status || '').toUpperCase()));
  } else if (currentFilter === 'COMPLETED') {
    filtered = filtered.filter(c => ['RESOLVED', 'VERIFIED', 'COMPLETED', 'CLOSED'].includes((c.status || '').toUpperCase()));
  }

  // Search filter
  if (search) {
    filtered = filtered.filter(c => 
      String(c.id).includes(search) ||
      (c.ticket_number || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search) ||
      (c.issue_type || '').toLowerCase().includes(search) ||
      (c.reporter_contact || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    feed.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">No complaints match this filter.</div>';
    return;
  }

  feed.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.id = `feed-card-${item.id}`;

    const tier = (item.severity_tier || 'MEDIUM').toLowerCase();
    const score = Math.round(item.severity_score || 0);
    const photo = resolveImageUrl(item.before_image_url);
    const status = (item.status || 'REPORTED').toUpperCase();

    // Map backend status to simplified 3-stage UI
    let uiStatus = 'OPEN';
    if (['ASSIGNED', 'IN_PROGRESS', 'WORKING'].includes(status)) uiStatus = 'WORKING';
    if (['RESOLVED', 'VERIFIED', 'COMPLETED', 'CLOSED'].includes(status)) uiStatus = 'COMPLETED';

    const timeAgo = item.created_at ? new Date(item.created_at).toLocaleString() : 'Recently';
    const reporter = item.reporter_contact || `Citizen_#${String(item.id).padStart(4, '0')}`;

    card.innerHTML = `
      <!-- Card Header -->
      <div class="feed-header">
        <div class="feed-user-info">
          <div class="feed-avatar">👤</div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 0.35rem;">
              <span>${reporter}</span>
              <span style="font-size: 0.65rem; background: rgba(16, 185, 129, 0.15); color: var(--color-green); padding: 0.1rem 0.45rem; border-radius: 10px; font-weight: 800;">CONFIDENTIAL</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${timeAgo} • #SWV-${String(item.id).padStart(5, '0')}</div>
          </div>
        </div>

        <span class="sev-pill sev-${tier}">
          ${(item.severity_tier || 'MEDIUM').toUpperCase()} (${score}/100)
        </span>
      </div>

      <!-- Feed Image -->
      <div class="feed-image-container">
        <img src="${photo}" class="feed-img" alt="Civic hazard evidence" onerror="this.src='https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=600'">
        <div style="position: absolute; bottom: 12px; left: 12px; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: #F8FAFC; border: 1px solid rgba(255, 255, 255, 0.25); padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.78rem; font-weight: 800; z-index: 2; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
          Extent Score: ${item.extent_score || 3}/5 (${(item.extent_percentage || 35).toFixed(1)}% visible)
        </div>
      </div>

      <!-- Feed Body -->
      <div class="feed-body">
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem; color: var(--color-ink);">${formatIssue(item.issue_type)}</h3>
        
        <!-- Interactive Clickable Location Badge (Opens OpenStreetMap / Directions) -->
        <div class="feed-location-badge" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.4rem 0.85rem; background: var(--bg-input); border: 1px solid var(--color-border); border-radius: 6px; margin-bottom: 0.85rem; transition: all 0.2s;" onclick="openMapModalById(${item.id})" title="Click to view interactive map & field routing">
          <span style="font-size: 1.05rem;">📍</span>
          <span style="font-weight: 700; color: var(--color-ink); font-size: 0.88rem; text-decoration: underline; text-decoration-color: var(--color-amber);">${item.address || `${item.latitude}, ${item.longitude}`}</span>
          <span style="font-size: 0.72rem; background: var(--color-amber-soft); color: var(--color-amber-hover); font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 12px; margin-left: 0.35rem; border: 1px solid rgba(245, 158, 11, 0.3);">🗺️ View Map</span>
        </div>

        <div class="feed-metrics-grid" style="grid-template-columns: 1fr;">
          <div>
            <span style="color: var(--text-dim); display: block;">Location Context</span>
            <strong style="color: #ec4899;">${item.location_impact_reason || 'Standard Roadside Zone'}</strong>
          </div>
        </div>

        ${item.after_image_url ? `
          <div style="margin: 0.75rem 0; padding: 0.75rem; background: rgba(16, 185, 129, 0.08); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="font-size: 0.75rem; font-weight: 700; color: #34d399; margin-bottom: 0.35rem;">✓ AFTER CLEANUP PHOTO ATTACHED</div>
            <img src="${resolveImageUrl(item.after_image_url)}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;" alt="After proof">
          </div>
        ` : ''}

        <!-- Status Management Row -->
        <div class="feed-actions-row">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Status:</span>
            <select class="status-dropdown" onchange="handleStatusChange(${item.id}, this.value)">
              <option value="OPEN" ${uiStatus === 'OPEN' ? 'selected' : ''}>🔵 OPEN</option>
              <option value="WORKING" ${uiStatus === 'WORKING' ? 'selected' : ''}>🟡 WORKING</option>
              <option value="COMPLETED" ${uiStatus === 'COMPLETED' ? 'selected' : ''}>🟢 COMPLETED</option>
            </select>
          </div>

          <a href="/tracker?id=${item.id}" target="_blank" class="btn-nav-action" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
            <span>🔍</span> Public Proof Certificate
          </a>
        </div>
      </div>
    `;

    feed.appendChild(card);
  });
}

function formatIssue(type) {
  if (!type) return 'Garbage Accumulation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Status Updates
async function handleStatusChange(id, newStatus) {
  if (newStatus === 'COMPLETED') {
    // Open quality verification AFTER image modal
    openCompletionModal(id);
  } else {
    const backendStatus = newStatus === 'WORKING' ? 'IN_PROGRESS' : 'REPORTED';
    try {
      const res = await fetch(`${API_BASE}/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: backendStatus })
      });

      if (!res.ok) throw new Error('Failed to update status');
      await loadAdminFeed();
    } catch (e) {
      alert(`Error updating status: ${e.message}`);
    }
  }
}

function openCompletionModal(id) {
  resolvingId = id;
  document.getElementById('modal-complaint-id').textContent = `#SWV-${String(id).padStart(5, '0')}`;
  
  const uploadGroup = document.getElementById('after-photo-upload-group');
  if (uploadGroup) uploadGroup.style.display = 'block';
  
  const previewBox = document.getElementById('after-preview-box');
  if (previewBox) previewBox.style.display = 'none';

  const fileInput = document.getElementById('after-photo-file');
  if (fileInput) fileInput.value = '';
  
  document.getElementById('admin-notes').value = '';
  document.getElementById('completion-modal').style.display = 'flex';
}

function closeCompletionModal() {
  document.getElementById('completion-modal').style.display = 'none';
  resolvingId = null;
  afterFileSelected = null;
  renderFeed();
}

function previewAfterPhoto(e) {
  if (e.target.files && e.target.files[0]) {
    afterFileSelected = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('after-preview-img').src = ev.target.result;
      const fnEl = document.getElementById('after-preview-filename');
      if (fnEl) fnEl.textContent = afterFileSelected.name;
      
      const uploadGroup = document.getElementById('after-photo-upload-group');
      if (uploadGroup) uploadGroup.style.display = 'none';

      document.getElementById('after-preview-box').style.display = 'block';
    };
    reader.readAsDataURL(afterFileSelected);
  }
}

function resetAfterPhotoSelection() {
  afterFileSelected = null;
  const fileInput = document.getElementById('after-photo-file');
  if (fileInput) fileInput.value = '';
  
  const uploadGroup = document.getElementById('after-photo-upload-group');
  if (uploadGroup) uploadGroup.style.display = 'block';
  
  const previewBox = document.getElementById('after-preview-box');
  if (previewBox) previewBox.style.display = 'none';
}

async function submitCompletionProof(e) {
  e.preventDefault();
  if (!resolvingId || !afterFileSelected) {
    alert('Please select an after cleanup photo.');
    return;
  }

  const btn = document.getElementById('btn-save-complete');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Posting Resolution Proof...';

  try {
    const formData = new FormData();
    formData.append('image', afterFileSelected);
    const notes = document.getElementById('admin-notes').value.trim();
    if (notes) formData.append('notes', notes);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${API_BASE}/incidents/${resolvingId}/resolve`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Server returned error: ${res.status}`);

    alert(`Complaint #SWV-${String(resolvingId).padStart(5, '0')} has been marked COMPLETED with resolution proof uploaded!`);
    closeCompletionModal();
    await loadAdminFeed();
  } catch (err) {
    if (err.name === 'AbortError') {
      alert('Request timed out while uploading. Please verify server connection.');
    } else {
      alert(`Submission error: ${err.message}`);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>✓</span> Post & Complete';
  }
}

// -------------------------------------------------------------
// Interactive OpenStreetMap Modal & Routing Engine
// -------------------------------------------------------------
let adminLeafletMap = null;
let adminMapMarker = null;

function openMapModalById(id) {
  const item = allComplaints.find(c => c.id === id);
  if (!item) {
    console.warn(`Complaint ID ${id} not found in memory`);
    return;
  }
  const ticketId = item.ticket_number || `SWV-${String(item.id).padStart(5, '0')}`;
  openMapModal(item.latitude, item.longitude, item.address, ticketId, item.issue_type, item.severity_tier);
}

function openMapModal(lat, lng, address, ticketId, issueType, sevTier) {
  const modal = document.getElementById('map-modal');
  if (!modal) return;

  const validLat = parseFloat(lat) || 12.9716;
  const validLng = parseFloat(lng) || 77.5946;
  const displayAddr = address || `${validLat.toFixed(5)}, ${validLng.toFixed(5)}`;

  modal.style.display = 'flex';
  document.getElementById('map-modal-title').textContent = `${formatIssue(issueType)} (#${ticketId})`;
  document.getElementById('map-modal-coords').textContent = `Coordinates: ${validLat.toFixed(5)}, ${validLng.toFixed(5)} • ${(sevTier || 'MEDIUM').toUpperCase()} SEVERITY`;
  document.getElementById('map-modal-address').textContent = displayAddr;

  // External routing & map service links
  const osmLink = document.getElementById('btn-osm-link');
  const gmapsLink = document.getElementById('btn-gmaps-link');
  const directionsLink = document.getElementById('btn-directions-link');

  if (osmLink) {
    osmLink.href = `https://www.openstreetmap.org/?mlat=${validLat}&mlon=${validLng}#map=17/${validLat}/${validLng}`;
  }
  if (gmapsLink) {
    gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${validLat},${validLng}`;
  }
  if (directionsLink) {
    // OpenStreetMap OSRM routing engine
    directionsLink.href = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${validLat}%2C${validLng}`;
  }

  // Initialize or re-center Leaflet Map
  setTimeout(() => {
    if (typeof L === 'undefined') {
      console.warn('Leaflet library loading in background...');
      return;
    }

    const clampedLat = Math.min(Math.max(validLat, 6.4), 37.2);
    const clampedLng = Math.min(Math.max(validLng, 68.0), 97.5);

    if (!adminLeafletMap) {
      adminLeafletMap = L.map('admin-map-container', {
        maxBounds: INDIA_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 4
      }).setView([clampedLat, clampedLng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(adminLeafletMap);
    } else {
      adminLeafletMap.setView([clampedLat, clampedLng], 16);
      adminLeafletMap.invalidateSize();
    }

    // Pinpoint Marker
    if (adminMapMarker) {
      adminLeafletMap.removeLayer(adminMapMarker);
    }

    adminMapMarker = L.marker([validLat, validLng]).addTo(adminLeafletMap);
    adminMapMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; line-height: 1.45; min-width: 180px;">
        <b style="color: #14213d; font-size: 14px;">#${ticketId}</b><br>
        <span style="color: #d97706; font-weight: 800;">${formatIssue(issueType)}</span><br>
        <span style="color: #475569; font-size: 12px;">${displayAddr}</span>
      </div>
    `).openPopup();
  }, 180);
}

function closeMapModal() {
  const modal = document.getElementById('map-modal');
  if (modal) modal.style.display = 'none';
}

function handleMapBackdropClick(e) {
  if (e.target.id === 'map-modal') {
    closeMapModal();
  }
}
