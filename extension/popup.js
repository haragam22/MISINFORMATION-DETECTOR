// popup.js - handles UI and talks to backend + content script

// ========== CONFIG =========
// Put your backend URL here. For local dev use http://localhost:8000/verify
// For production use deployed URL like "https://your-backend.com/verify"
const BACKEND_VERIFY_URL = "http://localhost:8000/verify"; // <--- CHANGE BEFORE DEMO
// ============================

/** Utilities **/
const $ = id => document.getElementById(id);
const showStatus = (txt) => { $('status').innerText = txt; };
const showResultCard = (show) => { $('resultCard').classList.toggle('hidden', !show); };

// Try to ensure content script present: programmatic injection if needed
async function ensureContentScript(tabId) {
  try {
    // Try sending a test message first
    await chrome.tabs.sendMessage(tabId, { action: "PING" });
    return;
  } catch (err) {
    // Inject content_script.js if not present
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content_script.js"]
      });
    } catch (e) {
      console.warn("Could not inject content script:", e);
    }
  }
}

// On load: populate selection if stored (from context menu)
window.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['selectedClaim'], (res) => {
    if (res && res.selectedClaim) {
      $('claimInput').value = res.selectedClaim;
      // clear stored selection so it doesn't persist next time
      chrome.storage.local.remove(['selectedClaim']);
    }
  });
});

// Show raw JSON in alert (simple)
$('rawBtn').addEventListener('click', () => {
  if (window._lastResponse) {
    alert(JSON.stringify(window._lastResponse, null, 2));
  } else {
    alert("No results yet");
  }
});

// Check selection button
$('checkSelectionBtn').addEventListener('click', async () => {
  const claim = $('claimInput').value.trim();
  if (!claim) {
    showStatus("No claim provided. Highlight text on a page and use right-click → Check Claim.");
    return;
  }
  await runVerification(claim);
});

// Check full page button
$('checkPageBtn').addEventListener('click', async () => {
  showStatus("Extracting page text...");
  showResultCard(false);
  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { showStatus("No active tab found"); return; }

  // Ensure content script loaded
  await ensureContentScript(tab.id);

  // Request page text
  chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_TEXT" }, async (resp) => {
    const pageText = resp && resp.text ? resp.text : "";
    if (!pageText || pageText.length < 50) {
      showStatus("Could not extract meaningful page text.");
      return;
    }
    // Optionally summarize or truncate long text to send to backend
    const truncated = pageText.length > 2500 ? pageText.slice(0, 2500) + "...(truncated)" : pageText;
    $('claimInput').value = truncated.slice(0, 400); // show a preview
    await runVerification(truncated, true);
  });
});

// Core: call backend, show results
async function runVerification(claimText, isPage = false) {
  showStatus("Checking claim...");
  showResultCard(false);
  try {
    const payload = { claim: claimText, is_page: !!isPage };
    const resp = await fetch(BACKEND_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keep credentials false for demo; if backend requires auth adapt accordingly
    });
    if (!resp.ok) {
      showStatus("Backend error: " + resp.status);
      return;
    }
    const data = await resp.json();
    window._lastResponse = data; // store for raw view

    // display verdict and confidence
    $('verdictLine').innerText = `Verdict: ${data.verdict || "Unknown"}`;
    $('confidenceLine').innerText = `Confidence: ${typeof data.confidence === 'number' ? data.confidence.toFixed(2) : 'N/A'}`;

    // evidence list
    const evList = $('evidenceList');
    evList.innerHTML = "";
    if (Array.isArray(data.evidence) && data.evidence.length > 0) {
      data.evidence.slice(0, 3).forEach(ev => {
        const div = document.createElement('div');
        div.className = 'evidence-item';
        // each ev: { text, link, source, stance }
        const source = ev.source ? ` — ${ev.source}` : "";
        const linkHtml = ev.link ? ` <a href="${ev.link}" target="_blank" rel="noreferrer">source</a>` : "";
        div.innerHTML = `<div>${ev.text || ''}${source}${linkHtml}</div>`;
        evList.appendChild(div);
      });
    } else {
      evList.innerHTML = "<div>No strong evidence found.</div>";
    }

    // signals
    $('signalsPre').innerText = JSON.stringify(data.signals || {}, null, 2);

    // education tip
    $('educationTip').innerText = data.education_tip || "No tip available.";

    showStatus("Done");
    showResultCard(true);
  } catch (err) {
    console.error("runVerification error:", err);
    showStatus("Error contacting backend (check backend URL and CORS).");
  }
}
