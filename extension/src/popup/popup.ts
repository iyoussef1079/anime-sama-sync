// extension/src/popup/popup.ts
import { SyncMessage, SyncState, AnimeProgress } from '../../../shared/types';
import { LocalStore } from '../storage/localStore';

class PopupManager {
    private statusContainer!: HTMLElement;
    private loginContainer!: HTMLElement;
    private syncContainer!: HTMLElement;
    private historyContainer!: HTMLElement;
    private lastAnimeContainer!: HTMLElement;
    private loginButton!: HTMLButtonElement;
    private syncButton!: HTMLButtonElement;
    private logoutButton!: HTMLButtonElement;
    private connectionStatus!: HTMLElement;

    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.initializePopup();
    }

    private initializeElements() {
        this.statusContainer = document.getElementById('statusContainer')!;
        this.loginContainer = document.getElementById('loginContainer')!;
        this.syncContainer = document.getElementById('syncContainer')!;
        this.historyContainer = document.getElementById('historyContainer')!;
        this.lastAnimeContainer = document.getElementById('lastAnime')!;
        this.loginButton = document.getElementById('loginButton') as HTMLButtonElement;
        this.syncButton = document.getElementById('syncButton') as HTMLButtonElement;
        this.logoutButton = document.getElementById('logoutButton') as HTMLButtonElement;
        this.connectionStatus = document.getElementById('connectionStatus')!;
    }

    private setupEventListeners() {
        this.loginButton.addEventListener('click', () => this.handleLogin());
        this.syncButton.addEventListener('click', () => this.handleSync());
        this.logoutButton.addEventListener('click', () => this.handleLogout());

        chrome.runtime.onMessage.addListener((message: SyncMessage) => {
            if (message.type === 'SYNC_STATE_CHANGED') {
                this.updateSyncStatus(message.data);
            }
            return true;
        });
    }

    private async initializePopup() {
        try {
            console.log('Initializing popup...');
            const user = await this.getCurrentUser();
            console.log('Current user:', user);
            this.updateUIState(!!user);

            if (user) {
                await this.updateHistory();
            }
        } catch (error) {
            console.error('Popup initialization error:', error);
            this.showError('Erreur d\'initialisation');
        }
    }

    private async getCurrentUser(): Promise<any> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_USER' }, (response) => {
                resolve(response?.user || null);
            });
        });
    }

    private async handleLogin() {
        console.log('Starting login process...');
        this.setButtonLoading(this.loginButton, true);
        try {
            const token = await this.getAuthToken();
            console.log('Auth token received:', !!token);

            if (token) {
                const userInfo = await this.fetchUserInfo(token);
                console.log('User info received:', userInfo);

                const response = await this.sendMessage({ 
                    type: 'LOGIN_REQUEST',
                    data: { token, userInfo }
                });

                if (response.success) {
                    this.updateUIState(true);
                    await this.updateHistory();
                } else {
                    throw new Error(response.error || 'Échec de la connexion');
                }
            } else {
                throw new Error('Pas de token reçu');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error instanceof Error ? error.message : 'Erreur de connexion');
        } finally {
            this.setButtonLoading(this.loginButton, false);
        }
    }

    private getAuthToken(): Promise<string | null> {
        return new Promise((resolve) => {
            chrome.identity.getAuthToken({ interactive: true }, function(token) {
                if (chrome.runtime.lastError) {
                    console.error('Auth Error:', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }
                resolve(token || null);
            });
        });
    }

    private async fetchUserInfo(token: string) {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user info');
            }

            return response.json();
        } catch (error) {
            console.error('Error fetching user info:', error);
            throw error;
        }
    }

    private async handleSync() {
        this.setButtonLoading(this.syncButton, true);
        try {
            const response = await this.sendMessage({ type: 'SYNC_REQUEST' });
            if (response.success) {
                await this.updateHistory();
            } else {
                this.showError(response.error || 'Échec de la synchronisation');
            }
        } catch (error) {
            console.error('Sync error:', error);
            this.showError('Erreur de synchronisation');
        } finally {
            this.setButtonLoading(this.syncButton, false);
        }
    }

    private async handleLogout() {
        try {
            const response = await this.sendMessage({ type: 'LOGOUT_REQUEST' });
            if (response.success) {
                this.updateUIState(false);
            } else {
                this.showError('Échec de la déconnexion');
            }
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Erreur de déconnexion');
        }
    }

    private async updateHistory() {
        try {
            const progress = await LocalStore.getProgress();
            if (progress.histo.histoNom.length > 0) {
                const lastIndex = 0;
                const html = `
                    <strong>${progress.histo.histoNom[lastIndex]}</strong>
                    <div>${progress.histo.histoType[lastIndex]}</div>
                    <div>${progress.histo.histoEp[lastIndex]}</div>
                `;
                this.lastAnimeContainer.innerHTML = html;
                this.historyContainer.style.display = 'block';
            }
        } catch (error) {
            console.error('Error updating history:', error);
        }
    }

    private updateUIState(isLoggedIn: boolean) {
        console.log('Updating UI state:', isLoggedIn);
        this.loginContainer.style.display = isLoggedIn ? 'none' : 'block';
        this.syncContainer.style.display = isLoggedIn ? 'block' : 'none';
        this.connectionStatus.textContent = isLoggedIn ? '🟢' : '🔴';
    }

    private updateSyncStatus(state: SyncState) {
        let statusClass = 'status';
        let message = '';

        if (state.syncing) {
            statusClass += ' syncing';
            message = 'Synchronisation en cours...';
        } else if (state.error) {
            statusClass += ' error';
            message = `Erreur: ${state.error}`;
        } else if (state.lastSync) {
            statusClass += ' success';
            message = `Dernière sync: ${new Date(state.lastSync).toLocaleTimeString()}`;
        }

        if (message) {
            this.statusContainer.innerHTML = `<div class="${statusClass}">${message}</div>`;
        }
    }

    private setButtonLoading(button: HTMLButtonElement, loading: boolean) {
        button.disabled = loading;
        button.classList.toggle('disabled', loading);
        const originalText = button.dataset.originalText || button.textContent || '';
        if (loading) {
            button.dataset.originalText = originalText;
            button.textContent = 'Chargement...';
        } else {
            button.textContent = originalText;
        }
    }

    private async sendMessage(message: SyncMessage): Promise<any> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response);
            });
        });
    }

    private showError(message: string) {
        console.error('Error:', message);
        this.updateSyncStatus({
            lastSync: null,
            syncing: false,
            error: message
        });
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing PopupManager');
    new PopupManager();
});