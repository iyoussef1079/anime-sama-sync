import { AnimeProgress, HistoData, SavedProgress, AnimeEntry } from '../types';
import { LocalStore } from '../storage/localStore';
import { AuthService } from './authService';

export class SyncService {
  private static readonly API_URL = process.env.NODE_ENV === 'development'  ? 'http://localhost:3000/api/': 'https://anime-sama-sync-iszecoxgd-iyoussef1079s-projects.vercel.app/';

  static async mergeProgress(local: AnimeProgress | null, remote: AnimeProgress | null): Promise<AnimeProgress> {
    // If either source is null, return the other
    if (!local || !local.histo) return remote || this.getEmptyProgress();
    if (!remote || !remote.histo) return local;

    // Create a map of URLs to entries for easy merging
    const entriesMap = new Map<string, AnimeEntry>();

    // Add remote entries first
    remote.histo.entries.forEach(entry => {
      entriesMap.set(entry.url, entry);
    });

    // Add or update with local entries
    local.histo.entries.forEach(entry => {
      entriesMap.set(entry.url, entry);
    });

    // Convert map back to array
    const mergedEntries = Array.from(entriesMap.values())
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 10);  // Keep only the 10 most recent

    // Merge saved episodes
    const mergedSaved: SavedProgress = { ...remote.saved };
    Object.entries(local.saved).forEach(([url, localEpisode]) => {
      const remoteEpisode = remote.saved[url];
      if (!remoteEpisode || localEpisode.number > remoteEpisode.number) {
        mergedSaved[url] = localEpisode;
      }
    });

    return {
      histo: { entries: mergedEntries },
      saved: mergedSaved,
      lastUpdate: Date.now()
    };
  }

  static async syncWithServer(token: string): Promise<AnimeProgress | null> {
    try {
      const localProgress = await LocalStore.getProgress();
      console.log('Local progress before sync:', {
        entries: localProgress.histo.entries.length,
        entriesData: localProgress.histo.entries,
        saved: Object.keys(localProgress.saved).length
      });

      const response = await fetch(`${this.API_URL}sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(localProgress || this.getEmptyProgress())
      });

      if (response.status === 401) {
        // Token might be expired, trigger re-authentication
        await AuthService.signInWithGoogle();
        const newToken = await AuthService.getIdToken();
        if (newToken) {
          return this.syncWithServer(newToken);
        }
        throw new Error('Failed to refresh authentication');
      }

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const serverResponse = await response.json();
      console.log('Raw server response:', serverResponse);

      return serverResponse;
    } catch (error) {
      console.error('Sync error:', error);
      return null;
    }
  }

  private static getEmptyProgress(): AnimeProgress {
    return {
      histo: { entries: [] },
      saved: {},
      lastUpdate: Date.now()
    };
  }
}