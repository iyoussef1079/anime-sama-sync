// extension/src/popup/popup.ts
import { AnimeProgress, AnimeEntry } from '../types';

interface PopupState {
  isLoggedIn: boolean;
  syncStatus: string;
  lastAnime: AnimeEntry | null;
  error: string | null;
  syncInProgress: boolean;
}

class PopupManager {
  private state: PopupState = {
    isLoggedIn: false,
    syncStatus: '',
    lastAnime: null,
    error: null,
    syncInProgress: false
  };

  constructor() {
    this.initialize();
  }

  private async initialize() {
    console.log('Initializing popup...');
    
    // Mettre en place les écouteurs d'événements
    this.setupEventListeners();
    
    // Récupérer l'état initial
    await this.initializeState();
  }

  private setupEventListeners() {
    // Écouter les messages du background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SYNC_STATE_CHANGED') {
        this.handleSyncStateChange(message.data);
      }
    });

    // Event listeners for buttons
    this.setupButtonListeners();
  }

  private setupButtonListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('syncBtn')?.addEventListener('click', () => this.handleSync());
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
  }

  private handleSyncStateChange(data: { syncing: boolean; error?: string }) {
    this.state.syncInProgress = data.syncing;
    this.updateSyncStatus(data.syncing ? 'Synchronisation en cours...' : '');
    
    if (data.error) {
      this.showError(data.error);
    }

    if (!data.syncing && !data.error) {
      this.updateHistory();
    }
  }

  private async initializeState() {
    try {
      const response = await this.sendMessage({ type: 'GET_USER' });
      console.log('Current user:', response?.user);

      this.updateLoginState(!!response?.user);

      if (response?.user) {
        await this.updateHistory();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.showError("Erreur d'initialisation");
    }
  }

  private async handleLogin() {
    if (this.state.syncInProgress) return;

    try {
      this.updateSyncStatus('Connexion en cours...');
      const response = await this.sendMessage({ type: 'LOGIN_REQUEST' });
      
      if (response?.success) {
        this.updateLoginState(true);
        await this.updateHistory();
      } else {
        this.showError(response?.error || 'Échec de la connexion');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError('Erreur de connexion');
    } finally {
      this.updateSyncStatus('');
    }
  }

  private async handleSync() {
    if (this.state.syncInProgress) return;

    try {
      this.state.syncInProgress = true;
      this.updateSyncStatus('Synchronisation en cours...');
      this.updateUI(); // Update UI to show sync in progress

      const response = await this.sendMessage({ type: 'SYNC_REQUEST' });
      
      if (response?.success) {
        this.updateSyncStatus('Synchronisation terminée !');
        setTimeout(() => this.updateSyncStatus(''), 3000);
        await this.updateHistory();
      } else {
        this.showError(response?.error || 'Échec de la synchronisation');
      }
    } catch (error) {
      console.error('Sync error:', error);
      this.showError('Erreur de synchronisation');
    } finally {
      this.state.syncInProgress = false;
      this.updateUI();
    }
  }

  private async handleLogout() {
    if (this.state.syncInProgress) return;

    try {
      const response = await this.sendMessage({ type: 'LOGOUT_REQUEST' });
      if (response?.success) {
        this.updateLoginState(false);
        this.state.lastAnime = null;
        this.updateUI();
      } else {
        this.showError(response?.error || 'Échec de la déconnexion');
      }
    } catch (error) {
      console.error('Logout error:', error);
      this.showError('Erreur de déconnexion');
    }
  }

  private async updateHistory() {
    try {
      const storage = await chrome.storage.local.get('progress');
      const progress = storage.progress as AnimeProgress;
      
      if (progress?.histo?.entries?.length > 0) {
        this.state.lastAnime = progress.histo.entries[0];
        this.updateUI();
      }
    } catch (error) {
      console.error('Error updating history:', error);
      this.showError('Erreur lors de la mise à jour de l\'historique');
    }
  }

  private async sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  private updateLoginState(isLoggedIn: boolean) {
    this.state.isLoggedIn = isLoggedIn;
    this.updateUI();
  }

  private updateSyncStatus(status: string) {
    this.state.syncStatus = status;
    this.updateUI();
  }

  private showError(message: string) {
    this.state.error = message;
    this.updateUI();
    setTimeout(() => {
      this.state.error = null;
      this.updateUI();
    }, 5000);
  }

  private updateUI() {
    this.updateVisibility();
    this.updateStatusBadge();
    this.updateStatusText();
    this.updateErrorText();
    this.updateLastAnime();
    this.updateButtons();
  }

  private updateVisibility() {
    const loggedOutSection = document.getElementById('loggedOutSection');
    const loggedInSection = document.getElementById('loggedInSection');

    if (loggedOutSection && loggedInSection) {
      loggedOutSection.style.display = this.state.isLoggedIn ? 'none' : 'block';
      loggedInSection.style.display = this.state.isLoggedIn ? 'block' : 'none';
    }
  }

  private updateStatusBadge() {
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
      statusBadge.textContent = this.state.isLoggedIn ? 'Connecté' : 'Déconnecté';
      statusBadge.className = `status-badge ${this.state.isLoggedIn ? 'connected' : 'disconnected'}`;
    }
  }

  private updateStatusText() {
    const statusText = document.getElementById('statusText');
    if (statusText) {
      statusText.textContent = this.state.syncStatus;
      statusText.style.display = this.state.syncStatus ? 'block' : 'none';
    }
  }

  private updateErrorText() {
    const errorText = document.getElementById('errorText');
    if (errorText) {
      errorText.textContent = this.state.error || '';
      errorText.style.display = this.state.error ? 'block' : 'none';
    }
  }

  private updateLastAnime() {
    const lastAnimeSection = document.getElementById('lastAnimeSection');
    if (lastAnimeSection && this.state.lastAnime) {
      lastAnimeSection.innerHTML = `
        <div class="last-anime">
          <img src="${this.state.lastAnime.image}" alt="${this.state.lastAnime.name}" />
          <div class="anime-info">
            <h3>${this.state.lastAnime.name}</h3>
            <p>${this.state.lastAnime.type} - ${this.state.lastAnime.episode}</p>
          </div>
        </div>
      `;
      lastAnimeSection.style.display = 'block';
    } else if (lastAnimeSection) {
      lastAnimeSection.style.display = 'none';
    }
  }

  private updateButtons() {
    const syncBtn = document.getElementById('syncBtn') as HTMLButtonElement;
    const loginBtn = document.getElementById('loginBtn') as HTMLButtonElement;
    const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

    if (syncBtn) {
      syncBtn.disabled = this.state.syncInProgress;
      syncBtn.textContent = this.state.syncInProgress ? 'Synchronisation...' : 'Synchroniser maintenant';
    }

    if (loginBtn) {
      loginBtn.disabled = this.state.syncInProgress;
    }

    if (logoutBtn) {
      logoutBtn.disabled = this.state.syncInProgress;
    }
  }
}

// Initialize the popup manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing PopupManager');
  new PopupManager();
});