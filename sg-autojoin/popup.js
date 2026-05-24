// SteamGifts AutoJoin - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const panelStatusEl = document.getElementById('panel-status');

  // Check if we're on SteamGifts
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('steamgifts.com')) {
      statusEl.textContent = '✓ Estás en SteamGifts';
      statusEl.className = 'status status-active';
      panelStatusEl.textContent = 'Activo en SG';
    } else {
      statusEl.textContent = '✗ No estás en SteamGifts';
      statusEl.className = 'status status-inactive';
      panelStatusEl.textContent = 'Inactivo';
    }
  });

  // Open SteamGifts
  document.getElementById('open-sg').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://www.steamgifts.com/' });
    window.close();
  });

  // Open Giveaways page
  document.getElementById('open-giveaways').addEventListener('click', function() {
    chrome.tabs.create({ url: 'https://www.steamgifts.com/giveaways' });
    window.close();
  });
});
