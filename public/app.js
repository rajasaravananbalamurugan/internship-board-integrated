/**
 * Internship Board — public/app.js
 * Vanilla JS, accessible, mobile-first frontend.
 * Features:
 *  - Loads /api/internships with loading, error (retry), empty states
 *  - Live search (180ms debounce) + Domain and Mode dropdown filters
 *  - Accessible Detail Modal (<dialog>) with keyboard trap
 *  - Accessible Application Submission Modal (<dialog>) with HTML5 + JS validation,
 *    loading spinner, inline error handling, and duplicate application feedback
 */

(function () {
  'use strict';

  /* ── DOM Elements ────────────────────────────────────────── */
  const grid        = document.getElementById('internship-grid');
  const searchInput = document.getElementById('search-input');
  const domainSel   = document.getElementById('domain-filter');
  const modeSel     = document.getElementById('mode-filter');
  const resetBtn    = document.getElementById('reset-btn');
  const emptyReset  = document.getElementById('empty-reset-btn');
  const retryBtn    = document.getElementById('retry-btn');
  const countEl     = document.getElementById('results-count');

  const stateLoading = document.getElementById('state-loading');
  const stateError   = document.getElementById('state-error');
  const stateEmpty   = document.getElementById('state-empty');
  const errorMsg     = document.getElementById('error-message');

  // Detail Modal Elements
  const detailModal        = document.getElementById('detail-modal');
  const modalClose         = document.getElementById('modal-close');
  const modalCloseBot      = document.getElementById('modal-close-bottom');
  const modalId            = document.getElementById('modal-id');
  const modalTitle         = document.getElementById('modal-title');
  const modalDomain        = document.getElementById('modal-domain');
  const modalMode          = document.getElementById('modal-mode');
  const modalLocation      = document.getElementById('modal-location');
  const modalOpenings      = document.getElementById('modal-openings');
  const modalSkills        = document.getElementById('modal-skills');
  const modalApplyTrigger  = document.getElementById('modal-apply-trigger');

  // Application Modal Elements
  const applyModal         = document.getElementById('apply-modal');
  const applyCloseIcon     = document.getElementById('apply-close-icon');
  const applyCancelBtn     = document.getElementById('apply-cancel-btn');
  const applyForm          = document.getElementById('apply-form');
  const applyRoleId        = document.getElementById('apply-role-id');
  const applyModalTitle    = document.getElementById('apply-modal-title');
  const applyInternshipId  = document.getElementById('apply-internship-id');
  const applicantName      = document.getElementById('applicant-name');
  const applicantEmail     = document.getElementById('applicant-email');
  const portfolioUrl       = document.getElementById('portfolio-url');
  const coverNote          = document.getElementById('cover-note');
  const applySubmitBtn     = document.getElementById('apply-submit-btn');
  const applyAlertError    = document.getElementById('apply-alert-error');
  const applyAlertSuccess  = document.getElementById('apply-alert-success');
  const nameError          = document.getElementById('name-error');
  const emailError         = document.getElementById('email-error');
  const portfolioError     = document.getElementById('portfolio-error');

  /* ── State ──────────────────────────────────────────────── */
  let allInternships = [];
  let currentInternship = null;
  let lastFocusedEl = null;

  /* ── SVG Icons ──────────────────────────────────────────── */
  const svgLocation = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5A4.5 4.5 0 0 0 8 1.5Z" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.4"/>
  </svg>`;

  const svgDomain = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
    <line x1="4" y1="7" x2="8" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    <line x1="4" y1="9.5" x2="6.5" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

  /* ── Utilities ──────────────────────────────────────────── */
  function showState(name) {
    stateLoading.hidden = name !== 'loading';
    stateError.hidden   = name !== 'error';
    stateEmpty.hidden   = name !== 'empty';
    grid.hidden         = name === 'loading' || name === 'error' || name === 'empty';
  }

  function updateCount(count, total) {
    if (total === 0) {
      countEl.textContent = '';
      return;
    }
    countEl.textContent = count === total
      ? `${total} internship${total !== 1 ? 's' : ''}`
      : `${count} of ${total} internship${total !== 1 ? 's' : ''} shown`;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Build Card Element ─────────────────────────────────── */
  function buildCard(item) {
    const li = document.createElement('li');
    li.className = 'card';
    li.setAttribute('role', 'article');
    li.setAttribute('data-id', item.id);

    const modeClass = `mode--${item.mode.replace(/\s+/g, '-')}`;

    const skillBadges = (item.skills || [])
      .map(s => `<span class="skill-badge">${esc(s)}</span>`)
      .join('');

    li.innerHTML = `
      <div class="card-top">
        <span class="card-id">${esc(item.id)}</span>
        <span class="card-mode ${modeClass}">${esc(item.mode)}</span>
      </div>
      <h2 class="card-title">${esc(item.title)}</h2>
      <div class="card-meta">
        <span class="card-meta-item">
          ${svgDomain}
          <span>${esc(item.domain)}</span>
        </span>
        <span class="card-meta-item">
          ${svgLocation}
          <span>${esc(item.location)}</span>
        </span>
      </div>
      <div class="card-skills" aria-label="Required skills">${skillBadges}</div>
      <div class="card-footer">
        <span class="card-openings">
          <strong>${esc(String(item.openings))}</strong> opening${item.openings !== 1 ? 's' : ''}
        </span>
        <div style="display: flex; gap: 8px;">
          <button
            type="button"
            class="btn btn--ghost card-btn card-view-btn"
            aria-label="View details for ${esc(item.title)} (${esc(item.id)})"
            data-id="${esc(item.id)}"
          >
            Details
          </button>
          <button
            type="button"
            class="btn btn--primary card-btn card-apply-btn"
            aria-label="Apply for ${esc(item.title)} (${esc(item.id)})"
            data-id="${esc(item.id)}"
          >
            Apply
          </button>
        </div>
      </div>
    `;

    return li;
  }

  /* ── Render Cards ───────────────────────────────────────── */
  function renderCards(list) {
    grid.innerHTML = '';
    if (list.length === 0) {
      showState('empty');
      updateCount(0, allInternships.length);
      return;
    }

    showState('grid');
    const fragment = document.createDocumentFragment();
    list.forEach(item => fragment.appendChild(buildCard(item)));
    grid.appendChild(fragment);
    updateCount(list.length, allInternships.length);
  }

  /* ── Filtering Logic ────────────────────────────────────── */
  function applyFilters() {
    const q      = searchInput.value.trim().toLowerCase();
    const domain = domainSel.value;
    const mode   = modeSel.value;

    const filtered = allInternships.filter(item => {
      if (domain && item.domain !== domain) return false;
      if (mode && item.mode !== mode) return false;
      if (!q) return true;

      const titleMatch    = item.title.toLowerCase().includes(q);
      const locationMatch = item.location.toLowerCase().includes(q);
      const skillMatch    = Array.isArray(item.skills) && item.skills.some(s => s.toLowerCase().includes(q));

      return titleMatch || locationMatch || skillMatch;
    });

    renderCards(filtered);
  }

  function resetFilters() {
    searchInput.value = '';
    domainSel.value   = '';
    modeSel.value     = '';
    renderCards(allInternships);
    searchInput.focus();
  }

  /* ── Detail Modal ───────────────────────────────────────── */
  function openDetailModal(id) {
    const item = allInternships.find(i => i.id === id);
    if (!item) return;

    currentInternship = item;
    lastFocusedEl = document.activeElement;

    modalId.textContent       = item.id;
    modalTitle.textContent    = item.title;
    modalDomain.textContent   = item.domain;
    modalMode.textContent     = item.mode;
    modalLocation.textContent = item.location;
    modalOpenings.textContent = `${item.openings} open position${item.openings !== 1 ? 's' : ''}`;

    modalSkills.innerHTML = (item.skills || [])
      .map(s => `<span class="skill-badge">${esc(s)}</span>`)
      .join('');

    detailModal.showModal();
    modalClose.focus();
  }

  function closeDetailModal() {
    if (detailModal.open) {
      detailModal.close();
      if (lastFocusedEl) {
        lastFocusedEl.focus();
      }
    }
  }

  /* ── Application Modal ──────────────────────────────────── */
  function openApplyModal(id) {
    const item = allInternships.find(i => i.id === id);
    if (!item) return;

    currentInternship = item;
    lastFocusedEl = document.activeElement;

    if (detailModal.open) {
      detailModal.close();
    }

    // Set header info
    applyRoleId.textContent = item.id;
    applyModalTitle.textContent = `Apply for ${item.title}`;
    applyInternshipId.value = item.id;

    // Reset form states
    resetApplyForm();

    applyModal.showModal();
    applicantName.focus();
  }

  function closeApplyModal() {
    if (applyModal.open) {
      applyModal.close();
      if (lastFocusedEl) {
        lastFocusedEl.focus();
      }
    }
  }

  function resetApplyForm() {
    applyForm.reset();
    applyAlertError.hidden = true;
    applyAlertError.textContent = '';
    applyAlertSuccess.hidden = true;
    applyAlertSuccess.textContent = '';
    clearFieldErrors();
    setSubmitting(false);
  }

  function clearFieldErrors() {
    nameError.textContent = '';
    emailError.textContent = '';
    portfolioError.textContent = '';
    applicantName.classList.remove('has-error');
    applicantEmail.classList.remove('has-error');
    portfolioUrl.classList.remove('has-error');
  }

  function setSubmitting(isSubmitting) {
    applySubmitBtn.disabled = isSubmitting;
    const btnText = applySubmitBtn.querySelector('.btn-text');
    const btnSpinner = applySubmitBtn.querySelector('.btn-spinner');

    if (btnText) btnText.textContent = isSubmitting ? 'Submitting Application…' : 'Submit Application';
    if (btnSpinner) btnSpinner.hidden = !isSubmitting;
  }

  /* ── Client Validation for Application Form ─────────────── */
  function validateClientForm() {
    clearFieldErrors();
    let isValid = true;
    let firstInvalid = null;

    // 1. Name validation
    const nameVal = applicantName.value.trim();
    if (!nameVal) {
      nameError.textContent = 'Please enter your full name.';
      applicantName.classList.add('has-error');
      isValid = false;
      if (!firstInvalid) firstInvalid = applicantName;
    } else if (nameVal.length < 2) {
      nameError.textContent = 'Name must be at least 2 characters.';
      applicantName.classList.add('has-error');
      isValid = false;
      if (!firstInvalid) firstInvalid = applicantName;
    }

    // 2. Email validation
    const emailVal = applicantEmail.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal) {
      emailError.textContent = 'Please enter your email address.';
      applicantEmail.classList.add('has-error');
      isValid = false;
      if (!firstInvalid) firstInvalid = applicantEmail;
    } else if (!emailRegex.test(emailVal)) {
      emailError.textContent = 'Please enter a valid email address (e.g. name@example.com).';
      applicantEmail.classList.add('has-error');
      isValid = false;
      if (!firstInvalid) firstInvalid = applicantEmail;
    }

    // 3. Portfolio URL validation
    const urlVal = portfolioUrl.value.trim();
    if (!urlVal) {
      portfolioError.textContent = 'Please enter your portfolio or GitHub URL.';
      portfolioUrl.classList.add('has-error');
      isValid = false;
      if (!firstInvalid) firstInvalid = portfolioUrl;
    } else {
      try {
        const parsed = new URL(urlVal);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          portfolioError.textContent = 'URL must start with http:// or https://';
          portfolioUrl.classList.add('has-error');
          isValid = false;
          if (!firstInvalid) firstInvalid = portfolioUrl;
        }
      } catch (e) {
        portfolioError.textContent = 'Please enter a valid URL (e.g. https://github.com/yourname).';
        portfolioUrl.classList.add('has-error');
        isValid = false;
        if (!firstInvalid) firstInvalid = portfolioUrl;
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
    }

    return isValid;
  }

  /* ── Submit Application Handler ─────────────────────────── */
  async function handleApplicationSubmit(e) {
    e.preventDefault();
    applyAlertError.hidden = true;
    applyAlertSuccess.hidden = true;

    if (!validateClientForm()) {
      return;
    }

    const payload = {
      internship_id: applyInternshipId.value,
      applicant_name: applicantName.value.trim(),
      applicant_email: applicantEmail.value.trim(),
      portfolio_url: portfolioUrl.value.trim(),
      cover_note: coverNote.value.trim()
    };

    setSubmitting(true);

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 201 && data.status === 'success') {
        // Success State
        applyAlertSuccess.hidden = false;
        applyAlertSuccess.innerHTML = `
          <strong>🎉 Application submitted successfully!</strong><br />
          Application reference: <code>${esc(data.data.id)}</code>.<br />
          Thank you for applying, ${esc(data.data.applicant_name)}.
        `;
        applyForm.reset();
        clearFieldErrors();
        applySubmitBtn.disabled = true;
        const btnText = applySubmitBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'Submitted!';
      } else if (res.status === 409) {
        // Duplicate Application
        applyAlertError.hidden = false;
        applyAlertError.textContent = data.message || 'You have already applied for this internship with this email address.';
        applicantEmail.focus();
      } else if (res.status === 400 && data.errors && Array.isArray(data.errors)) {
        // Validation Errors from Server
        applyAlertError.hidden = false;
        const errList = data.errors.map(err => `• ${esc(err.message)}`).join('<br/>');
        applyAlertError.innerHTML = `<strong>Submission errors:</strong><br/>${errList}`;
      } else {
        // General Error
        applyAlertError.hidden = false;
        applyAlertError.textContent = data.message || 'Failed to submit application. Please check your information.';
      }
    } catch (err) {
      applyAlertError.hidden = false;
      applyAlertError.textContent = `Network error: Could not reach the server. Please try again. (${err.message})`;
    } finally {
      const btnText = applySubmitBtn.querySelector('.btn-text');
      if (btnText && btnText.textContent !== 'Submitted!') {
        setSubmitting(false);
      }
    }
  }

  /* ── Modal Focus Trap ───────────────────────────────────── */
  function trapFocus(modal, e) {
    if (!modal.open) return;

    const focusable = Array.from(
      modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ── Fetch Data from Backend API ────────────────────────── */
  async function loadInternships() {
    showState('loading');
    grid.innerHTML = '';
    countEl.textContent = '';

    try {
      const res = await fetch('/api/internships?limit=100');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const body = await res.json();

      if (!body || body.status !== 'success' || !Array.isArray(body.data)) {
        throw new Error('Invalid response structure received from API.');
      }

      allInternships = body.data;
      renderCards(allInternships);
    } catch (err) {
      showState('error');
      errorMsg.textContent = `Failed to load internships: ${err.message}`;
      countEl.textContent  = '';
    }
  }

  /* ── Event Listeners ────────────────────────────────────── */

  // Search input debounce (180ms)
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 180);
  });

  // Filter dropdowns
  domainSel.addEventListener('change', applyFilters);
  modeSel.addEventListener('change', applyFilters);

  // Reset buttons
  resetBtn.addEventListener('click', resetFilters);
  emptyReset.addEventListener('click', resetFilters);

  // Retry button in error state
  retryBtn.addEventListener('click', loadInternships);

  // Grid Delegation for Card buttons
  grid.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.card-view-btn');
    if (viewBtn) {
      const id = viewBtn.getAttribute('data-id');
      openDetailModal(id);
      return;
    }

    const applyBtn = e.target.closest('.card-apply-btn');
    if (applyBtn) {
      const id = applyBtn.getAttribute('data-id');
      openApplyModal(id);
      return;
    }
  });

  // Detail Modal Events
  modalClose.addEventListener('click', closeDetailModal);
  modalCloseBot.addEventListener('click', closeDetailModal);
  detailModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailModal();
    if (e.key === 'Tab') trapFocus(detailModal, e);
  });
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });

  modalApplyTrigger.addEventListener('click', () => {
    if (currentInternship) {
      openApplyModal(currentInternship.id);
    }
  });

  // Application Modal Events
  applyCloseIcon.addEventListener('click', closeApplyModal);
  applyCancelBtn.addEventListener('click', closeApplyModal);
  applyModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeApplyModal();
    if (e.key === 'Tab') trapFocus(applyModal, e);
  });
  applyModal.addEventListener('click', (e) => {
    if (e.target === applyModal) closeApplyModal();
  });

  // Form Submit Event
  applyForm.addEventListener('submit', handleApplicationSubmit);

  /* ── Boot ───────────────────────────────────────────────── */
  loadInternships();

})();
