(() => {
  'use strict';

  if (globalThis.__LUMINA_CONTENT_READY__) {
    return;
  }
  globalThis.__LUMINA_CONTENT_READY__ = true;

  const LUMINA_APP_ORIGIN = globalThis.LUMINA_APP_ORIGIN || 'http://127.0.0.1:3000';
  const LUMINA_API_URL = `${LUMINA_APP_ORIGIN}/api/lumina/analyze-site`;
  let autoAuditEnabled = false;
  let scanTimeout;

  const RULES = {
    fake_urgency: {
      name: 'Fake Urgency',
      explanation: 'Creates artificial time pressure or scarcity.',
      weight: 25,
      patterns: [
        /only \d+ left/i,
        /limited time/i,
        /hurry/i,
        /act now/i,
        /last chance/i,
        /ending soon/i,
        /selling fast/i,
        /today only/i,
        /limited (stock|availability|quantity)/i,
        /\d+ (people|users|customers) (are )?(viewing|watching|looking)/i,
      ],
    },
    countdown_timer: {
      name: 'Countdown Timer',
      explanation: 'Uses a visible ticking timer to pressure a decision.',
      weight: 20,
      patterns: [/\b\d{1,2}:\d{2}(:\d{2})?\b/],
    },
    preselected_checkbox: {
      name: 'Pre-selected Option',
      explanation: 'Automatically opts the user into an extra choice.',
      weight: 30,
      selector: 'input[type="checkbox"][checked], input[type="checkbox"]:checked',
      context: ['subscribe', 'newsletter', 'insurance', 'protection', 'warranty', 'marketing', 'promotional', 'partner'],
    },
    misleading_buttons: {
      name: 'Misleading Button',
      explanation: 'Makes rejection harder or acceptance more visually dominant.',
      weight: 25,
      declinePatterns: [/no,?\s*(thanks|thank you)/i, /maybe later/i, /skip/i, /not now/i, /decline/i, /cancel/i],
      acceptPatterns: [/yes/i, /accept/i, /agree/i, /continue/i, /claim/i, /unlock/i, /get (started|deal)/i],
    },
    suspicious_pricing: {
      name: 'Suspicious Pricing',
      explanation: 'Uses discount framing or crossed prices to influence choices.',
      weight: 15,
      patterns: [/was \$?\d+/i, /save \d+%/i, /\d+% off/i, /originally \$?\d+/i, /compare at/i],
      selectors: ['del', 's', '[class*="old-price"]', '[class*="was-price"]', '[class*="original-price"]'],
    },
    hidden_costs: {
      name: 'Hidden Costs',
      explanation: 'Mentions fees or charges that can appear late in checkout.',
      weight: 20,
      patterns: [/service fee/i, /handling fee/i, /processing fee/i, /convenience fee/i, /delivery fee/i, /shipping calculated/i, /\+ tax/i, /fees may apply/i],
    },
    confirmshaming: {
      name: 'Confirmshaming',
      explanation: 'Uses guilt or shame to discourage declining.',
      weight: 35,
      patterns: [/no,?\s*i (don'?t )?(want to )?(hate|dislike)/i, /i (don'?t )?like (paying|spending) full/i, /i prefer to (miss|lose|ignore)/i],
    },
    forced_continuity: {
      name: 'Forced Continuity',
      explanation: 'Hints at auto-renewal, trial traps, or recurring charges.',
      weight: 20,
      patterns: [/auto(-|\s)?renew/i, /automatically (renew|charge|bill)/i, /recurring (charge|payment|billing)/i, /free trial/i, /credit card required/i, /billing (starts|begins)/i],
    },
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'lumina_ping') {
      sendResponse({ ready: true });
    } else if (request.action === 'run_audit') {
      startAudit();
      sendResponse({ success: true });
    }

    return true;
  });

  function getLeafTextElements() {
    const allCandidateElements = Array.from(
      document.querySelectorAll('button, a, span, p, h1, h2, h3, li, label, b, i, strong, div, section'),
    ).filter((element) => {
      const text = element.innerText?.trim();
      return text && text.length > 2 && text.length < 180;
    });

    return allCandidateElements
      .filter((element) => {
        const children = Array.from(element.querySelectorAll('*'));
        return !children.some((child) => allCandidateElements.includes(child));
      })
      .slice(0, 50);
  }

  function createFinding(element, type, text) {
    const rule = RULES[type];
    return {
      element,
      type,
      name: rule.name,
      explanation: rule.explanation,
      law: 'Dark Pattern Detector heuristic rule',
      text: text.trim().slice(0, 140),
      weight: rule.weight,
    };
  }

  function findTextRulePatterns(elements) {
    const findings = [];
    const textRuleTypes = Object.keys(RULES).filter((type) => RULES[type].patterns);

    elements.forEach((element) => {
      const text = element.innerText?.trim() || '';
      textRuleTypes.forEach((type) => {
        if (RULES[type].patterns.some((pattern) => pattern.test(text))) {
          findings.push(createFinding(element, type, text));
        }
      });
    });

    return findings;
  }

  function findSelectorPatterns() {
    const findings = [];

    Object.entries(RULES).forEach(([type, rule]) => {
      if (!rule.selectors) return;
      rule.selectors.forEach((selector) => {
        try {
          document.querySelectorAll(selector).forEach((element) => {
            findings.push(createFinding(element, type, element.textContent || rule.name));
          });
        } catch {}
      });
    });

    document.querySelectorAll(RULES.preselected_checkbox.selector).forEach((checkbox) => {
      const container = checkbox.closest('label, div, form, fieldset') || checkbox;
      const text = container.textContent?.toLowerCase() || '';
      if (RULES.preselected_checkbox.context.some((keyword) => text.includes(keyword))) {
        findings.push(createFinding(container, 'preselected_checkbox', container.textContent || 'Pre-selected checkbox'));
      }
    });

    return findings;
  }

  function findMisleadingButtons() {
    const rule = RULES.misleading_buttons;
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"], [class*="btn"], [class*="button"], input[type="submit"], input[type="button"]'));
    const acceptButtons = [];
    const declineButtons = [];

    buttons.forEach((button) => {
      const text = (button.innerText || button.value || '').trim();
      if (rule.acceptPatterns.some((pattern) => pattern.test(text))) acceptButtons.push(button);
      if (rule.declinePatterns.some((pattern) => pattern.test(text))) declineButtons.push(button);
    });

    const findings = [];
    declineButtons.forEach((declineButton) => {
      const declineRect = declineButton.getBoundingClientRect();
      const declineArea = declineRect.width * declineRect.height;
      const declineStyle = window.getComputedStyle(declineButton);

      acceptButtons.forEach((acceptButton) => {
        const acceptRect = acceptButton.getBoundingClientRect();
        const acceptArea = acceptRect.width * acceptRect.height;
        const declineIsMuted = Number(declineStyle.opacity) < 0.72 || parseFloat(declineStyle.fontSize) < 12;

        if (acceptArea > declineArea * 1.4 || declineIsMuted) {
          findings.push(createFinding(declineButton, 'misleading_buttons', declineButton.innerText || declineButton.value || 'Decline action'));
        }
      });
    });

    return findings;
  }

  function dedupeFindings(findings) {
    const seen = new Set();
    return findings.filter((finding) => {
      const key = `${finding.type}:${finding.text}:${finding.element.tagName}:${finding.element.getBoundingClientRect().top}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function calculateLocalScore(findings) {
    const typeCounts = {};
    findings.forEach((finding) => {
      typeCounts[finding.type] = (typeCounts[finding.type] || 0) + 1;
    });

    const score = Object.entries(typeCounts).reduce((total, [type, count]) => {
      const rule = RULES[type];
      return total + rule.weight + Math.min(count - 1, 3) * 5;
    }, 0);

    return Math.min(100, score);
  }

  async function getBackendAudit(elementsToScan, elements) {
    const response = await fetch(LUMINA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: window.location.href,
        elements: elementsToScan,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lumina backend returned ${response.status}`);
    }

    const data = await response.json();
    const findings = (data.findings || []).map((finding) => ({
      ...finding,
      element: elements[finding.id],
      type: 'deceptive_pattern',
      name: finding.type || 'Deceptive Pattern',
      text: elementsToScan[finding.id]?.text_content || '',
      weight: 30,
    })).filter((finding) => finding.element);

    return { data, findings };
  }

  async function startAudit() {
    autoAuditEnabled = true;

    const elements = getLeafTextElements();
    const elementsToScan = elements.map((element, index) => ({
      id: index,
      text_content: element.innerText.trim(),
    }));

    const localFindings = dedupeFindings([
      ...findTextRulePatterns(elements),
      ...findSelectorPatterns(),
      ...findMisleadingButtons(),
    ]);
    const localScore = calculateLocalScore(localFindings);
    let backendData = null;
    let backendFindings = [];

    if (elementsToScan.length > 0) {
      try {
        const audit = await getBackendAudit(elementsToScan, elements);
        backendData = audit.data;
        backendFindings = audit.findings;
      } catch (error) {
        console.warn('Lumina backend unavailable, using local detector only:', error);
      }
    }

    const allFindings = dedupeFindings([...localFindings, ...backendFindings]);
    allFindings.forEach((finding) => injectDetectionBadge(finding.element, finding));

    const backendScore = Number(backendData?.integrity_score || 0);
    const integrityScore = Math.max(localScore, backendScore);
    const isFake = Boolean(backendData?.is_fake);
    const verdict = isFake
      ? 'MALICIOUS'
      : integrityScore > 70
        ? 'MALICIOUS'
        : integrityScore > 25
          ? 'SUSPICIOUS'
          : 'SAFE';

    sendAuditResult({
      is_fake: isFake,
      original_url: backendData?.original_url || '',
      integrity_score: integrityScore,
      verdict,
      findings: allFindings.map(({ element, ...finding }) => finding),
    });
  }

  function sendAuditResult(data) {
    chrome.runtime.sendMessage({
      action: 'audit_done',
      payload: {
        ...data,
        url: window.location.href,
        hostname: window.location.hostname,
        timestamp: new Date().toISOString(),
      },
    });
  }

  function injectDetectionBadge(element, data) {
    if (!element || element.getAttribute('data-lumina-marked')) return;

    element.setAttribute('data-lumina-marked', 'true');

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.overflow === 'hidden' || computedStyle.overflow === 'clip') {
      element.style.setProperty('overflow', 'visible', 'important');
    }

    if (computedStyle.position === 'static') {
      element.style.position = 'relative';
    }

    element.style.outline = '2px solid #ef4444';
    element.style.outlineOffset = '2px';

    const badge = document.createElement('div');
    Object.assign(badge.style, {
      position: 'absolute',
      backgroundColor: '#ef4444',
      color: 'white',
      padding: '3px 6px',
      borderRadius: '5px',
      fontSize: '10px',
      fontWeight: '900',
      zIndex: '2147483647',
      top: '0px',
      left: '0px',
      transform: 'translateY(-110%)',
      pointerEvents: 'auto',
      boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
      whiteSpace: 'nowrap',
      fontFamily: 'Inter, system-ui, sans-serif',
      cursor: 'help',
    });

    badge.textContent = `LUMINA: ${(data.name || data.type || 'RISK').toUpperCase()}`;
    badge.title = `Lumina Detection: ${data.explanation || 'Suspicious element detected.'}\nReference: ${data.law || 'Dark pattern risk'}`;

    element.appendChild(badge);
  }

  function observeDynamicContent() {
    if (!document.body) return;

    const observer = new MutationObserver((mutations) => {
      if (!autoAuditEnabled) return;

      const nodesAdded = mutations.some((mutation) => mutation.addedNodes.length > 0);
      if (!nodesAdded) return;

      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(startAudit, 3000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeDynamicContent, { once: true });
  } else {
    observeDynamicContent();
  }
})();
