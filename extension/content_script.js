
(function () {
  function getVisibleArticleText() {
    // Prefer <article> or <main>
    const article = document.querySelector('article');
    if (article && article.innerText.trim().length > 150) return article.innerText.trim();

    const main = document.querySelector('main');
    if (main && main.innerText.trim().length > 150) return main.innerText.trim();

    // fallback: large paragraphs
    const body = document.body.cloneNode(true);
    const removeSelectors = ['script','style','noscript','iframe','nav','footer','header','aside'];
    removeSelectors.forEach(s => body.querySelectorAll(s).forEach(n => n.remove()));

    const paras = Array.from(body.querySelectorAll('p'))
      .map(p => p.innerText.trim())
      .filter(t => t.length > 60);

    if (paras.length >= 3) return paras.join("\n\n");

    return (document.body.innerText || "").trim();
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;
    if (msg.action === 'GET_SELECTION') {
      const sel = window.getSelection ? window.getSelection().toString() : '';
      sendResponse({ selection: sel });
      return true;
    }
    if (msg.action === 'GET_PAGE_TEXT') {
      const text = getVisibleArticleText();
      sendResponse({ text });
      return true;
    }
    if (msg.action === 'PING') {
      sendResponse({ ok: true });
      return true;
    }
  });
})();
