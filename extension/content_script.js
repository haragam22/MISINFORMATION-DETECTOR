// content_script.js
// Inject this script in pages to respond to selection and page-text requests.

// Helper: get visible article/body text (simple heuristics)
function getVisibleArticleText() {
  // Prefer <article> or <main>
  const article = document.querySelector('article');
  if (article && article.innerText.trim().length > 100) return article.innerText.trim();

  const main = document.querySelector('main');
  if (main && main.innerText.trim().length > 100) return main.innerText.trim();

  // Fallback: gather large paragraphs within body
  const body = document.body;
  // Remove script/style/hidden elements temporarily
  const blockers = body.querySelectorAll('script, style, noscript, iframe, nav, footer, header, aside');
  blockers.forEach(el => el.remove());

  const paragraphs = Array.from(body.querySelectorAll('p'))
    .map(p => p.innerText.trim())
    .filter(t => t.length > 50);

  if (paragraphs.length >= 3) return paragraphs.join("\n\n");

  // As last resort return trimmed body text
  return (body.innerText || "").trim();
}

// Listen for messages from background/popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'GET_SELECTION') {
    const sel = window.getSelection ? window.getSelection().toString() : '';
    sendResponse({ selection: sel });
    return true;
  }
  if (msg && msg.action === 'GET_PAGE_TEXT') {
    const text = getVisibleArticleText();
    sendResponse({ text });
    return true;
  }
});
