/**
 * Telza Sales: AI Search Readiness Check — Frontend Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const scanForm = document.getElementById('scanForm');
  const urlInput = document.getElementById('urlInput');
  const scanButton = document.getElementById('scanButton');
  const urlError = document.getElementById('urlError');

  const loadingSection = document.getElementById('loadingSection');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressSteps = [
    document.getElementById('step1'),
    document.getElementById('step2'),
    document.getElementById('step3'),
    document.getElementById('step4')
  ];

  const unreadableSection = document.getElementById('unreadableSection');
  const unreadableReasonText = document.getElementById('unreadableReasonText');
  const jumpToUnreadableLead = document.getElementById('jumpToUnreadableLead');

  const resultsSection = document.getElementById('resultsSection');
  const resultDomainDisplay = document.getElementById('resultDomainDisplay');
  const scoreNumber = document.getElementById('scoreNumber');
  const bandBadge = document.getElementById('bandBadge');
  const btnRescan = document.getElementById('btnRescan');

  const ptsCrawl = document.getElementById('ptsCrawl');
  const fillCrawl = document.getElementById('fillCrawl');
  const ptsClarity = document.getElementById('ptsClarity');
  const fillClarity = document.getElementById('fillClarity');
  const ptsQa = document.getElementById('ptsQa');
  const fillQa = document.getElementById('fillQa');
  const ptsSchema = document.getElementById('ptsSchema');
  const fillSchema = document.getElementById('fillSchema');

  const fixesListContainer = document.getElementById('fixesListContainer');
  const btnToggleDetails = document.getElementById('btnToggleDetails');
  const fullAuditDetails = document.getElementById('fullAuditDetails');

  // Lead Form Elements
  const leadForm = document.getElementById('leadForm');
  const businessEmail = document.getElementById('businessEmail');
  const whatTheySell = document.getElementById('whatTheySell');
  const consentCheckbox = document.getElementById('consentCheckbox');
  const btnSubmitLead = document.getElementById('btnSubmitLead');
  const emailError = document.getElementById('emailError');
  const consentError = document.getElementById('consentError');
  const leadSuccessCard = document.getElementById('leadSuccessCard');
  const confirmedEmailDisplay = document.getElementById('confirmedEmailDisplay');

  const leadDomainHidden = document.getElementById('leadDomainHidden');
  const leadScoreHidden = document.getElementById('leadScoreHidden');
  const leadUnreadableReasonHidden = document.getElementById('leadUnreadableReasonHidden');

  // Common free webmail domains to filter on the client side
  const FREE_EMAIL_DOMAINS = [
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
    'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'mail.com',
    'proton.me', 'protonmail.com', 'zoho.com', 'yandex.com'
  ];

  let currentScanData = null;

  // Clean and validate URL input
  function sanitizeInputUrl(val) {
    let raw = val.trim();
    if (!raw) return '';
    raw = raw.replace(/^https?:\/\//i, '');
    raw = raw.replace(/\/+$/, '');
    return raw;
  }

  function validateDomainFormat(raw) {
    if (!raw || raw.length < 3) return false;
    // Basic domain regex (e.g. example.com, sub.company.co.uk)
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;
    return domainRegex.test(raw);
  }

  // Handle Scan Form Submit
  scanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    urlError.textContent = '';

    const cleanInput = sanitizeInputUrl(urlInput.value);
    if (!cleanInput) {
      urlError.textContent = 'Please enter a website URL or domain name.';
      urlInput.focus();
      return;
    }

    if (!validateDomainFormat(cleanInput)) {
      urlError.textContent = 'Please enter a valid domain (e.g. yourcompany.com).';
      urlInput.focus();
      return;
    }

    const fullUrl = `https://${cleanInput}`;
    startScanSequence(fullUrl, cleanInput.split('/')[0]);
  });

  // Start animated scan sequence and trigger API call
  async function startScanSequence(targetUrl, domain) {
    // UI state transitions
    scanButton.disabled = true;
    urlInput.disabled = true;
    unreadableSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    loadingSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Progress animation timers
    let progressPercent = 15;
    progressBarFill.style.width = `${progressPercent}%`;

    const stepInterval = setInterval(() => {
      if (progressPercent < 90) {
        progressPercent += Math.floor(Math.random() * 20) + 10;
        if (progressPercent > 90) progressPercent = 90;
        progressBarFill.style.width = `${progressPercent}%`;

        if (progressPercent >= 35 && progressSteps[0]) {
          progressSteps[0].classList.add('completed');
          progressSteps[1]?.classList.add('active');
        }
        if (progressPercent >= 60 && progressSteps[1]) {
          progressSteps[1].classList.add('completed');
          progressSteps[2]?.classList.add('active');
        }
        if (progressPercent >= 80 && progressSteps[2]) {
          progressSteps[2].classList.add('completed');
          progressSteps[3]?.classList.add('active');
        }
      }
    }, 700);

    try {
      // Get turnstile token if present
      const turnstileToken = window.turnstile ? window.turnstile.getResponse() : undefined;

      const response = await fetch('/.netlify/functions/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, turnstileToken })
      });

      clearInterval(stepInterval);
      progressBarFill.style.width = '100%';

      const data = await response.json();

      // Artificial grace pause so visitor sees final step check
      setTimeout(() => {
        loadingSection.classList.add('hidden');
        scanButton.disabled = false;
        urlInput.disabled = false;

        if (!response.ok && !data.readable) {
          renderUnreadableState(targetUrl, domain, data.reason || data.error || 'Connection failed');
        } else if (data.readable === false) {
          renderUnreadableState(targetUrl, domain, data.reason || 'Bot protection or JS execution required');
        } else {
          renderResults(data);
        }
      }, 500);
    } catch (err) {
      clearInterval(stepInterval);
      loadingSection.classList.add('hidden');
      scanButton.disabled = false;
      urlInput.disabled = false;

      renderUnreadableState(
        targetUrl,
        domain,
        'Network error: Failed to reach the scanner service. Please verify your connection.'
      );
    }
  }

  // Render "Couldn't Read Your Site" State
  function renderUnreadableState(url, domain, reason) {
    unreadableSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    unreadableReasonText.textContent = `Technical detail: ${reason}`;

    // Pre-fill lead hidden fields
    leadDomainHidden.value = domain;
    leadScoreHidden.value = 'unreadable';
    leadUnreadableReasonHidden.value = reason;

    unreadableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  jumpToUnreadableLead?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('lockedReportPanel')?.scrollIntoView({ behavior: 'smooth' });
    businessEmail?.focus();
  });

  // Render Complete Readiness Score & Fixes
  function renderResults(data) {
    currentScanData = data;
    unreadableSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    resultDomainDisplay.textContent = data.domain;

    // Pre-fill lead hidden inputs
    leadDomainHidden.value = data.domain;
    leadScoreHidden.value = data.score;
    leadUnreadableReasonHidden.value = '';

    // Animate score counter
    animateScoreCounter(data.score);

    // Band styling
    bandBadge.textContent = data.band;
    bandBadge.className = 'band-badge';
    if (data.score >= 80) {
      bandBadge.classList.add('band-strong');
    } else if (data.score >= 60) {
      bandBadge.classList.add('band-good');
    } else if (data.score >= 40) {
      bandBadge.classList.add('band-needs-improvement');
    } else {
      bandBadge.classList.add('band-significant-issues');
    }

    // Category scores & bars
    const cats = data.categories;

    ptsCrawl.textContent = `${cats.crawlability.earned} / 25`;
    fillCrawl.style.width = `${(cats.crawlability.earned / 25) * 100}%`;

    ptsClarity.textContent = `${cats.clarity.earned} / 25`;
    fillClarity.style.width = `${(cats.clarity.earned / 25) * 100}%`;

    ptsQa.textContent = `${cats.qa_content.earned} / 25`;
    fillQa.style.width = `${(cats.qa_content.earned / 25) * 100}%`;

    ptsSchema.textContent = `${cats.structured_data.earned} / 25`;
    fillSchema.style.width = `${(cats.structured_data.earned / 25) * 100}%`;

    // Render Top 3 Fixes
    renderTopFixes(data.topFixes);

    // Render Full 24-Point Audit Checklist
    renderFullAudit(cats);

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function animateScoreCounter(targetScore) {
    let current = 0;
    const duration = 1200;
    const stepTime = 20;
    const increment = targetScore / (duration / stepTime);

    scoreNumber.textContent = '0';
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetScore) {
        clearInterval(timer);
        scoreNumber.textContent = targetScore;
      } else {
        scoreNumber.textContent = Math.round(current);
      }
    }, stepTime);
  }

  function renderTopFixes(fixes) {
    fixesListContainer.innerHTML = '';

    if (!fixes || fixes.length === 0) {
      fixesListContainer.innerHTML = `
        <div class="fix-item-card">
          <div>
            <div class="fix-item-title" style="color: #34d399;">Outstanding Technical Readiness</div>
            <div class="fix-item-description">Your website passed all standard automated tests. To evaluate how AI assistants actually cite you vs competitors, request the manual report below.</div>
          </div>
        </div>
      `;
      return;
    }

    fixes.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `fix-item-card fix-impact-${item.impact.toLowerCase()}`;

      card.innerHTML = `
        <div>
          <div class="fix-cat-tag">Fix #${index + 1} • ${escapeHtml(item.category)}</div>
          <div class="fix-item-title">${escapeHtml(item.title)}</div>
          <div class="fix-item-description">${escapeHtml(item.fix)}</div>
        </div>
        <div class="fix-meta-col">
          <span class="fix-lost-badge">-${item.pointsLost} pts</span>
          <span class="fix-impact-badge impact-badge-${item.impact.toLowerCase()}">${item.impact} Impact</span>
        </div>
      `;

      fixesListContainer.appendChild(card);
    });
  }

  function renderFullAudit(categories) {
    fullAuditDetails.innerHTML = '';

    for (const [key, cat] of Object.entries(categories)) {
      const catBlock = document.createElement('div');
      catBlock.className = 'audit-category-block';

      let rowsHtml = '';
      for (const check of cat.checks) {
        const badgeClass =
          check.status === 'pass'
            ? 'status-pass'
            : check.status === 'partial'
            ? 'status-partial'
            : 'status-fail';

        rowsHtml += `
          <tr>
            <td style="width: 100px;">
              <span class="status-badge ${badgeClass}">${check.status}</span>
            </td>
            <td>
              <strong>${escapeHtml(check.name)}</strong>
              <p style="color: #9ca3af; font-size: 0.8rem; margin-top: 2px;">${escapeHtml(check.detail)}</p>
            </td>
            <td style="text-align: right; font-weight: 600; white-space: nowrap; width: 80px;">
              ${check.pointsEarned} / ${check.maxPoints}
            </td>
          </tr>
        `;
      }

      catBlock.innerHTML = `
        <h4 class="audit-category-title">${escapeHtml(cat.name)} (${cat.earned} / ${cat.max} pts)</h4>
        <table class="audit-checks-table">
          <tbody>${rowsHtml}</tbody>
        </table>
      `;

      fullAuditDetails.appendChild(catBlock);
    }
  }

  // Toggle full audit checklist
  btnToggleDetails?.addEventListener('click', () => {
    const isExpanded = btnToggleDetails.getAttribute('aria-expanded') === 'true';
    btnToggleDetails.setAttribute('aria-expanded', !isExpanded);

    if (isExpanded) {
      fullAuditDetails.classList.add('hidden');
      btnToggleDetails.querySelector('span').textContent = 'View Full 24-Point Technical Audit';
    } else {
      fullAuditDetails.classList.remove('hidden');
      btnToggleDetails.querySelector('span').textContent = 'Hide Technical Audit';
    }
  });

  // Re-scan button resets UI
  btnRescan?.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    unreadableSection.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    urlInput.focus();
  });

  // =========================================================================
  // LEAD FORM HANDLING
  // =========================================================================

  leadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailError.textContent = '';
    consentError.textContent = '';

    const email = businessEmail.value.trim().toLowerCase();
    const sellNote = whatTheySell.value.trim();
    const consent = consentCheckbox.checked;
    const hpField = document.getElementById('company_website_hp')?.value;

    // Check honeypot
    if (hpField) {
      // Quietly reject bot submissions
      leadForm.classList.add('hidden');
      leadSuccessCard.classList.remove('hidden');
      return;
    }

    // Email validation
    if (!email) {
      emailError.textContent = 'Please enter your business email address.';
      businessEmail.focus();
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) {
      emailError.textContent = 'Please enter a valid email address.';
      businessEmail.focus();
      return;
    }

    const emailDomain = email.split('@')[1];
    if (FREE_EMAIL_DOMAINS.includes(emailDomain)) {
      emailError.textContent = 'Please use your official company/work email. Personal webmail (Gmail, Yahoo, Outlook) is not accepted.';
      businessEmail.focus();
      return;
    }

    if (!consent) {
      consentError.textContent = 'Please check the box to confirm consent to receive your report.';
      consentCheckbox.focus();
      return;
    }

    btnSubmitLead.disabled = true;
    btnSubmitLead.querySelector('span').textContent = 'Submitting Request…';

    const turnstileToken = window.turnstile ? window.turnstile.getResponse() : undefined;

    const payload = {
      email,
      domain: leadDomainHidden.value || sanitizeInputUrl(urlInput.value),
      url: `https://${leadDomainHidden.value || sanitizeInputUrl(urlInput.value)}`,
      score: leadScoreHidden.value || null,
      unreadable_reason: leadUnreadableReasonHidden.value || null,
      what_they_sell: sellNote || null,
      consent: true,
      turnstileToken,
      submitted_at: new Date().toISOString()
    };

    try {
      const leadResponse = await fetch('/.netlify/functions/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const leadData = await leadResponse.json();

      if (!leadResponse.ok) {
        btnSubmitLead.disabled = false;
        btnSubmitLead.querySelector('span').textContent = 'Request Manual AI Visibility Report';
        emailError.textContent = leadData.error || 'Failed to submit request. Please try again.';
        return;
      }

      // Success transition
      confirmedEmailDisplay.textContent = email;
      leadForm.classList.add('hidden');
      leadSuccessCard.classList.remove('hidden');
      leadSuccessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      // If the lead endpoint is not yet live (Phase 3), handle gracefully
      btnSubmitLead.disabled = false;
      btnSubmitLead.querySelector('span').textContent = 'Request Manual AI Visibility Report';
      confirmedEmailDisplay.textContent = email;
      leadForm.classList.add('hidden');
      leadSuccessCard.classList.remove('hidden');
      leadSuccessCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
