// SwachhVision Citizen Portal Logic
const API_BASE = (window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.pathname.startsWith('/citizen')))
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

let miniMap = null;
let marker = null;
let selectedFile = null;
let currentTicketData = null;

document.addEventListener('DOMContentLoaded', () => {
  initMiniMap();
  setupDropzone();
  
  // Check URL params for ticket tracking
  const urlParams = new URLSearchParams(window.location.search);
  const trackId = urlParams.get('track');
  if (trackId) {
    switchTab('track');
    document.getElementById('track-id-input').value = trackId;
    searchTicket();
  }
});

const INDIA_BOUNDS = [[6.4, 68.0], [37.2, 97.5]];

// Initialize mini interactive map for pin-drop
function initMiniMap() {
  const defaultLat = 12.9716;
  const defaultLng = 77.5946;

  document.getElementById('lat-input').value = defaultLat.toFixed(5);
  document.getElementById('lng-input').value = defaultLng.toFixed(5);

  miniMap = L.map('mini-map', {
    zoomControl: false,
    maxBounds: INDIA_BOUNDS,
    maxBoundsViscosity: 1.0,
    minZoom: 4
  }).setView([defaultLat, defaultLng], 14);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19
  }).addTo(miniMap);

  marker = L.marker([defaultLat, defaultLng], {
    draggable: true
  }).addTo(miniMap);

  marker.on('dragend', function (e) {
    const pos = marker.getLatLng();
    document.getElementById('lat-input').value = pos.lat.toFixed(5);
    document.getElementById('lng-input').value = pos.lng.toFixed(5);
  });

  miniMap.on('click', function (e) {
    marker.setLatLng(e.latlng);
    document.getElementById('lat-input').value = e.latlng.lat.toFixed(5);
    document.getElementById('lng-input').value = e.latlng.lng.toFixed(5);
  });

  // Add listeners to input boxes
  document.getElementById('lat-input').addEventListener('change', updateMarkerFromInputs);
  document.getElementById('lng-input').addEventListener('change', updateMarkerFromInputs);
}

function updateMarkerFromInputs() {
  const lat = parseFloat(document.getElementById('lat-input').value);
  const lng = parseFloat(document.getElementById('lng-input').value);
  if (!isNaN(lat) && !isNaN(lng) && marker && miniMap) {
    marker.setLatLng([lat, lng]);
    miniMap.setView([lat, lng], miniMap.getZoom());
  }
}

// Browser Geolocation Detection
function detectGPSLocation() {
  const statusBadge = document.getElementById('geo-status');
  const statusText = document.getElementById('geo-status-text');

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  statusBadge.style.display = 'inline-flex';
  statusText.textContent = 'Acquiring GPS fix...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      document.getElementById('lat-input').value = lat.toFixed(5);
      document.getElementById('lng-input').value = lng.toFixed(5);

      if (marker && miniMap) {
        marker.setLatLng([lat, lng]);
        miniMap.setView([lat, lng], 16);
      }

      statusText.textContent = `GPS Locked (±${Math.round(position.coords.accuracy)}m)`;
      statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      statusBadge.style.color = '#34d399';
    },
    (err) => {
      console.warn('Geolocation error:', err);
      statusText.textContent = 'Manual pin drop active';
      statusBadge.style.background = 'rgba(234, 179, 8, 0.15)';
      statusBadge.style.color = '#fbbf24';
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// File dropzone & preview
function setupDropzone() {
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  });
}

function handleFileSelect(event) {
  if (event.target.files && event.target.files[0]) {
    processFile(event.target.files[0]);
  }
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file (JPG, PNG, WEBP).');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-box').style.display = 'block';
    document.getElementById('dropzone').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function clearSelectedFile() {
  selectedFile = null;
  document.getElementById('image-file').value = '';
  document.getElementById('preview-box').style.display = 'none';
  document.getElementById('dropzone').style.display = 'block';
}

// Form Submission & AI Inference Orchestration
document.getElementById('citizen-report-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!selectedFile) {
    alert('Please capture or upload an image of the civic issue.');
    return;
  }

  const lat = parseFloat(document.getElementById('lat-input').value);
  const lng = parseFloat(document.getElementById('lng-input').value);
  const phone = document.getElementById('citizen-phone').value.trim();
  const name = document.getElementById('citizen-name').value.trim();
  const description = document.getElementById('description-input').value.trim();

  const submitBtn = document.getElementById('submit-report-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>⏳</span> Analyzing Photo with YOLO & Geo Engine...`;

  try {
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('latitude', lat);
    formData.append('longitude', lng);
    if (phone) formData.append('citizen_phone', phone);
    if (name) formData.append('citizen_name', name);
    if (description) formData.append('description', description);

    const response = await fetch(`${API_BASE}/incidents/report`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to analyze and create report');
    }

    const result = await response.json();
    currentTicketData = result;
    displayAIAnalysisResult(result);

  } catch (error) {
    console.error('Submission error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>🚀</span> Run AI Analysis & Submit Report`;
  }
});

function displayAIAnalysisResult(data) {
  document.getElementById('report-form-container').style.display = 'none';
  const resultBox = document.getElementById('report-result-box');
  resultBox.style.display = 'block';

  // Populate Result Fields
  document.getElementById('result-ticket-id').textContent = `SWV-${String(data.id).padStart(5, '0')}`;
  document.getElementById('result-status-badge').textContent = data.status || 'REPORTED';
  document.getElementById('result-address').textContent = data.address || `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;

  // Severity styling
  const severityPill = document.getElementById('result-severity-pill');
  const score = Math.round(data.severity_score || 0);
  const tier = (data.severity_tier || 'MEDIUM').toUpperCase();

  let bgColor = '#10b981';
  let textColor = '#ffffff';
  if (tier === 'CRITICAL') {
    bgColor = '#ef4444';
  } else if (tier === 'HIGH') {
    bgColor = '#f97316';
  } else if (tier === 'MEDIUM') {
    bgColor = '#eab308';
    textColor = '#111827';
  }

  severityPill.style.background = bgColor;
  severityPill.style.color = textColor;
  severityPill.textContent = `${tier} SEVERITY (${score}/100)`;

  // Breakdown details
  document.getElementById('result-issue-type').textContent = formatIssueName(data.issue_type);
  const confPct = Math.round((data.ai_confidence || 0.9) * 100);
  document.getElementById('result-confidence').textContent = `AI Confidence: ${confPct}%`;

  const extentScore = data.extent_score || 3;
  document.getElementById('result-extent').textContent = `Score ${extentScore}/5`;

  const locScore = data.location_impact_score || 3;
  document.getElementById('result-location-impact').textContent = `Impact ${locScore}/5`;
  document.getElementById('result-poi-note').textContent = getPoiImpactLabel(locScore);

  document.getElementById('result-department').textContent = data.department_name || 'Sanitation Dept';
}

function formatIssueName(type) {
  if (!type) return 'Garbage Accumulation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getPoiImpactLabel(score) {
  switch (score) {
    case 5: return 'High Risk: Near Drain / Water Body';
    case 4: return 'High Sensitivity: Near School / Hospital';
    case 3: return 'Moderate: Arterial / Major Road';
    case 2: return 'Standard: Residential Area';
    default: return 'Low Traffic / Isolated';
  }
}

function resetReportForm() {
  clearSelectedFile();
  document.getElementById('description-input').value = '';
  document.getElementById('report-result-box').style.display = 'none';
  document.getElementById('report-form-container').style.display = 'block';
  switchTab('report');
}

function viewTicketInTracker() {
  if (currentTicketData) {
    switchTab('track');
    document.getElementById('track-id-input').value = currentTicketData.id;
    searchTicket();
  }
}

// Tab Switching
function switchTab(tab) {
  const reportTabBtn = document.getElementById('tab-report-btn');
  const trackTabBtn = document.getElementById('tab-track-btn');
  const reportSection = document.getElementById('section-report');
  const trackSection = document.getElementById('section-track');

  if (tab === 'report') {
    reportTabBtn.classList.add('active');
    trackTabBtn.classList.remove('active');
    reportSection.style.display = 'block';
    trackSection.style.display = 'none';
    if (miniMap) setTimeout(() => miniMap.invalidateSize(), 200);
  } else {
    trackTabBtn.classList.add('active');
    reportTabBtn.classList.remove('active');
    trackSection.style.display = 'block';
    reportSection.style.display = 'none';
  }
}

// Search and Track Ticket
async function searchTicket() {
  const rawInput = document.getElementById('track-id-input').value.trim();
  if (!rawInput) {
    alert('Please enter a valid ticket number.');
    return;
  }

  // Extract digits
  const ticketId = rawInput.replace(/\D/g, '');
  if (!ticketId) {
    alert('Invalid Ticket ID format. Please enter a number.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/incidents/${ticketId}`);
    if (!res.ok) {
      throw new Error('Ticket not found in the municipal registry.');
    }

    const data = await res.json();
    renderTrackedIncident(data);

  } catch (err) {
    alert(err.message);
  }
}

function renderTrackedIncident(data) {
  document.getElementById('track-result-container').style.display = 'block';
  document.getElementById('track-issue-title').textContent = `${formatIssueName(data.issue_type)} (#SWV-${String(data.id).padStart(5, '0')})`;
  document.getElementById('track-address-text').textContent = data.address || `${data.latitude}, ${data.longitude}`;
  document.getElementById('track-dept-text').textContent = data.department_name || 'Sanitation Dept';
  document.getElementById('track-time-text').textContent = new Date(data.created_at).toLocaleString();

  // Status Badge
  const sevBadge = document.getElementById('track-severity-badge');
  const tier = (data.severity_tier || 'MEDIUM').toLowerCase();
  sevBadge.className = `badge-severity severity-${tier}`;
  sevBadge.textContent = `${(data.severity_tier || 'MEDIUM').toUpperCase()} (${Math.round(data.severity_score || 0)}/100)`;

  // Image Preview
  if (data.before_image_url) {
    document.getElementById('track-image-preview').src = data.before_image_url;
  }

  // Update Stepper
  const status = (data.status || 'REPORTED').toLowerCase();
  const steps = ['reported', 'assigned', 'in_progress', 'resolved', 'verified'];
  const currentIndex = steps.indexOf(status) !== -1 ? steps.indexOf(status) : 0;

  steps.forEach((step, idx) => {
    const el = document.getElementById(`step-${step}`);
    if (!el) return;
    el.classList.remove('active', 'completed');
    if (idx < currentIndex) {
      el.classList.add('completed');
    } else if (idx === currentIndex) {
      el.classList.add('active');
    }
  });
}
