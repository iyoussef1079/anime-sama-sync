// extension/src/popup/popup.ts

interface PopupState {
  isLoggedIn: boolean;
  syncStatus: string;
  lastAnime: {
    name: string;
    type: string;
    episode: number;
    image: string;
  } | null;
  error: string | null;
}

class PopupManager {
  private state: PopupState = {
    isLoggedIn: false,
    syncStatus: '',
    lastAnime: null,
    error: null
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
        this.updateSyncStatus(message.data.syncing ? 'Synchronisation en cours...' : '');
        if (message.data.error) {
          this.showError(message.data.error);
        }
      }
    });

    // Bouton de connexion
    document.getElementById('loginBtn')?.addEventListener('click', () => this.handleLogin());
    
    // Bouton de synchronisation
    document.getElementById('syncBtn')?.addEventListener('click', () => this.handleSync());
    
    // Bouton de déconnexion
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
  }

  private async initializeState() {
    try {
      // Récupérer l'état de l'utilisateur
      const response = await this.sendMessage({ type: 'GET_USER' });
      console.log('Current user:', response?.user);

      // Mettre à jour l'état de connexion
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
    try {
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
    }
  }

  private async handleSync() {
    try {
      this.updateSyncStatus('Synchronisation en cours...');
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
    }
  }

  private async handleLogout() {
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
      const progress = await chrome.storage.local.get(null);
      if (progress.histoNom?.length > 0) {
        const lastIndex = 0; // Le plus récent
        this.state.lastAnime = {
          name: progress.histoNom[lastIndex] || 'Inconnu',
          type: progress.histoType[lastIndex] || 'TV',
          episode: parseInt(progress.histoEp[lastIndex]) || 0,
          image: progress.histoImg[lastIndex] || '/placeholder.svg'
        };
        this.updateUI();
      }
    } catch (error) {
      console.error('Error updating history:', error);
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
    // Mise à jour des éléments visibles selon l'état de connexion
    const loggedOutSection = document.getElementById('loggedOutSection');
    const loggedInSection = document.getElementById('loggedInSection');
    const statusText = document.getElementById('statusText');
    const errorText = document.getElementById('errorText');
    const lastAnimeSection = document.getElementById('lastAnimeSection');

    if (loggedOutSection && loggedInSection) {
      loggedOutSection.style.display = this.state.isLoggedIn ? 'none' : 'block';
      loggedInSection.style.display = this.state.isLoggedIn ? 'block' : 'none';
    }

    if (statusText) {
      statusText.textContent = this.state.syncStatus;
      statusText.style.display = this.state.syncStatus ? 'block' : 'none';
    }

    if (errorText) {
      errorText.textContent = this.state.error || '';
      errorText.style.display = this.state.error ? 'block' : 'none';
    }

    // Mise à jour de la section du dernier anime
    if (lastAnimeSection && this.state.lastAnime) {
      lastAnimeSection.innerHTML = `
        <div class="last-anime">
          <img src="${this.state.lastAnime.image}" alt="${this.state.lastAnime.name}" />
          <div class="anime-info">
            <h3>${this.state.lastAnime.name}</h3>
            <p>${this.state.lastAnime.type} - Episode ${this.state.lastAnime.episode}</p>
          </div>
        </div>
      `;
      lastAnimeSection.style.display = 'block';
    } else if (lastAnimeSection) {
      lastAnimeSection.style.display = 'none';
    }
  }
}

// Initialiser le gestionnaire de popup quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing PopupManager');
  new PopupManager();
});