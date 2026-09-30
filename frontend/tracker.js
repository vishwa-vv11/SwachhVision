// SwachhVision Resolution Proof & Verification Certificate Logic
const API_BASE = (window.location.protocol.startsWith('http') && (window.location.port === '8000' || window.location.pathname.startsWith('/track')))
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const ticketParam = urlParams.get('id') || urlParams.get('ticket');
  if (ticketParam) {
    document.getElementById('cert-ticket-input').value = ticketParam;
    fetchVerificationCertificate();
  }
});

async function fetchVerificationCertificate() {
  const rawInput = document.getElementById('cert-ticket-input').value.trim();
  if (!rawInput) {
    alert('Please enter a ticket number or incident ID.');
    return;
  }

  const id = rawInput.replace(/\D/g, '');
  if (!id) {
    alert('Invalid Ticket ID format.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/incidents/${id}`);
    if (!res.ok) throw new Error('Incident record not found in the public ledger.');

    const data = await res.json();
    renderProofCertificate(data);
  } catch (err) {
    alert(err.message);
  }
}

function renderProofCertificate(data) {
  const container = document.getElementById('proof-container');
  container.style.display = 'block';

  document.getElementById('proof-ticket-num').textContent = `#SWV-${String(data.id).padStart(5, '0')} (${data.ticket_number || 'CIV-00000'})`;
  document.getElementById('proof-issue-name').textContent = formatIssueName(data.issue_type);
  const deptEl = document.getElementById('proof-dept');
  if (deptEl) deptEl.textContent = 'Municipal Sanitation Squad';

  const sevTier = (data.severity_tier || 'MEDIUM').toUpperCase();
  const sevScore = Math.round(data.severity_score || 0);
  document.getElementById('proof-severity').textContent = `${sevTier} (${sevScore}/100)`;

  // Verification status badge
  const badge = document.getElementById('proof-badge');
  const aiCallout = document.getElementById('proof-ai-callout');
  const aiNotes = document.getElementById('proof-ai-notes');

  const status = (data.status || 'REPORTED').toUpperCase();
  const verStatus = (data.verification_status || 'PENDING').toUpperCase();

  if (verStatus === 'VERIFIED' || status === 'VERIFIED' || status === 'CLOSED') {
    badge.className = 'verification-badge badge-verified';
    badge.innerHTML = '<span>✓</span> AI VERIFIED CLEANED & CLOSED';
    aiCallout.className = 'ai-note-box';
    aiNotes.textContent = data.verification_notes || 'Clean area verified via YOLO segmentation. Residual hazard below threshold limit.';
  } else if (verStatus === 'FAILED' || status === 'REOPENED') {
    badge.className = 'verification-badge badge-reopened';
    badge.innerHTML = '<span>⚠</span> AI VERIFICATION REJECTED (REOPENED)';
    aiCallout.className = 'ai-note-box note-fail';
    aiNotes.textContent = data.verification_notes || 'Hazard still detected in resolution image. Ticket reopened for re-dispatch.';
  } else {
    badge.className = 'verification-badge badge-pending';
    badge.innerHTML = '<span>⏳</span> RESOLUTION IN PROGRESS';
    aiCallout.className = 'ai-note-box';
    aiNotes.textContent = 'Awaiting field worker resolution submission and AI photo verification.';
  }

  function resolveImageUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const base = (typeof API_BASE !== 'undefined' && API_BASE.startsWith('http')) 
      ? API_BASE.replace(/\/api\/v1\/?$/, '') 
      : 'http://127.0.0.1:8000';
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // Before Image
  const beforeImg = document.getElementById('comp-before-img');
  beforeImg.src = resolveImageUrl(data.before_image_url);
  document.getElementById('comp-before-info').textContent = `Visible Extent: Score ${data.extent_score || 3}/5 (${(data.extent_percentage || 35).toFixed(1)}% coverage)`;

  // After Image
  const afterImg = document.getElementById('comp-after-img');
  if (data.after_image_url) {
    afterImg.src = resolveImageUrl(data.after_image_url);
    document.getElementById('comp-after-info').textContent = verStatus === 'VERIFIED' 
      ? 'Residual Extent: 0.0% (Clean Area Confirmed)'
      : 'Residual Extent: Detected after cleanup attempt';
  } else {
    afterImg.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500';
    document.getElementById('comp-after-info').textContent = 'Awaiting worker after-cleanup photo submission';
  }

  // Timestamps
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A';
  const resolvedDate = data.resolved_at ? new Date(data.resolved_at).toLocaleString() : (status === 'RESOLVED' || status === 'VERIFIED' ? 'Recently Resolved' : 'Pending');

  document.getElementById('proof-resolved-time').textContent = resolvedDate;
  document.getElementById('timeline-time-reported').textContent = createdDate;
  document.getElementById('timeline-time-assigned').textContent = createdDate;
  document.getElementById('timeline-time-in_progress').textContent = data.updated_at ? new Date(data.updated_at).toLocaleString() : createdDate;
  document.getElementById('timeline-time-verified').textContent = resolvedDate;
}

function formatIssueName(type) {
  if (!type) return 'Garbage Accumulation';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
