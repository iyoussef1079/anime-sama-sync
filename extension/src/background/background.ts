// extension/src/background/background.ts
import { LocalStore } from '../storage/localStore';
import { SyncMessage, SyncState } from '../../../shared/types';
import { AuthService } from '../services/authService';
import { SyncService } from '../services/syncService';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let syncInterval: NodeJS.Timeout | null = null;
let lastSyncTime: number = 0;
const DEBOUNCE_DELAY = 2000; // 2 secondes de debounce

// État de la synchronisation pour éviter les syncs simultanées
let isSyncing = false;

// Surveille les changements dans le localStorage avec debounce
let debounceTimeout: NodeJS.Timeout | null = null;
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    const relevantChanges = Object.keys(changes).some(key =>
      key.startsWith('savedEpNb/') ||
      key.startsWith('savedEpName/') ||
      key.includes('histo')
    );

    if (relevantChanges) {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        await triggerSync(true);
      }, DEBOUNCE_DELAY);
    }
  }
});

// Gestionnaire de messages de l'extension
chrome.runtime.onMessage.addListener((message: SyncMessage, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(error => {
    console.error('Message handling error:', error);
    sendResponse({ success: false, error: error.message });
  });
  return true; // Indique que la réponse sera envoyée de manière asynchrone
});

// Gestionnaire de messages
async function handleMessage(message: SyncMessage): Promise<any> {
  try {
    switch (message.type) {
      case 'SYNC_REQUEST':
        return await triggerSync(true);
      case 'LOGIN_REQUEST':
        return await handleLogin();
      case 'LOGOUT_REQUEST':
        return await handleLogout();
      case 'SYNC_STATE_CHANGED':
        return await updateSyncState(message.data);
      default:
        throw new Error('Unknown message type');
    }
  } catch (error) {
    console.error(`Error handling message ${message.type}:`, error);
    throw error;
  }
}

// Gestion de la connexion
async function handleLogin(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await AuthService.signInWithGoogle();
    if (user) {
      startSyncInterval();
      const syncResult = await triggerSync(true); // Synchronise immédiatement après la connexion
      return syncResult;
    }
    return { success: false, error: 'Login failed' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Login error' };
  }
}

// Gestion de la déconnexion
async function handleLogout(): Promise<{ success: boolean; error?: string }> {
  try {
    stopSyncInterval();
    await AuthService.signOut();
    // Nettoyer l'état de synchronisation
    await updateSyncState({
      lastSync: null,
      syncing: false,
      error: null
    });
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Logout error' };
  }
}

// Déclenche la synchronisation
async function triggerSync(force: boolean = false): Promise<{ success: boolean; error?: string }> {
  // Éviter les synchronisations simultanées
  if (isSyncing) {
    return { success: false, error: 'Sync already in progress' };
  }

  // Vérifier le délai minimum entre les syncs si pas forcé
  const now = Date.now();
  if (!force && now - lastSyncTime < SYNC_INTERVAL) {
    return { success: true };
  }

  try {
    isSyncing = true;
    await updateSyncState({ syncing: true, error: null });

    const user = await AuthService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const token = await AuthService.getIdToken();
    if (!token) {
      throw new Error('No valid token');
    }

    const serverProgress = await SyncService.syncWithServer(token);
    if (serverProgress) {
      const localProgress = await LocalStore.getProgress();
      const mergedProgress = await SyncService.mergeProgress(localProgress, serverProgress);
      await LocalStore.saveProgress(mergedProgress);
    }

    lastSyncTime = now;
    updateBadge('✓');
    setTimeout(() => updateBadge(''), 3000);
    
    await updateSyncState({
      lastSync: new Date(),
      syncing: false,
      error: null
    });

    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    updateBadge('!');
    
    await updateSyncState({
      syncing: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    });

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sync failed'
    };
  } finally {
    isSyncing = false;
  }
}

// Mise à jour de l'état de synchronisation
async function updateSyncState(state: Partial<SyncState>): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'SYNC_STATE_CHANGED',
    data: state
  });
}

// Démarre l'intervalle de synchronisation
function startSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  syncInterval = setInterval(() => triggerSync(false), SYNC_INTERVAL);
}

// Arrête l'intervalle de synchronisation
function stopSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Met à jour le badge de l'extension
function updateBadge(text: string) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({
    color: text === '!' ? '#FF0000' : '#00FF00'
  });
}

// Initialisation au démarrage
async function initialize() {
  try {
    const user = await AuthService.getCurrentUser();
    if (user) {
      startSyncInterval();
      await triggerSync(true);
    }
  } catch (error) {
    console.error('Initialization error:', error);
    await updateSyncState({
      error: error instanceof Error ? error.message : 'Initialization failed'
    });
  }
}

// Lance l'initialisation
initialize();