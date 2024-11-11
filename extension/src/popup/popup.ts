// extension/src/popup/popup.ts
import { SyncMessage, SyncState, AnimeProgress } from '../types';
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

        // Écouter les messages du background script
        chrome.runtime.onMessage.addListener((message: SyncMessage) => {
            if (message.type === 'SYNC_STATE_CHANGED') {
                this.updateSyncStatus(message.data);
            }
            return true;
        });
    }

    private async initializePopup() {
        try {
            // Vérifier l'état de connexion
            const user = await this.getCurrentUser();
            this.updateUIState(!!user);

            if (user) {
                // Mettre à jour l'historique
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
        this.setButtonLoading(this.loginButton, true);
        try {
            const response = await this.sendMessage({ type: 'LOGIN_REQUEST' });
            if (response.success) {
                this.updateUIState(true);
                await this.updateHistory();
            } else {
                this.showError('Échec de la connexion');
            }
        } catch (error) {
            this.showError('Erreur de connexion');
        } finally {
            this.setButtonLoading(this.loginButton, false);
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
        button.textContent = loading ? 'Chargement...' : (button.textContent || '').replace('Chargement...', button.dataset.originalText || '');
    }

    private async sendMessage(message: SyncMessage): Promise<any> {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                resolve(response);
            });
        });
    }

    private showError(message: string) {
        this.updateSyncStatus({
            lastSync: null,
            syncing: false,
            error: message
        });
    }
}

// Initialiser le popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});