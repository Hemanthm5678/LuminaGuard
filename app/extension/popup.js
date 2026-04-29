const LUMINA_APP_ORIGIN = globalThis.LUMINA_APP_ORIGIN || 'http://127.0.0.1:3000';
const DASHBOARD_REPORTS_URL = `${LUMINA_APP_ORIGIN}/api/reports`;

const scanBtn = document.getElementById('scan-btn');
const scoreText = document.getElementById('score-text');
const scoreBar = document.getElementById('score-bar');
const verdictLabel = document.getElementById('verdict-label');
const cloneAlert = document.getElementById('clone-alert');
const secureLink = document.getElementById('secure-link');
const dashboardStatus = document.getElementById('dashboard-status');

function setButtonBusy(isBusy, label) {
  scanBtn.disabled = isBusy;
  scanBtn.innerText = label;
  scanBtn.classList.toggle('opacity-50', isBusy);
  scanBtn.classList.toggle('cursor-not-allowed', isBusy);
}

function setDashboardStatus(message, state = '') {
  dashboardStatus.textContent = message;
  dashboardStatus.className = `dashboard-status${state ? ` is-${state}` : ''}`;
}

function renderAudit(data) {
  const score = Number(data.integrity_score || 0);

  scoreText.innerText = `${score}%`;
  scoreBar.style.width = `${Math.max(0, Math.min(score, 100))}%`;
  verdictLabel.innerText = data.verdict || 'UNKNOWN';

  if (data.is_fake) {
    cloneAlert.style.display = 'block';
    secureLink.href = data.original_url || '#';
    secureLink.innerText = data.original_url ? `GO TO SECURE ${data.original_url.toUpperCase()} ->` : 'GO TO ORIGINAL SITE ->';
    scoreText.classList.add('text-red-500');
  } else {
    cloneAlert.style.display = 'none';
    scoreText.classList.toggle('text-red-500', score > 70);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAuditInTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'lumina_ping' });
  } catch {
    setDashboardStatus('Injecting Lumina detector...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['config.js', 'content.js']
    });
    await sleep(150);
  }

  return chrome.tabs.sendMessage(tabId, { action: 'run_audit' });
}

function toDashboardPatterns(findings) {
  return (findings || []).map((finding) => ({
    type: finding.type || 'deceptive_pattern',
    name: finding.name || finding.type || 'Deceptive Pattern',
    description: finding.explanation || finding.law || 'Lumina flagged this element as suspicious.',
    text: finding.text || ''
  }));
}

async function syncDashboard(data) {
  if (data.sync === false) {
    setDashboardStatus('Dashboard sync skipped', 'error');
    return;
  }

  if (!data.url || !data.hostname) {
    setDashboardStatus('Dashboard sync skipped', 'error');
    return;
  }

  try {
    const response = await fetch(DASHBOARD_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: data.url,
        hostname: data.hostname,
        score: Number(data.integrity_score || 0),
        patterns: toDashboardPatterns(data.findings),
        timestamp: data.timestamp || new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Dashboard offline');
    }

    setDashboardStatus('Dashboard synced', 'success');
  } catch (error) {
    console.error('Lumina dashboard sync failed:', error);
    setDashboardStatus('Dashboard offline', 'error');
  }
}

scanBtn.addEventListener('click', async () => {
  setButtonBusy(true, 'AUDITING...');
  setDashboardStatus('Starting Lumina detector...');

  const rescueTimeout = setTimeout(() => {
    if (scanBtn.disabled) {
      setButtonBusy(false, 'RE-TRY AUDIT');
      setDashboardStatus('Audit timeout', 'error');
    }
  }, 8000);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) {
      clearTimeout(rescueTimeout);
      setButtonBusy(false, 'REFRESH TAB & TRY');
      setDashboardStatus('Cannot scan browser pages', 'error');
      return;
    }

    await runAuditInTab(tab.id);
  } catch (error) {
    clearTimeout(rescueTimeout);
    console.error('Lumina audit start failed:', error);
    setButtonBusy(false, 'REFRESH TAB & TRY');
    setDashboardStatus('Content script unavailable', 'error');
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== 'audit_done') return;

  const data = msg.payload || {};
  setButtonBusy(false, 'RE-RUN AUDIT');
  renderAudit(data);
  syncDashboard(data);
});
