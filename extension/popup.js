// popup.js - polished extension popup logic
// ======== CONFIGURE YOUR BACKEND URL HERE ========
const BACKEND_VERIFY_URL = "https://misinformation-detector-f3wm.onrender.com/verify"; // <<-- set your backend endpoint
// ================================================

const $ = id => document.getElementById(id);
const setStatus = txt => { const s = $('status'); if (s) s.innerText = txt; };
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

window.addEventListener('DOMContentLoaded', () => {
  // populate selectedClaim if set by background context menu
  chrome.storage.local.get(['selectedClaim'], (res) => {
    if (res && res.selectedClaim) {
      $('claimInput').value = res.selectedClaim;
      chrome.storage.local.remove(['selectedClaim']);
    }
  });

  // wire buttons
  $('checkSelectionBtn').addEventListener('click', async () => {
    const claim = $('claimInput').value.trim();
    if (!claim) { setStatus('Please select or paste a claim.'); return; }
    await runVerify({ claim, is_page: false });
  });

  $('checkPageBtn').addEventListener('click', async () => {
    setStatus('Extracting page text...');
    hide($('result'));
    // get active tab and ask content script for page text
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { setStatus('No active tab found'); return; }

    // Ensure content script present
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (e) {
      console.warn('Could not inject content script:', e);
    }

    chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_TEXT' }, async (resp) => {
      const text = resp && resp.text ? resp.text : '';
      if (!text || text.length < 10) { setStatus('Could not extract meaningful page text.'); return; }
      // show truncated preview
      $('claimInput').value = text.slice(0, 400);
      await runVerify({ claim: text.slice(0, 3000), is_page: true });
    });
  });

  $('rawBtn').addEventListener('click', () => {
    if (!window._lastResponse) { alert('No response yet'); return; }
    const w = window.open('', '_blank', 'width=700,height=700');
    w.document.write(`<pre style="white-space:pre-wrap;font-family:monospace;">${JSON.stringify(window._lastResponse, null, 2)}</pre>`);
  });
});

// central verify routine
async function runVerify(payload) {
  setStatus('Checking…');
  hide($('result'));
  try {
    const resp = await fetch(BACKEND_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      setStatus('Backend error: ' + resp.status);
      // fallback: show cached canned results from backend if you added them
      return;
    }

    const data = await resp.json();
    window._lastResponse = data;
    render(data);
    setStatus('Done');
    show($('result'));
  } catch (err) {
    console.error('Verification error', err);
    setStatus('Error contacting backend. Falling back to demo mode.');
    // optional: try to show canned-in-popup (if you want) else just show message
  }
}

// UI render
function render(data) {
  // badge
  const badge = $('badge');
  badge.className = 'badge';
  const verdict = (data.verdict || 'Uncertain').toLowerCase();
  if (verdict.includes('false')) badge.classList.add('false'), badge.innerText = 'Likely False';
  else if (verdict.includes('true')) badge.classList.add('true'), badge.innerText = 'Likely True';
  else if (verdict.includes('disputed')) badge.classList.add('disputed'), badge.innerText = 'Disputed';
  else badge.classList.add('neutral'), badge.innerText = 'Uncertain';

  // confidence & sources
  $('confidence').innerText = `Confidence: ${typeof data.confidence === 'number' ? data.confidence.toFixed(2) : 'N/A'}`;
  $('sources').innerText = (data.evidence || []).map(e => e.source || '').filter(Boolean).slice(0,3).join(' • ');

  // evidence
  const evList = $('evidenceList');
  evList.innerHTML = '';
  if (Array.isArray(data.evidence) && data.evidence.length) {
    data.evidence.slice(0,3).forEach(ev => {
      const div = document.createElement('div');
      div.className = 'evidence-item';
      const snippet = ev.text || ev.snippet || '';
      const source = ev.source || '';
      const link = ev.link || '';
      div.innerHTML = `<div class="txt">${escapeHtml(snippet)}</div>
                       <div class="meta">${escapeHtml(source)} ${link ? `• <a href="#" data-link="${escapeHtml(link)}">open</a>` : ''}</div>`;
      evList.appendChild(div);

      const a = div.querySelector('a[data-link]');
      if (a) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const url = e.currentTarget.getAttribute('data-link');
          chrome.tabs.create({ url });
        });
      }
    });
  } else {
    evList.innerHTML = '<div class="evidence-item"><div class="txt" style="color:#6b7280">No strong evidence found.</div></div>';
  }

  // signals
  const sg = $('signalsGrid');
  sg.innerHTML = '';
  const signals = data.signals || {};
  for (const k of Object.keys(signals)) {
    const v = signals[k];
    const card = document.createElement('div');
    card.className = 'signal-card';
    card.innerHTML = `<div>${prettySignalName(k)}</div><div>${typeof v === 'number' ? v.toFixed(2) : escapeHtml(String(v))}</div>`;
    sg.appendChild(card);
  }

  // education tip
  $('educationTip').innerText = data.education_tip || 'No tip available';

  // show
  show($('result'));
}

// small helpers
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"'`=\/]/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','=':'&#x3D;','`':'&#x60;'}[c];
  });
}
function prettySignalName(k) {
  const map = { SR: 'Source Reliability', CC: 'Corroboration', SM: 'Stance Match', EQ: 'Evidence Quality', TC: 'Temporal Consistency' };
  return map[k] || k;
}
