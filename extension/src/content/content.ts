const currentUrl = window.location.href;
console.log(`[Anime-Sama Sync] Content script loaded for: ${currentUrl}`);

// Test immédiat du localStorage
const storageTest = {
  keys: Object.keys(localStorage),
  sample: localStorage.getItem(Object.keys(localStorage)[0])
};
console.log('[Anime-Sama Sync] Current localStorage state:', storageTest);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Anime-Sama Sync] Received message:', message);

  if (message.type === 'PING') {
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_LOCAL_STORAGE') {
    try {
      // Récupère tout le localStorage
      const data: { [key: string]: string } = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }

      console.log('[Anime-Sama Sync] Sending localStorage data:', data);
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      sendResponse({ success: false, error: String(error) });
    }
  }
  else if (message.type === 'SET_LOCAL_STORAGE') {
    try {
        // Add logging
        console.log('Content script received data:', message.data);
        
        // Log current localStorage state
        console.log('Current localStorage:', {
            histoEp: localStorage.getItem('histoEp'),
            savedEpName: Object.keys(localStorage)
                .filter(key => key.startsWith('savedEpName'))
                .reduce((acc, key) => ({
                    ...acc,
                    [key]: localStorage.getItem(key)
                }), {})
        });

        // Set localStorage items
        Object.entries(message.data).forEach(([key, value]) => {
            console.log(`Setting ${key}:`, value);
            localStorage.setItem(key, value as string);
        });

        // Verify after setting
        console.log('localStorage after update:', {
            histoEp: localStorage.getItem('histoEp'),
            savedEpName: Object.keys(localStorage)
                .filter(key => key.startsWith('savedEpName'))
                .reduce((acc, key) => ({
                    ...acc,
                    [key]: localStorage.getItem(key)
                }), {})
        });

        sendResponse({ success: true });
    } catch (error) {
        console.error('Error setting localStorage:', error);
        sendResponse({ success: false, error: String(error) });
    }
  } else {
      console.log('[Anime-Sama Sync] Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep message channel open for async response
});

chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  url: currentUrl
}, response => {
  console.log('[Anime-Sama Sync] Background script acknowledged load:', response);
});