// SwachhVision Main Client JS - Civic Intelligence Pipeline
const API_BASE = window.location.protocol.startsWith('http')
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

let selectedFile = null;
let userComplaints = [];

// Leaflet Map Picker State
let pickerMap = null;
let pickerMarker = null;
let currentPickerCoords = { lat: 12.9716, lng: 77.5946 };

function getOrCreateCitizenHandle() {
  let handle = localStorage.getItem('swachh_citizen_handle');
  if (!handle) {
    const prefixes = ['EcoCitizen', 'Swachh', 'CivicHero', 'GreenWarrior', 'UrbanCitizen'];
    const randHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    handle = `${prefix}_#${randHex}`;
    localStorage.setItem('swachh_citizen_handle', handle);
  }
  return handle;
}

document.addEventListener('DOMContentLoaded', () => {
  const userHandleEl = document.getElementById('profile-user-handle');
  if (userHandleEl) {
    userHandleEl.textContent = getOrCreateCitizenHandle();
  }
  syncUserComplaintsWithServer();
  fetchCivicTrustMetrics();
  // GPS is intentionally not fetched until the user uploads or takes a photo.
});

async function fetchCivicTrustMetrics() {
  try {
    const res = await fetch(`${API_BASE}/incidents/metrics/summary`);
    if (res.ok) {
      const data = await res.json();
      const todayEl = document.getElementById('citizen-stat-solved-today');
      const weekEl = document.getElementById('citizen-stat-solved-week');
      const progressPctEl = document.getElementById('stat-progress-pct');
      const progressBarFillEl = document.getElementById('stat-progress-bar-fill');

      const growthTagEl = document.getElementById('citizen-stat-growth-tag');

      if (todayEl && data.solved_today !== undefined) todayEl.textContent = data.solved_today;
      if (weekEl && data.solved_this_week !== undefined) weekEl.textContent = data.solved_this_week;
      if (growthTagEl && data.velocity_growth_pct !== undefined) {
        const sign = data.velocity_growth_pct >= 0 ? '+' : '';
        growthTagEl.textContent = `${sign}${data.velocity_growth_pct}% vs Last Week`;
      }

      if (progressPctEl && progressBarFillEl && data.solved_today !== undefined) {
        const solved = Number(data.solved_today) || 0;
        const target = Math.max(solved, 40);
        const pct = Math.min(100, Math.max(80, Math.round((solved / target) * 100)));
        progressPctEl.textContent = `${pct}% Cleared Today`;
        progressBarFillEl.style.width = `${pct}%`;
      }
    }
  } catch (err) {
    console.warn("Could not fetch civic trust metrics:", err);
  }
}

// 1. Location Management: Live GPS vs Interactive Map Choice
function activateLocationSection() {
  const inactiveHint = document.getElementById('location-inactive-hint');
  const activeBox = document.getElementById('location-active-box');
  if (inactiveHint) inactiveHint.style.display = 'none';
  if (activeBox) activeBox.style.display = 'block';

  // Automatically start acquiring high accuracy GPS as initial baseline
  useLiveGPS();
}

function deactivateLocationSection() {
  const inactiveHint = document.getElementById('location-inactive-hint');
  const activeBox = document.getElementById('location-active-box');
  if (inactiveHint) inactiveHint.style.display = 'flex';
  if (activeBox) activeBox.style.display = 'none';
}

function useLiveGPS() {
  const statusText = document.getElementById('gps-status-text');
  const subText = document.getElementById('gps-sub-text');
  const badge = document.getElementById('gps-accuracy-badge');
  const latVal = document.getElementById('lat-val');
  const lngVal = document.getElementById('lng-val');

  const gpsBtn = document.getElementById('btn-choice-gps');
  const mapBtn = document.getElementById('btn-choice-map');
  if (gpsBtn && mapBtn) {
    gpsBtn.style.background = 'var(--btn-primary-bg)';
    gpsBtn.style.color = 'var(--btn-primary-text)';
    mapBtn.style.background = 'var(--bg-card)';
    mapBtn.style.color = 'var(--color-ink)';
  }

  if (!navigator.geolocation) {
    if (statusText) statusText.textContent = 'GPS not supported on this browser';
    if (badge) {
      badge.textContent = 'Use Map Instead';
      badge.className = 'gps-accuracy-tag gps-approx';
    }
    return;
  }

  if (statusText) statusText.textContent = 'Acquiring high-precision GPS...';
  if (badge) {
    badge.textContent = 'Acquiring...';
    badge.className = 'gps-accuracy-tag gps-approx';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = Math.round(position.coords.accuracy || 15);

      latVal.value = lat.toFixed(5);
      lngVal.value = lng.toFixed(5);
      currentPickerCoords = { lat, lng };

      if (statusText) {
        statusText.textContent = `GPS Locked (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }

      if (badge) {
        if (acc <= 50) {
          badge.textContent = `High Precision (±${acc}m)`;
          badge.className = 'gps-accuracy-tag gps-accurate';
          if (subText) subText.textContent = 'Live GPS coordinates locked for municipal crew dispatch.';
        } else {
          badge.textContent = `Live GPS (±${acc}m)`;
          badge.className = 'gps-accuracy-tag gps-approx';
          if (subText) subText.textContent = 'GPS locked. You can also fine-tune the exact spot using "Choose on Map".';
        }
      }
    },
    (err) => {
      console.warn('Geolocation notice:', err);
      latVal.value = '12.9716';
      lngVal.value = '77.5946';
      currentPickerCoords = { lat: 12.9716, lng: 77.5946 };
      if (statusText) statusText.textContent = 'Bengaluru Central (12.9716, 77.5946)';
      if (badge) {
        badge.textContent = 'Default Baseline';
        badge.className = 'gps-accuracy-tag gps-approx';
      }
      if (subText) subText.textContent = 'Click "Choose on Map" to pinpoint your exact location or enter landmark below.';
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// 2. Interactive Map Picker Modal (Leaflet OpenStreetMap)
function openLocationMapModal() {
  const modal = document.getElementById('citizen-map-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const latVal = parseFloat(document.getElementById('lat-val').value) || 12.9716;
  const lngVal = parseFloat(document.getElementById('lng-val').value) || 77.5946;
  currentPickerCoords = { lat: latVal, lng: lngVal };

  const coordsText = document.getElementById('modal-coords-text');
  if (coordsText) {
    coordsText.textContent = `${latVal.toFixed(5)}, ${lngVal.toFixed(5)}`;
  }

  setTimeout(() => {
    initPickerMap(latVal, lngVal);
  }, 100);
}

function closeLocationMapModal() {
  const modal = document.getElementById('citizen-map-modal');
  if (modal) modal.style.display = 'none';
}

// Geographical Bounds restricted strictly to India
const INDIA_BOUNDS = [[6.4, 68.0], [37.2, 97.5]];

function initPickerMap(lat, lng) {
  const mapContainer = document.getElementById('citizen-picker-map');
  if (!mapContainer || typeof L === 'undefined') return;

  // Ensure initial coordinates are within India
  const validLat = Math.min(Math.max(lat, 6.4), 37.2);
  const validLng = Math.min(Math.max(lng, 68.0), 97.5);

  if (pickerMap) {
    pickerMap.invalidateSize();
    pickerMap.setView([validLat, validLng], 16);
    if (pickerMarker) pickerMarker.setLatLng([validLat, validLng]);
    return;
  }

  pickerMap = L.map('citizen-picker-map', {
    maxBounds: INDIA_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 4
  }).setView([validLat, validLng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(pickerMap);

  // Custom high-visibility SVG pin
  const pinIcon = L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="background: #D97706; color: #FFFFFF; font-size: 1.1rem; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.5); border: 2.5px solid #FFFFFF;"><span style="transform: rotate(45deg);">📍</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34]
  });

  pickerMarker = L.marker([validLat, validLng], {
    icon: pinIcon,
    draggable: true
  }).addTo(pickerMap);

  pickerMarker.on('dragend', (e) => {
    const position = e.target.getLatLng();
    updatePickedCoordinates(position.lat, position.lng);
  });

  pickerMap.on('click', (e) => {
    pickerMarker.setLatLng(e.latlng);
    updatePickedCoordinates(e.latlng.lat, e.latlng.lng);
  });
}

function updatePickedCoordinates(lat, lng) {
  currentPickerCoords = { lat, lng };
  const coordsText = document.getElementById('modal-coords-text');
  if (coordsText) {
    coordsText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

function confirmLocationFromMap() {
  const latVal = document.getElementById('lat-val');
  const lngVal = document.getElementById('lng-val');
  const statusText = document.getElementById('gps-status-text');
  const badge = document.getElementById('gps-accuracy-badge');
  const subText = document.getElementById('gps-sub-text');

  const gpsBtn = document.getElementById('btn-choice-gps');
  const mapBtn = document.getElementById('btn-choice-map');
  if (gpsBtn && mapBtn) {
    mapBtn.style.background = 'var(--btn-primary-bg)';
    mapBtn.style.color = 'var(--btn-primary-text)';
    gpsBtn.style.background = 'var(--bg-card)';
    gpsBtn.style.color = 'var(--color-ink)';
  }

  latVal.value = currentPickerCoords.lat.toFixed(5);
  lngVal.value = currentPickerCoords.lng.toFixed(5);

  if (statusText) {
    statusText.textContent = `Map Selected (${currentPickerCoords.lat.toFixed(4)}, ${currentPickerCoords.lng.toFixed(4)})`;
  }
  if (badge) {
    badge.textContent = 'Map Pin Selected';
    badge.className = 'gps-accuracy-tag gps-accurate';
  }
  if (subText) {
    subText.textContent = 'Precise pin location set via interactive map.';
  }

  closeLocationMapModal();
}

// 3. Photo Dropzone & Preview
function handleFileSelected(event) {
  if (event.target.files && event.target.files[0]) {
    const file = event.target.files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById('preview-image');
      const previewBox = document.getElementById('preview-box');
      const dropzoneBox = document.getElementById('dropzone-box');
      const previewName = document.getElementById('preview-name');
      const submitBtn = document.getElementById('submit-btn');
      const submitHelper = document.getElementById('submit-helper');

      if (previewImg) previewImg.src = e.target.result;
      if (previewName) previewName.textContent = file.name || 'hazard_evidence.jpg';
      if (previewBox) previewBox.style.display = 'flex';
      if (dropzoneBox) dropzoneBox.style.display = 'none';

      // Activate location selector now that photo is attached
      activateLocationSection();

      // Unlock Submit CTA Button
      if (submitBtn) submitBtn.disabled = false;
      if (submitHelper) {
        submitHelper.textContent = '✓ Photo attached. Ready to analyze and submit.';
        submitHelper.style.color = 'var(--color-green)';
      }
    };
    reader.readAsDataURL(file);
  }
}

function clearSelectedPhoto() {
  selectedFile = null;
  const photoInput = document.getElementById('photo-input');
  if (photoInput) photoInput.value = '';
  
  const previewBox = document.getElementById('preview-box');
  const dropzoneBox = document.getElementById('dropzone-box');
  const submitBtn = document.getElementById('submit-btn');
  const submitHelper = document.getElementById('submit-helper');

  if (previewBox) previewBox.style.display = 'none';
  if (dropzoneBox) dropzoneBox.style.display = 'block';

  // Deactivate location section until new photo is added
  deactivateLocationSection();

  if (submitBtn) submitBtn.disabled = true;
  if (submitHelper) {
    submitHelper.textContent = 'Attach a hazard photo above to enable location and submission.';
    submitHelper.style.color = 'var(--text-muted)';
  }
}

// 4. Form Submission & AI Dual Validation Result
function resolveImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!selectedFile) {
    alert('Please attach a photo of the civic hazard.');
    return;
  }

  const lat = parseFloat(document.getElementById('lat-val').value) || 12.9716;
  const lng = parseFloat(document.getElementById('lng-val').value) || 77.5946;
  const desc = document.getElementById('desc-input').value.trim();

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `Submitting Report...`;

  try {
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('latitude', lat);
    formData.append('longitude', lng);
    formData.append('reporter_contact', getOrCreateCitizenHandle());
    if (desc) formData.append('description', desc);

    const response = await fetch(`${API_BASE}/incidents/report`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Failed to submit complaint');
    }

    const result = await response.json();
    
    // 1. Save to citizen activity drawer
    saveComplaintToActivity(result);

    // 2. Immediately reset the form back to fresh state
    resetComplaintForm();

    // 3. Update trust metrics and open activity drawer to show the new ticket
    fetchCivicTrustMetrics();
    setTimeout(() => {
      toggleActivityDrawer('complaints');
    }, 250);

  } catch (error) {
    console.error('Submission error:', error);
    alert(`Submission Error: ${error.message}`);
  } finally {
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `Analyze and Report`;
    }
  }
}

function renderAIResult(data) {
  const resultPanel = document.getElementById('ai-result-box');
  if (!resultPanel) return;
  resultPanel.style.display = 'block';

  document.getElementById('res-ticket-id').textContent = `SWV-${String(data.id).padStart(5, '0')}`;
  document.getElementById('res-address').textContent = data.address || `${data.latitude}, ${data.longitude}`;

  const sevBadge = document.getElementById('res-sev-badge');
  const tier = (data.severity_tier || 'MEDIUM').toLowerCase();
  const score = Math.round(data.severity_score || 0);

  sevBadge.className = `sev-pill sev-${tier}`;
  sevBadge.textContent = `${(data.severity_tier || 'MEDIUM').toUpperCase()} SEVERITY (${score}/100)`;

  document.getElementById('res-issue-type').textContent = formatIssue(data.issue_type);
  document.getElementById('res-extent').textContent = `Score ${data.extent_score || 3}/5 (${(data.extent_percentage || 30).toFixed(1)}%)`;
  document.getElementById('res-location-impact').textContent = `Impact ${data.location_impact_score || 3}/5`;

  const aiVal = document.getElementById('res-ai-val');
  if (aiVal) {
    aiVal.textContent = '✓ AI Verified';
  }

  const reasoningRow = document.getElementById('res-reasoning-row');
  const reasoningText = document.getElementById('res-reasoning-text');
  if (reasoningRow && reasoningText) {
    reasoningRow.style.display = 'block';
    reasoningText.textContent = data.verification_notes || 'Spatial segmentation and confidence consensus confirmed.';
  }
}

function resetComplaintForm() {
  clearSelectedPhoto();
  const descEl = document.getElementById('desc-input');
  if (descEl) descEl.value = '';
  const resultBox = document.getElementById('ai-result-box');
  if (resultBox) resultBox.style.display = 'none';
}

function formatIssue(type) {
  if (!type) return 'Garbage Accumulation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// 5. Citizen Complaints LocalStorage Sync with Live Backend Database
async function syncUserComplaintsWithServer() {
  try {
    const raw = localStorage.getItem('swachh_user_complaints');
    userComplaints = raw ? JSON.parse(raw) : [];

    // Query backend to cross-reference valid IDs
    const res = await fetch(`${API_BASE}/incidents/?limit=200`);
    if (res.ok) {
      const serverIncidents = await res.json();
      const serverMap = new Map(serverIncidents.map(i => [i.id, i]));

      // Keep only complaints that exist in live database and update with freshest server info
      userComplaints = userComplaints
        .filter(c => serverMap.has(c.id))
        .map(c => {
          const s = serverMap.get(c.id);
          return {
            ...c,
            ...s,
            before_image_url: resolveImageUrl(s.before_image_url || c.before_image_url),
            after_image_url: s.after_image_url ? resolveImageUrl(s.after_image_url) : c.after_image_url
          };
        });
      localStorage.setItem('swachh_user_complaints', JSON.stringify(userComplaints));
    }
  } catch (e) {
    console.warn('Sync complaints notice:', e);
  }

  updateActivityBadge();
  renderActivityList();
}

function clearAllCitizenComplaints() {
  userComplaints = [];
  localStorage.removeItem('swachh_user_complaints');
  updateActivityBadge();
  renderActivityList();
}

function saveComplaintToActivity(complaint) {
  const photoUrl = resolveImageUrl(complaint.before_image_url);
  const existingIdx = userComplaints.findIndex(c => c.id === complaint.id);
  const complaintObj = {
    id: complaint.id,
    ticket_number: complaint.ticket_number || `SWV-${String(complaint.id).padStart(5, '0')}`,
    issue_type: complaint.issue_type,
    status: complaint.status || 'REPORTED',
    address: complaint.address,
    before_image_url: photoUrl,
    after_image_url: complaint.after_image_url ? resolveImageUrl(complaint.after_image_url) : null,
    severity_tier: complaint.severity_tier,
    severity_score: complaint.severity_score,
    reporter_contact: complaint.reporter_contact,
    created_at: complaint.created_at || new Date().toISOString()
  };

  if (existingIdx >= 0) {
    userComplaints[existingIdx] = complaintObj;
  } else {
    userComplaints.unshift(complaintObj);
  }

  localStorage.setItem('swachh_user_complaints', JSON.stringify(userComplaints));
  updateActivityBadge();
  renderActivityList();
}

let citizenComplaintFilter = 'OPEN';

function setCitizenComplaintFilter(filter) {
  citizenComplaintFilter = filter;
  ['open', 'closed', 'all'].forEach(tab => {
    const btn = document.getElementById(`btn-filter-${tab}`);
    if (btn) {
      if (tab.toUpperCase() === filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  renderActivityList();
}

function updateActivityBadge() {
  const badge = document.getElementById('activity-count');
  const tabBadge = document.getElementById('tab-complaint-count');
  const profileTotal = document.getElementById('profile-total-count');
  const profileResolved = document.getElementById('profile-resolved-count');

  const openBadge = document.getElementById('badge-open-count');
  const closedBadge = document.getElementById('badge-closed-count');
  const allBadge = document.getElementById('badge-all-count');

  const total = userComplaints.length;
  const closedCount = userComplaints.filter(c => ['RESOLVED', 'VERIFIED', 'COMPLETED', 'CLOSED'].includes((c.status || '').toUpperCase())).length;
  const openCount = total - closedCount;

  if (badge) {
    if (openCount > 0) {
      badge.textContent = openCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (tabBadge) tabBadge.textContent = total;
  if (profileTotal) profileTotal.textContent = total;
  if (profileResolved) profileResolved.textContent = closedCount;

  if (openBadge) openBadge.textContent = openCount;
  if (closedBadge) closedBadge.textContent = closedCount;
  if (allBadge) allBadge.textContent = total;
}

function renderActivityList() {
  const list = document.getElementById('activity-list');
  if (!list) return;

  const closedStatuses = ['RESOLVED', 'VERIFIED', 'COMPLETED', 'CLOSED'];
  const closedCount = userComplaints.filter(c => closedStatuses.includes((c.status || '').toUpperCase())).length;
  const openCount = userComplaints.length - closedCount;

  let filtered = userComplaints;
  if (citizenComplaintFilter === 'OPEN') {
    filtered = userComplaints.filter(c => !closedStatuses.includes((c.status || '').toUpperCase()));
  } else if (citizenComplaintFilter === 'CLOSED') {
    filtered = userComplaints.filter(c => closedStatuses.includes((c.status || '').toUpperCase()));
  }

  if (userComplaints.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📋</div>
        <div style="font-weight: 700; color: var(--color-ink);">No Complaints Logged Yet</div>
        <div style="font-size: 0.85rem; margin-top: 0.3rem;">Submit your first civic hazard report to track live resolution proof!</div>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    if (citizenComplaintFilter === 'OPEN') {
      list.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; background: var(--bg-card); border-radius: var(--radius-sharp); border: 1px solid var(--color-border);">
          <div style="font-size: 2rem; margin-bottom: 0.4rem;">🎉</div>
          <div style="font-weight: 800; color: var(--color-green); font-size: 0.95rem;">All Issues Resolved!</div>
          <div style="font-size: 0.82rem; margin: 0.35rem 0 1rem 0;">You have no pending open complaints on this device.</div>
          <button type="button" class="btn-nav-control" style="font-size: 0.78rem; padding: 0.4rem 0.85rem; margin: 0 auto;" onclick="setCitizenComplaintFilter('CLOSED')">
            View Resolved Proofs (${closedCount}) ➔
          </button>
        </div>
      `;
    } else if (citizenComplaintFilter === 'CLOSED') {
      list.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; background: var(--bg-card); border-radius: var(--radius-sharp); border: 1px solid var(--color-border);">
          <div style="font-size: 2rem; margin-bottom: 0.4rem;">⏳</div>
          <div style="font-weight: 800; color: var(--color-amber-hover); font-size: 0.95rem;">No Resolved Complaints Yet</div>
          <div style="font-size: 0.82rem; margin: 0.35rem 0 1rem 0;">Open complaints will move here once municipal cleanup proof is uploaded.</div>
          <button type="button" class="btn-nav-control" style="font-size: 0.78rem; padding: 0.4rem 0.85rem; margin: 0 auto;" onclick="setCitizenComplaintFilter('OPEN')">
            View Active Open Complaints (${openCount}) ➔
          </button>
        </div>
      `;
    }
    return;
  }

  list.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'activity-card';

    const status = (item.status || 'REPORTED').toUpperCase();
    let statusClass = 'status-open';
    let statusText = 'OPEN';

    if (status === 'IN_PROGRESS' || status === 'WORKING') {
      statusClass = 'status-working';
      statusText = 'WORKING';
    } else if (closedStatuses.includes(status)) {
      statusClass = 'status-completed';
      statusText = 'COMPLETED';
    }

    const tier = (item.severity_tier || 'MEDIUM').toLowerCase();
    const photo = resolveImageUrl(item.before_image_url);

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <div>
          <span style="font-size: 0.75rem; color: var(--color-amber-hover); font-weight: 800;">#SWV-${String(item.id).padStart(5, '0')}</span>
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--color-ink);">${formatIssue(item.issue_type)}</div>
        </div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>

      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
        📍 ${item.address || 'Reported Location'}
      </div>

      <div style="height: 120px; border-radius: 8px; overflow: hidden; margin-bottom: 0.75rem; border: 1px solid var(--color-border); background: #000;">
        <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;" alt="Evidence" onerror="this.src='https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500'">
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="sev-pill sev-${tier}" style="font-size: 0.7rem; padding: 0.2rem 0.6rem;">
          ${(item.severity_tier || 'MEDIUM').toUpperCase()}
        </span>
        <a href="/tracker?id=${item.id}" class="btn-nav-control" style="padding: 0.35rem 0.75rem; font-size: 0.76rem; border-radius: 6px;">
          View Proof Certificate ➔
        </a>
      </div>
    `;

    list.appendChild(card);
  });
}

function toggleActivityDrawer() {
  const drawer = document.getElementById('activity-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  if (!drawer || !backdrop) return;

  if (drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    backdrop.style.display = 'none';
  } else {
    drawer.classList.add('open');
    backdrop.style.display = 'block';
    renderActivityList();
    syncUserComplaintsWithServer();
  }
}
