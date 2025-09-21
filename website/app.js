// app.js - minimal logic to call the backend and render results
// Set your backend endpoint here:
const BACKEND_URL = "https://misinformation-detector-f3wm.onrender.com"; // <<-- CHANGE for production

// Demo canned claims for fallback (same keys as backend canned claims for reliability)
const CANNED_EXAMPLES = {
  "covid vaccines cause infertility": {
    verdict: "Likely False",
    confidence: 0.92,
    evidence: [
      { text: "WHO: There is no evidence vaccines cause infertility", link: "https://www.who.int/news-room", source: "WHO", stance: "refute" }
    ],
    signals: { SR:0.9, CC:0.8, SM:0.7, EQ:0.9, TC:1.0 },
    education_tip: "Check official health organizations and peer-reviewed studies."
  },
  "supreme court banned firecrackers nationwide": {
    verdict: "Disputed",
    confidence: 0.48,
    evidence: [
      { text: "Some outlets report state-level partial bans; no nationwide ban verified", link: "https://example-news.com", source: "Example News", stance: "mixed" }
    ],
    signals: { SR:0.6, CC:0.3, SM:0.2, EQ:0.3, TC:0.8 },
    education_tip: "Check the original court judgement and multiple news outlets."
  },
  "mars has liquid oceans today": {
    verdict: "Likely False",
    confidence: 0.95,
    evidence: [
      { text: "NASA: No evidence of current liquid oceans on Mars", link: "https://www.nasa.gov", source: "NASA", stance: "refute" }
    ],
    signals: { SR:0.95, CC:0.9, SM:0.8, EQ:0.9, TC:1.0 },
    education_tip: "Prefer official scientific sources like NASA and peer-reviewed papers."
  }
};

// Helpers
const $ = (id) => document.getElementById(id);
const hide = el => el.classList.add('hidden');
const show = el => el.classList.remove('hidden');

// Render result
function renderResult(data) {
  const resultArea = $('resultArea');
  resultArea.innerHTML = ''; // clear
  resultArea.classList.remove('hidden');

  // Card wrapper
  const card = document.createElement('div');
  card.className = 'mt-4 p-4 rounded-lg border border-slate-100 bg-white shadow';

  // Header: verdict + confidence
  const verdictLower = (data.verdict || 'Uncertain').toLowerCase();
  let badgeColor = 'bg-gray-300 text-slate-700';
  if (verdictLower.includes('false')) badgeColor = 'bg-red-100 text-red-700';
  else if (verdictLower.includes('true')) badgeColor = 'bg-emerald-100 text-emerald-700';
  else if (verdictLower.includes('disputed')) badgeColor = 'bg-amber-100 text-amber-800';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-3';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="px-3 py-1 rounded-md ${badgeColor} font-semibold">${data.verdict}</div>
      <div class="text-sm text-slate-500">Confidence: ${(data.confidence||0).toFixed(2)}</div>
    </div>
    <div class="text-xs text-slate-400">Sources: ${ (data.evidence||[]).map(e => e.source || '').slice(0,3).join(' • ') || 'none' }</div>
  `;
  card.appendChild(header);

  // Evidence
  const evWrap = document.createElement('div');
  evWrap.innerHTML = `<div class="text-sm font-semibold mb-2">Top evidence</div>`;
  const evList = document.createElement('div');
  evList.className = 'space-y-2';
  const evidence = (data.evidence && data.evidence.length) ? data.evidence.slice(0,3) : [];
  if (evidence.length === 0) {
    evList.innerHTML = '<div class="text-sm text-slate-500">No strong evidence found.</div>';
  } else {
    evidence.forEach(ev => {
      const evItem = document.createElement('div');
      evItem.className = 'p-3 rounded-md border border-slate-100 bg-slate-50';
      evItem.innerHTML = `<div class="text-sm text-slate-700">${escapeHtml(ev.text || ev.snippet || '')}</div>
        <div class="mt-1 text-xs text-slate-400">Source: ${escapeHtml(ev.source || '')} • <a href="${ev.link || '#'}" target="_blank" class="underline text-indigo-600">open</a></div>`;
      evList.appendChild(evItem);
    });
  }
  evWrap.appendChild(evList);
  card.appendChild(evWrap);

  // Signals
  const signals = data.signals || {};
  const signalsWrap = document.createElement('div');
  signalsWrap.className = 'mt-4';
  signalsWrap.innerHTML = `<div class="text-sm font-semibold mb-2">Transparency — Signal breakdown</div>`;
  const tbl = document.createElement('div');
  tbl.className = 'grid grid-cols-2 gap-2 text-sm text-slate-600';
  for (const [k, v] of Object.entries(signals)) {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center p-2 bg-white border border-slate-50 rounded';
    row.innerHTML = `<div class="font-medium">${prettySignalName(k)}</div><div>${(typeof v === 'number') ? v.toFixed(2) : v}</div>`;
    tbl.appendChild(row);
  }
  signalsWrap.appendChild(tbl);
  card.appendChild(signalsWrap);

  // Education tip
  const edu = document.createElement('div');
  edu.className = 'mt-4 p-3 rounded-md bg-amber-50 border-l-4 border-amber-200';
  edu.innerHTML = `<div class="text-sm font-semibold text-amber-800">Education tip</div><div class="text-sm text-amber-900">${escapeHtml(data.education_tip || 'No tip available.')}</div>`;
  card.appendChild(edu);

  // Append and scroll into view
  resultArea.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // hide loader
  hide($('loading'));
}

// Helpers
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"'`=\/]/g, function (c) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '=': '&#x3D;',
      '`': '&#x60;'
    })[c];
  });
}

function prettySignalName(k) {
  const map = { SR: 'Source Reliability', CC: 'Corroboration', SM: 'Stance Match', EQ: 'Evidence Quality', TC: 'Temporal Consistency' };
  return map[k] || k;
}
function showLoading() {
  $('loading').classList.remove('hidden');
}
function hideLoading() {
  $('loading').classList.add('hidden');
}

// Main: check claim by calling backend
async function checkClaimRemote(claim) {
  // Request payload
  const payload = { claim, is_page: false };
  try {
    showLoading();
    const resp = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      // fallback to canned: simulate uncertain or use canned if matching
      console.warn('Backend returned', resp.status);
      hideLoading();
      return null;
    }
    const data = await resp.json();
    hideLoading();
    return data;
  } catch (err) {
    console.warn('Error contacting backend:', err);
    hideLoading();
    return null;
  }
}

// Public flow: triggered by UI
async function runCheck(claimText) {
  if (!claimText || claimText.trim().length < 4) {
    alert('Please paste a short claim or select one of the sample claims.');
    return;
  }
  // Try remote first
  const remote = await checkClaimRemote(claimText);
  if (remote) {
    renderResult(remote);
    return;
  }
  // fallback to canned if remote unavailable or returned null
  const key = claimText.trim().toLowerCase();
  let canned = null;
  for (const k of Object.keys(CANNED_EXAMPLES)) {
    if (key.includes(k)) { canned = CANNED_EXAMPLES[k]; break; }
  }
  if (!canned) {
    // default uncertain fallback
    canned = {
      verdict: 'Uncertain',
      confidence: 0.30,
      evidence: [],
      signals: { SR:0, CC:0, SM:0, EQ:0, TC:0 },
      education_tip: 'No strong evidence found. Try checking official sources or refine the claim.'
    };
  }
  renderResult(canned);
}

// Wire UI
document.addEventListener('DOMContentLoaded', () => {
  // sample chips
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-claim');
      $('claimInput').value = text;
    });
  });

  $('checkBtn').addEventListener('click', async () => {
    const claim = $('claimInput').value.trim();
    hide($('resultArea'));
    showLoading();
    await runCheck(claim);
  });

  $('checkUrlBtn').addEventListener('click', async () => {
    const url = prompt('Enter URL to analyze (the backend must support page text analysis to use this):');
    if (!url) return;
    const claim = `Analyze page: ${url}`;
    hide($('resultArea'));
    showLoading();
    // for MVP we treat as claim text; backend may accept is_page true and handle scraping if implemented
    const payload = { claim: url, is_page: true };
    const remote = await checkClaimRemote(url);
    if (remote) { renderResult(remote); return; }
    // fallback: no page analysis
    renderResult({
      verdict: 'Uncertain',
      confidence: 0.25,
      evidence: [],
      signals: { SR:0, CC:0, SM:0, EQ:0, TC:0 },
      education_tip: 'Page analysis not available in demo. Try pasting a claim instead.'
    });
  });
});
