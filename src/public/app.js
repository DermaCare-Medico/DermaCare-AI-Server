/**
 * DermaCare AI — Developer API Portal Application Logic
 * Powered by OpenAPI 3.0.3 Contract Inventory
 */

(function () {
  'use strict';

  // State Management
  let inventory = null;
  let activeEndpointId = null;
  let activeMethodFilter = 'ALL';
  let activeSearchTerm = '';
  let selectedCodeLanguage = 'curl';
  let currentEnvironment = 'http://localhost:4000/api/v1';

  // DOM Elements
  const modulesTreeContainer = document.getElementById('modulesTreeContainer');
  const docsMainContent = document.getElementById('docsMainContent');
  const sidebarSearchInput = document.getElementById('sidebarSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const methodFilterPills = document.getElementById('methodFilterPills');
  const serverEnvSelect = document.getElementById('serverEnvSelect');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const globalSearchTrigger = document.getElementById('globalSearchTrigger');
  const searchModalBackdrop = document.getElementById('searchModalBackdrop');
  const modalSearchInput = document.getElementById('modalSearchInput');
  const modalSearchResults = document.getElementById('modalSearchResults');
  const toastContainer = document.getElementById('toastContainer');

  // Initialize
  async function init() {
    setupTheme();
    setupEventListeners();
    await loadInventory();
    handleRoute();
  }

  // Theme Support
  function setupTheme() {
    const savedTheme = localStorage.getItem('dermacare_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('dermacare_theme', next);
    });
  }

  // Fetch Inventory
  async function loadInventory() {
    try {
      const response = await fetch('/inventory.json');
      if (!response.ok) throw new Error('Failed to load inventory.json');
      inventory = await response.json();
      renderSidebar();
    } catch (err) {
      console.error('Inventory load error:', err);
      modulesTreeContainer.innerHTML = `<div class="sidebar-loader" style="color:#ef4444;">Failed to load endpoints inventory.</div>`;
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Window Hash Change
    window.addEventListener('hashchange', handleRoute);

    // Environment Change
    serverEnvSelect.addEventListener('change', (e) => {
      currentEnvironment = e.target.value;
      if (activeEndpointId) renderEndpointDetail(activeEndpointId);
    });

    // Sidebar Search Input
    sidebarSearchInput.addEventListener('input', (e) => {
      activeSearchTerm = e.target.value.trim().toLowerCase();
      clearSearchBtn.style.display = activeSearchTerm ? 'flex' : 'none';
      renderSidebar();
    });

    clearSearchBtn.addEventListener('click', () => {
      sidebarSearchInput.value = '';
      activeSearchTerm = '';
      clearSearchBtn.style.display = 'none';
      renderSidebar();
    });

    // Method Filter Pills
    methodFilterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMethodFilter = btn.dataset.method;
      renderSidebar();
    });

    // Global Search Modal Trigger
    globalSearchTrigger.addEventListener('click', openSearchModal);

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape' && searchModalBackdrop.style.display !== 'none') {
        closeSearchModal();
      }
    });

    searchModalBackdrop.addEventListener('click', (e) => {
      if (e.target === searchModalBackdrop) closeSearchModal();
    });

    modalSearchInput.addEventListener('input', handleModalSearch);
  }

  // Render Sidebar Tree
  function renderSidebar() {
    if (!inventory) return;

    let html = '';

    inventory.modules.forEach(mod => {
      let eps = inventory.endpoints.filter(e => e.moduleNumber === mod.number);

      // Filter by Method
      if (activeMethodFilter !== 'ALL') {
        eps = eps.filter(e => e.method === activeMethodFilter);
      }

      // Filter by Search Term
      if (activeSearchTerm) {
        eps = eps.filter(e =>
          e.summary.toLowerCase().includes(activeSearchTerm) ||
          e.path.toLowerCase().includes(activeSearchTerm) ||
          e.method.toLowerCase().includes(activeSearchTerm)
        );
      }

      if (eps.length === 0 && (activeSearchTerm || activeMethodFilter !== 'ALL')) {
        return; // Skip empty groups during filtering
      }

      const isOpen = activeSearchTerm || (activeEndpointId && eps.some(e => e.id === activeEndpointId));

      html += `
        <div class="module-group ${isOpen ? 'open' : ''}" data-module="${mod.number}">
          <button class="module-header" onclick="window.toggleModuleGroup('${mod.number}')">
            <div class="module-header-left">
              <svg class="module-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span class="module-title-text">${mod.number}. ${escapeHtml(mod.name)}</span>
            </div>
            <span class="module-count">${eps.length}</span>
          </button>
          <div class="module-endpoints-list">
            ${eps.map(ep => `
              <a href="#/endpoint/${ep.id}" class="endpoint-nav-item ${ep.id === activeEndpointId ? 'active' : ''}" data-id="${ep.id}">
                <span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span>
                <span class="endpoint-nav-path" title="${ep.path}">${escapeHtml(ep.path)}</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    });

    if (!html) {
      html = `<div style="padding:16px 10px; color:var(--text-muted); font-size:12px;">No endpoints match the current filter.</div>`;
    }

    modulesTreeContainer.innerHTML = html;
  }

  window.toggleModuleGroup = function (modNum) {
    const el = document.querySelector(`.module-group[data-module="${modNum}"]`);
    if (el) el.classList.toggle('open');
  };

  // Route Handler
  function handleRoute() {
    const hash = window.location.hash || '#overview';

    // Clear active states on static links
    document.querySelectorAll('.guide-list .nav-item').forEach(el => el.classList.remove('active'));

    if (hash === '#overview' || hash === '') {
      activeEndpointId = null;
      setNavActive('overview');
      renderOverview();
    } else if (hash === '#getting-started') {
      activeEndpointId = null;
      setNavActive('getting-started');
      renderGettingStarted();
    } else if (hash === '#auth-rbac') {
      activeEndpointId = null;
      setNavActive('auth-rbac');
      renderAuthRbac();
    } else if (hash === '#clinical-safety') {
      activeEndpointId = null;
      setNavActive('clinical-safety');
      renderClinicalSafety();
    } else if (hash === '#contract-audit') {
      activeEndpointId = null;
      setNavActive('contract-audit');
      renderContractAudit();
    } else if (hash.startsWith('#/endpoint/')) {
      const id = parseInt(hash.replace('#/endpoint/', ''), 10);
      if (!isNaN(id)) {
        activeEndpointId = id;
        renderEndpointDetail(id);
      }
    }

    renderSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setNavActive(target) {
    const el = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (el) el.classList.add('active');
  }

  // ==========================================================================
  // Overview View
  // ==========================================================================
  function renderOverview() {
    if (!inventory) return;

    docsMainContent.innerHTML = `
      <div class="overview-page">
        <div class="hero-banner">
          <h1 class="hero-title">DermaCare AI — API Reference & Developer Portal</h1>
          <p class="hero-subtitle">
            A comprehensive, high-security clinical REST API platform powering preliminary AI skin screening,
            telemedicine video consultations, immutable digital prescriptions, pharmacy ordering, and sandbox payments.
          </p>
        </div>

        <!-- Metrics Dashboard -->
        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-val teal">84</span>
            <span class="metric-label">Proposed REST Endpoints</span>
            <span class="metric-sub">Complete MVP contract inventory</span>
          </div>
          <div class="metric-card">
            <span class="metric-val">16</span>
            <span class="metric-label">Functional Modules</span>
            <span class="metric-sub">Clinical, store & governance domains</span>
          </div>
          <div class="metric-card">
            <span class="metric-val emerald">3</span>
            <span class="metric-label">Scoped User Roles</span>
            <span class="metric-sub">Patient, Doctor, Administrator</span>
          </div>
          <div class="metric-card">
            <span class="metric-val amber">84</span>
            <span class="metric-label">Specified in Repository</span>
            <span class="metric-sub">0 implemented in active routes</span>
          </div>
        </div>

        <!-- Contract Status Alert -->
        <div class="contract-alert warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <div class="alert-heading">Proposed Contract Specification Notice</div>
            This developer portal faithfully documents the <strong>84 proposed REST API operations</strong> from the <em>DermaCare AI Optimized MVP Specification</em>.
            As established by our repository audit, <strong>all 84 endpoints are currently specified but not yet implemented in backend routes</strong>.
            The interactive console executes realistic simulations with strict contract headers (<code>X-Contract-Status: Specified-Not-Implemented</code>).
          </div>
        </div>

        <!-- Quick Access Module Cards -->
        <h2 class="doc-section-h2">Explore API Modules (16)</h2>
        <div class="modules-grid">
          ${inventory.modules.map(m => {
            const count = inventory.endpoints.filter(e => e.moduleNumber === m.number).length;
            const firstEp = inventory.endpoints.find(e => e.moduleNumber === m.number);
            return `
              <div class="module-card" onclick="location.hash='#/endpoint/${firstEp ? firstEp.id : 1}'">
                <div class="mod-card-top">
                  <span class="mod-badge">Module ${m.number}</span>
                  <span class="mod-count">${count} APIs</span>
                </div>
                <h3 class="mod-title">${escapeHtml(m.name)}</h3>
                <p class="mod-desc">${escapeHtml(m.description)}</p>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Core Healthcare Rules Callout -->
        <div class="guide-card">
          <h3 class="guide-card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Key Healthcare Safety & Architectural Guardrails
          </h3>
          <div class="guide-step">
            <div class="step-num">1</div>
            <div class="step-content">
              <h4>Preliminary AI Screenings</h4>
              <p>AI results are never definitive diagnoses. Confidence below 60% suppresses OTC care advice; risk above 20% triggers clinical urgency advisories; red flags override all scores.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">2</div>
            <div class="step-content">
              <h4>Atomic 10-Minute Appointment Holds</h4>
              <p>Slots are locked via unique constraints and atomic reservations for exactly 10 minutes to eliminate double bookings while payment and consent are verified.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">3</div>
            <div class="step-content">
              <h4>Immutable Prescription Versions</h4>
              <p>Finalizing a prescription freezes that legal version permanently. Any subsequent clinical amendments generate a new numbered version.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">4</div>
            <div class="step-content">
              <h4>Strict Separation of Sponsored Ads</h4>
              <p>Advertisements must be labeled "Sponsored" and MUST NEVER appear on AI results, emergency alerts, consultations, prescriptions, or post-consultation chats.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Getting Started View
  // ==========================================================================
  function renderGettingStarted() {
    docsMainContent.innerHTML = `
      <div class="overview-page">
        <div class="hero-banner">
          <h1 class="hero-title">Getting Started with DermaCare AI API</h1>
          <p class="hero-subtitle">
            Learn how to register identities, verify credentials, obtain JWT access tokens, and make authenticated clinical calls.
          </p>
        </div>

        <div class="guide-card">
          <h3 class="guide-card-title">API Authentication Lifecycle</h3>
          <div class="guide-step">
            <div class="step-num">1</div>
            <div class="step-content">
              <h4>1. Register Account</h4>
              <p>Call <code>POST /api/v1/auth/register</code> with user details and desired role (<code>PATIENT</code> or <code>DOCTOR</code>). An email OTP is dispatched.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">2</div>
            <div class="step-content">
              <h4>2. Verify Email OTP</h4>
              <p>Submit 6-digit OTP code to <code>POST /api/v1/auth/verify-otp</code>. Upon activation, access token and refresh token credentials are issued.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">3</div>
            <div class="step-content">
              <h4>3. Submit Doctor Medical License (Doctor accounts only)</h4>
              <p>Doctor accounts require medical license document submission via <code>POST /api/v1/doctors/me/license</code>. Account is reviewed and approved by Admin.</p>
            </div>
          </div>
          <div class="guide-step">
            <div class="step-num">4</div>
            <div class="step-content">
              <h4>4. Pass Authorization Header in Private Calls</h4>
              <p>Include the Bearer access token in standard HTTP headers: <code>Authorization: Bearer &lt;access_token&gt;</code>.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Auth & RBAC View
  // ==========================================================================
  function renderAuthRbac() {
    docsMainContent.innerHTML = `
      <div class="overview-page">
        <div class="hero-banner">
          <h1 class="hero-title">Authentication & Role-Based Access Control (RBAC)</h1>
          <p class="hero-subtitle">
            Zero-trust healthcare identity verification, session isolation, and token lifetime guarantees.
          </p>
        </div>

        <div class="schema-table-wrapper">
          <table class="schema-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Access Scope</th>
                <th>Permitted Key Modules</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="role-tag patient">PATIENT</span></td>
                <td>Self-owned medical data, private image uploads, bookings, cart & orders, chat with assigned doctor.</td>
                <td>01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 12, 13, 14</td>
              </tr>
              <tr>
                <td><span class="role-tag doctor">DOCTOR</span></td>
                <td>Verified availability schedule, consent-gated patient clinical histories, video consultations, prescription authoring.</td>
                <td>01, 02, 04, 05, 06, 07, 08, 10, 12, 13, 14</td>
              </tr>
              <tr>
                <td><span class="role-tag admin">ADMIN</span></td>
                <td>Global governance, doctor license verification, user suspensions, medicine catalog management, aggregated analytics, audit logs.</td>
                <td>01, 05, 11, 14, 15, 16</td>
              </tr>
              <tr>
                <td><span class="role-tag public">PUBLIC</span></td>
                <td>Public registration, login, doctor directory search, condition encyclopedia, unheld slot queries, medicine catalog browse.</td>
                <td>01, 03, 04, 09, 13, 14, 15</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Clinical Safety View
  // ==========================================================================
  function renderClinicalSafety() {
    docsMainContent.innerHTML = `
      <div class="overview-page">
        <div class="hero-banner">
          <h1 class="hero-title">Healthcare Safety & Clinical Guardrails</h1>
          <p class="hero-subtitle">
            Strict safety rules embedded within DermaCare AI to ensure patient protection and clinical compliance.
          </p>
        </div>

        <div class="contract-alert clinical">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div class="alert-heading">Primary Medical Disclaimer</div>
            DermaCare AI automated image screenings are preliminary assistive evaluations and MUST NOT be presented as a definitive clinical diagnosis.
          </div>
        </div>

        <div class="guide-card">
          <h3 class="guide-card-title">Enforced Safety Thresholds</h3>
          <ul class="rules-list">
            <li><strong>Confidence below 60%:</strong> Suppresses all natural-care, home remedies, and OTC recommendations to avoid incorrect self-treatment.</li>
            <li><strong>Risk above 20%:</strong> Triggers an immediate clinical urgency advisory, strongly urging the patient to schedule a licensed dermatologist consultation.</li>
            <li><strong>Red Flag Symptoms:</strong> Immediate bleeding, rapid size expansion, irregular pigmentation override all algorithms and escalate to emergency care warnings.</li>
            <li><strong>Prescription Immutability:</strong> Only the assigned treating doctor can author prescriptions. Once finalized, the prescription is permanently immutable.</li>
            <li><strong>Consent-Gated History:</strong> Pre-consultation patient health records are locked until the patient explicitly checks the consent agreement.</li>
            <li><strong>7-Day Chat Expiration:</strong> Post-consultation text chat automatically closes exactly 7 days after the completed video consultation.</li>
          </ul>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Contract Audit Matrix View
  // ==========================================================================
  function renderContractAudit() {
    if (!inventory) return;

    docsMainContent.innerHTML = `
      <div class="overview-page">
        <div class="hero-banner">
          <h1 class="hero-title">84-API Contract Audit Matrix</h1>
          <p class="hero-subtitle">
            Verified mapping of all 84 proposed REST API endpoints across all 16 modules against the current repository state.
          </p>
        </div>

        <div class="schema-table-wrapper">
          <table class="schema-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Method</th>
                <th>Route</th>
                <th>Module</th>
                <th>Purpose</th>
                <th>Contract Status</th>
              </tr>
            </thead>
            <tbody>
              ${inventory.endpoints.map(ep => `
                <tr>
                  <td><strong>${ep.id}</strong></td>
                  <td><span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span></td>
                  <td><a href="#/endpoint/${ep.id}" style="color:var(--accent-primary); font-family:var(--font-mono);">${escapeHtml(ep.path)}</a></td>
                  <td>Module ${ep.moduleNumber}</td>
                  <td>${escapeHtml(ep.summary)}</td>
                  <td><span class="role-tag" style="color:#f59e0b; border-color:rgba(245,158,11,0.3);">Specified (Proposed)</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // Single Endpoint Detail View (3-Column Layout)
  // ==========================================================================
  function renderEndpointDetail(id) {
    if (!inventory) return;

    const ep = inventory.endpoints.find(e => e.id === id);
    if (!ep) {
      docsMainContent.innerHTML = `<div class="overview-page"><div class="contract-alert warning">Endpoint #${id} not found.</div></div>`;
      return;
    }

    const fullRoute = `/api/v1${ep.path}`;
    const codeExample = generateCodeExample(ep, selectedCodeLanguage);
    const reqJson = ep.requestBody ? JSON.stringify(ep.requestBody.example, null, 2) : null;
    const defaultRes = ep.responses[0];
    const resJson = defaultRes ? JSON.stringify(defaultRes.example, null, 2) : '{}';

    docsMainContent.innerHTML = `
      <div class="endpoint-page">
        <!-- Center Documentation Column -->
        <div class="endpoint-doc-col">
          <div class="ep-header-crumbs">
            <a href="#overview">DermaCare AI</a>
            <span>/</span>
            <span>Module ${ep.moduleNumber} — ${escapeHtml(ep.moduleName)}</span>
            <span>/</span>
            <span>#${ep.id}</span>
          </div>

          <h1 class="ep-header-title">${escapeHtml(ep.summary)}</h1>

          <div class="ep-route-strip">
            <span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span>
            <span class="ep-full-route">${fullRoute}</span>
            <button class="copy-route-btn" onclick="window.copyText('${fullRoute}')" title="Copy Route">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          </div>

          <!-- Implementation Status Alert Banner -->
          <div class="contract-alert warning">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <div class="alert-heading">Contract Status: ${ep.implementationStatus}</div>
              This endpoint is part of the <strong>DermaCare AI Optimized MVP Specification</strong>.
              ${ep.statusNotes || 'Backend route is not yet implemented in repository.'}
            </div>
          </div>

          <!-- Purpose & Description -->
          <p class="ep-description-text">${escapeHtml(ep.description)}</p>

          <!-- Security & Authorization -->
          <h2 class="doc-section-h2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Authorization & Permissions
          </h2>
          <div class="security-grid">
            <div class="security-card">
              <div class="sec-card-label">Authorized Roles</div>
              <div class="sec-roles-list">
                ${ep.roles.map(r => `<span class="role-tag ${r.toLowerCase()}">${r}</span>`).join('')}
              </div>
            </div>
            <div class="security-card">
              <div class="sec-card-label">Authentication Type</div>
              <div style="font-family:var(--font-mono); font-size:12px; color:var(--text-primary);">
                ${ep.authRequired ? escapeHtml(ep.authType) : 'None (Public Endpoint)'}
              </div>
            </div>
          </div>

          <!-- Healthcare & Business Rules -->
          ${ep.businessRules.length > 0 ? `
            <h2 class="doc-section-h2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Healthcare & Business Rules
            </h2>
            <ul class="rules-list">
              ${ep.businessRules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
            </ul>
          ` : ''}

          <!-- Parameters Table (Path & Query) -->
          ${ep.parameters && ep.parameters.length > 0 ? `
            <h2 class="doc-section-h2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Parameters
            </h2>
            <div class="schema-table-wrapper">
              <table class="schema-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>In</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${ep.parameters.map(p => `
                    <tr>
                      <td>
                        <span class="param-name">${escapeHtml(p.name)}</span>
                        ${p.required ? '<span class="param-req">REQUIRED</span>' : '<span class="param-opt">OPTIONAL</span>'}
                      </td>
                      <td><span class="role-tag">${p.in}</span></td>
                      <td><span class="param-type">${escapeHtml(p.type)}</span></td>
                      <td class="param-desc">${escapeHtml(p.description || '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Request Body Schema -->
          ${ep.requestBody ? `
            <h2 class="doc-section-h2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Request Body (${ep.requestBody.contentType})
            </h2>
            <p class="ep-description-text">${escapeHtml(ep.requestBody.description)}</p>
            ${renderSchemaTable(ep.requestBody.schema)}
          ` : ''}

          <!-- Response Statuses -->
          <h2 class="doc-section-h2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Responses
          </h2>
          <div class="response-tabs" id="responseTabsContainer">
            ${ep.responses.map((res, idx) => `
              <button class="res-tab-btn ${idx === 0 ? 'active' : ''}" onclick="window.switchResponseTab(${ep.id}, ${res.statusCode})">
                <span class="${res.statusCode < 300 ? 'status-badge-2xx' : (res.statusCode < 500 ? 'status-badge-4xx' : 'status-badge-5xx')}">
                  ${res.statusCode}
                </span>
                <span>${escapeHtml(res.description.split(';')[0])}</span>
              </button>
            `).join('')}
          </div>
          <div id="responseDetailsWrapper">
            ${renderResponseCard(defaultRes)}
          </div>

          <!-- Related Endpoints -->
          ${ep.relatedEndpointIds && ep.relatedEndpointIds.length > 0 ? `
            <h2 class="doc-section-h2">Related Operations</h2>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${ep.relatedEndpointIds.map(relId => {
                const relEp = inventory.endpoints.find(e => e.id === relId);
                if (!relEp) return '';
                return `
                  <a href="#/endpoint/${relEp.id}" class="spec-link-pill">
                    <span class="method-badge ${relEp.method.toLowerCase()}">${relEp.method}</span>
                    <span>${escapeHtml(relEp.path)}</span>
                  </a>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Right Side Panel: Code Examples & Interactive Try-It-Out Console -->
        <div class="endpoint-console-col">
          <div class="console-header">
            <span class="console-title">Request Preview</span>
            <div class="console-tabs">
              <button class="console-tab-btn ${selectedCodeLanguage === 'curl' ? 'active' : ''}" onclick="window.setConsoleLang('curl', ${ep.id})">cURL</button>
              <button class="console-tab-btn ${selectedCodeLanguage === 'js' ? 'active' : ''}" onclick="window.setConsoleLang('js', ${ep.id})">JS</button>
              <button class="console-tab-btn ${selectedCodeLanguage === 'python' ? 'active' : ''}" onclick="window.setConsoleLang('python', ${ep.id})">Python</button>
            </div>
          </div>

          <div class="console-content">
            <!-- Code Card -->
            <div class="code-card">
              <div class="code-card-header">
                <span class="param-type">${selectedCodeLanguage.toUpperCase()}</span>
                <button class="copy-btn" onclick="window.copyText(document.getElementById('codeExamplePre').innerText)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy
                </button>
              </div>
              <pre id="codeExamplePre"><code>${escapeHtml(codeExample)}</code></pre>
            </div>

            <!-- Try It Out Console -->
            <div class="try-section">
              <div class="console-title" style="margin-top:8px;">Interactive API Explorer</div>

              <div class="try-field">
                <label>Server URL</label>
                <input type="text" class="try-input" id="tryServerUrl" value="${currentEnvironment}" readonly>
              </div>

              ${ep.authRequired ? `
                <div class="try-field">
                  <label>Authorization Token (Bearer)</label>
                  <input type="text" class="try-input" id="tryAuthToken" placeholder="eyJhbGciOiJIUzI1Ni... (or leave demo token)" value="demo_bearer_token_dermacare_2026">
                </div>
              ` : ''}

              ${ep.requestBody ? `
                <div class="try-field">
                  <label>Request JSON Body</label>
                  <textarea class="try-textarea" id="tryRequestBody">${reqJson}</textarea>
                </div>
              ` : ''}

              <button class="send-btn" id="sendRequestBtn" onclick="window.executeTryRequest(${ep.id})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send Request
              </button>

              <!-- Console Response Box -->
              <div class="response-card" id="consoleResponseBox" style="display:none;">
                <div class="response-card-header">
                  <span class="res-status-tag" id="consoleResStatus">200 OK</span>
                  <span class="res-time-tag" id="consoleResTime">24ms</span>
                </div>
                <pre><code id="consoleResponseBody">{}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Schema Table Generator
  function renderSchemaTable(schema) {
    if (!schema || !schema.properties) {
      return `<p style="color:var(--text-muted); font-size:12px;">No properties defined.</p>`;
    }

    const props = schema.properties;
    const requiredFields = schema.required || [];

    return `
      <div class="schema-table-wrapper">
        <table class="schema-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Constraints</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(props).map(([key, p]) => {
              const isReq = requiredFields.includes(key);
              return `
                <tr>
                  <td>
                    <span class="param-name">${escapeHtml(key)}</span>
                    ${isReq ? '<span class="param-req">REQUIRED</span>' : '<span class="param-opt">OPTIONAL</span>'}
                  </td>
                  <td><span class="param-type">${p.type}${p.format ? ` (${p.format})` : ''}</span></td>
                  <td>
                    ${p.enum ? `<span style="font-family:var(--font-mono); font-size:11px; color:#a78bfa;">[${p.enum.join(' | ')}]</span>` : ''}
                    ${p.minimum !== undefined ? `<span style="font-size:11px; color:var(--text-muted);">min: ${p.minimum} </span>` : ''}
                    ${p.maximum !== undefined ? `<span style="font-size:11px; color:var(--text-muted);">max: ${p.maximum}</span>` : ''}
                  </td>
                  <td class="param-desc">${escapeHtml(p.description || '')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderResponseCard(res) {
    if (!res) return '';
    return `
      <div class="code-card" style="margin-top:12px;">
        <div class="code-card-header">
          <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">${escapeHtml(res.description)}</span>
          <button class="copy-btn" onclick="window.copyText('${escapeForJs(JSON.stringify(res.example || {}, null, 2))}')">Copy</button>
        </div>
        <pre><code>${escapeHtml(JSON.stringify(res.example || {}, null, 2))}</code></pre>
      </div>
    `;
  }

  window.switchResponseTab = function (epId, statusCode) {
    const ep = inventory.endpoints.find(e => e.id === epId);
    if (!ep) return;
    const res = ep.responses.find(r => r.statusCode === statusCode);
    if (!res) return;

    document.querySelectorAll('.res-tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.getElementById('responseDetailsWrapper').innerHTML = renderResponseCard(res);
  };

  // Code Generation Helpers
  function generateCodeExample(ep, lang) {
    const fullUrl = `${currentEnvironment}${ep.path}`;

    if (lang === 'curl') {
      let curl = `curl -X ${ep.method} "${fullUrl}" \\\n  -H "Accept: application/json"`;
      if (ep.authRequired) {
        curl += ` \\\n  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"`;
      }
      if (ep.requestBody) {
        curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(ep.requestBody.example)}'`;
      }
      return curl;
    }

    if (lang === 'js') {
      let code = `const response = await fetch("${fullUrl}", {\n`;
      code += `  method: "${ep.method}",\n`;
      code += `  headers: {\n`;
      code += `    "Accept": "application/json",\n`;
      if (ep.authRequired) {
        code += `    "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",\n`;
      }
      if (ep.requestBody) {
        code += `    "Content-Type": "application/json",\n`;
      }
      code += `  },\n`;
      if (ep.requestBody) {
        code += `  body: JSON.stringify(${JSON.stringify(ep.requestBody.example, null, 4)})\n`;
      }
      code += `});\n\nconst data = await response.json();\nconsole.log(data);`;
      return code;
    }

    if (lang === 'python') {
      let py = `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Accept": "application/json",\n`;
      if (ep.authRequired) {
        py += `    "Authorization": "Bearer <YOUR_ACCESS_TOKEN>",\n`;
      }
      py += `}\n`;
      if (ep.requestBody) {
        py += `payload = ${JSON.stringify(ep.requestBody.example, null, 4)}\n\nresponse = requests.${ep.method.toLowerCase()}(url, json=payload, headers=headers)\n`;
      } else {
        py += `\nresponse = requests.${ep.method.toLowerCase()}(url, headers=headers)\n`;
      }
      py += `print(response.status_code)\nprint(response.json())`;
      return py;
    }

    return '';
  }

  window.setConsoleLang = function (lang, epId) {
    selectedCodeLanguage = lang;
    document.querySelectorAll('.console-tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    const ep = inventory.endpoints.find(e => e.id === epId);
    if (ep) {
      document.getElementById('codeExamplePre').innerHTML = `<code>${escapeHtml(generateCodeExample(ep, lang))}</code>`;
    }
  };

  // Try It Out Execution
  window.executeTryRequest = async function (epId) {
    const ep = inventory.endpoints.find(e => e.id === epId);
    if (!ep) return;

    const btn = document.getElementById('sendRequestBtn');
    const box = document.getElementById('consoleResponseBox');
    const statusTag = document.getElementById('consoleResStatus');
    const timeTag = document.getElementById('consoleResTime');
    const bodyCode = document.getElementById('consoleResponseBody');

    btn.disabled = true;
    btn.innerHTML = `Sending...`;

    const startTime = performance.now();
    const tokenInput = document.getElementById('tryAuthToken');
    const token = tokenInput ? tokenInput.value.trim() : null;
    const bodyInput = document.getElementById('tryRequestBody');
    const bodyContent = bodyInput ? bodyInput.value.trim() : null;

    let targetUrl = `${currentEnvironment}${ep.path}`;
    // Replace dummy path params if any
    targetUrl = targetUrl.replace('{id}', 'demo_item_123');

    try {
      const headers = {
        'Accept': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (bodyContent) headers['Content-Type'] = 'application/json';

      const res = await fetch(targetUrl, {
        method: ep.method,
        headers,
        body: ['GET', 'HEAD'].includes(ep.method) ? undefined : bodyContent
      });

      const elapsed = Math.round(performance.now() - startTime);
      const data = await res.json().catch(() => ({ message: res.statusText }));

      statusTag.innerText = `${res.status} ${res.statusText || ''}`;
      statusTag.className = `res-status-tag ${res.status < 300 ? 'status-badge-2xx' : (res.status < 500 ? 'status-badge-4xx' : 'status-badge-5xx')}`;
      timeTag.innerText = `${elapsed}ms`;
      bodyCode.innerText = JSON.stringify(data, null, 2);
      box.style.display = 'block';
    } catch (err) {
      // In case server route is not live, show simulated specification response safely
      const elapsed = Math.round(performance.now() - startTime);
      const simulatedData = {
        notice: "SIMULATED_CONTRACT_RESPONSE",
        status: "501 Not Implemented in repository codebase",
        message: "This endpoint is defined in the proposed contract. Backend route is not operational.",
        contractExample: ep.responses[0]?.example || {}
      };

      statusTag.innerText = `501 Not Implemented (Spec)`;
      statusTag.className = `res-status-tag status-badge-4xx`;
      timeTag.innerText = `${elapsed}ms`;
      bodyCode.innerText = JSON.stringify(simulatedData, null, 2);
      box.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Request`;
    }
  };

  // Global Search Modal
  function openSearchModal() {
    searchModalBackdrop.style.display = 'flex';
    modalSearchInput.value = '';
    modalSearchInput.focus();
    renderSearchResults('');
  }

  function closeSearchModal() {
    searchModalBackdrop.style.display = 'none';
  }

  function handleModalSearch(e) {
    const q = e.target.value.trim().toLowerCase();
    renderSearchResults(q);
  }

  function renderSearchResults(q) {
    if (!inventory) return;

    if (!q) {
      modalSearchResults.innerHTML = `<div class="modal-empty-state">Type a keyword to search all 84 endpoints across 16 modules...</div>`;
      return;
    }

    const matches = inventory.endpoints.filter(e =>
      e.summary.toLowerCase().includes(q) ||
      e.path.toLowerCase().includes(q) ||
      e.moduleName.toLowerCase().includes(q) ||
      e.method.toLowerCase().includes(q)
    );

    if (matches.length === 0) {
      modalSearchResults.innerHTML = `<div class="modal-empty-state">No matching endpoints found for "${escapeHtml(q)}".</div>`;
      return;
    }

    modalSearchResults.innerHTML = matches.slice(0, 20).map((ep, i) => `
      <div class="search-result-item ${i === 0 ? 'selected' : ''}" onclick="window.selectSearchResult(${ep.id})">
        <span class="method-badge ${ep.method.toLowerCase()}">${ep.method}</span>
        <div class="search-res-text">
          <div class="search-res-title">${escapeHtml(ep.summary)}</div>
          <div class="search-res-path">/api/v1${escapeHtml(ep.path)}</div>
        </div>
        <div class="search-res-mod">Mod ${ep.moduleNumber}</div>
      </div>
    `).join('');
  }

  window.selectSearchResult = function (id) {
    closeSearchModal();
    window.location.hash = `#/endpoint/${id}`;
  };

  // Toast Notification Helper
  window.copyText = function (text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      showToast('Copy failed.');
    });
  };

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2400);
  }

  // Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeForJs(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  }

  // Start Application
  init();
})();

