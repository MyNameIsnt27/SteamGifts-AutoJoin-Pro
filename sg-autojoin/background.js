// SteamGifts AutoJoin - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[SG AutoJoin] Extension installed successfully!');
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    sendResponse({
      delayBetweenEntries: 2000,
      maxPages: 5,
      minPointsReserve: 0,
    });
  }
  return true;
});
