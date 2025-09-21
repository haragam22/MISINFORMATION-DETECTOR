// background.js - service worker
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "truthlens-check-selection",
    title: "Check Claim with TruthLens",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "truthlens-check-selection") return;
  try {
    // store the selection (try to get from content script)
    let selected = info.selectionText || "";

    // Inject content script (MV3) to get exact selection if possible
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      chrome.tabs.sendMessage(tab.id, { action: "GET_SELECTION" }, (resp) => {
        if (resp && resp.selection) selected = resp.selection;
        chrome.storage.local.set({ selectedClaim: selected }, () => {
          chrome.action.openPopup().catch(() => {
            chrome.notifications && chrome.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "TruthLens",
              message: "Click the TruthLens icon in the toolbar to open the popup."
            });
          });
        });
      });
    } catch (e) {
      // fallback if injection fails
      chrome.storage.local.set({ selectedClaim: selected }, () => {
        chrome.action.openPopup().catch(() => {});
      });
    }
  } catch (err) {
    console.error("Context menu error:", err);
  }
});
