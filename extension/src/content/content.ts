console.log('Content script loaded for:', window.location.href);

// Test immédiat du localStorage
const storageTest = {
  keys: Object.keys(localStorage),
  sample: localStorage.getItem(Object.keys(localStorage)[0])
};
console.log('Initial localStorage test:', storageTest);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] received message:', message);

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

      console.log('Sending localStorage data:', data);
      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      sendResponse({ success: false, error: String(error) });
    }
  }

  return true; // Garde le canal de message ouvert
});