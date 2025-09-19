// background.js - service worker
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for selected text
  chrome.contextMenus.create({
    id: "check-claim-selection",
    title: "Check Claim with TruthLens",
    contexts: ["selection"]
  });
});

// Listen for context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "check-claim-selection") {
    // Ask the content script in the active tab for the selected text
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(activeTab.id, { action: "GET_SELECTION" }, (resp) => {
        const selectedText = (resp && resp.selection) ? resp.selection : (info.selectionText || "");
        // Save selection to storage for popup to read
        chrome.storage.local.set({ selectedClaim: selectedText }, () => {
          // Open popup (user gesture not required when triggered by context menu callback)
          chrome.action.openPopup().catch((err) => {
            // fallback: if openPopup fails, notify user
            chrome.notifications && chrome.notifications.create({
              type: "basic",
              iconUrl: 'icons/icon48.png',
              title: 'TruthLens',
              message: 'Popup could not be opened automatically. Click the extension icon to open.'
            });
          });
        });
      });
    } catch (err) {
      console.error("background.onClicked error:", err);
    }
  }
});
