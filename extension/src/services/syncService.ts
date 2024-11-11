import { AnimeProgress, HistoData, SavedProgress } from '../types';
import { LocalStore } from '../storage/localStore';

export class SyncService {
  private static readonly API_URL = 'https://votre-api.vercel.app';

  static async mergeProgress(local: AnimeProgress, remote: AnimeProgress): Promise<AnimeProgress> {
    // Fusionner l'historique en gardant les entrées les plus récentes
    const mergedHisto: HistoData = {
      histoEp: [...new Set([...remote.histo.histoEp, ...local.histo.histoEp])].slice(0, 10),
      histoImg: [...new Set([...remote.histo.histoImg, ...local.histo.histoImg])].slice(0, 10),
      histoLang: [...new Set([...remote.histo.histoLang, ...local.histo.histoLang])].slice(0, 10),
      histoNom: [...new Set([...remote.histo.histoNom, ...local.histo.histoNom])].slice(0, 10),
      histoType: [...new Set([...remote.histo.histoType, ...local.histo.histoType])].slice(0, 10),
      histoUrl: [...new Set([...remote.histo.histoUrl, ...local.histo.histoUrl])].slice(0, 10)
    };

    // Fusionner les sauvegardes d'épisodes
    const mergedSaved: SavedProgress = { ...remote.saved };
    Object.entries(local.saved).forEach(([key, value]) => {
      if (key.startsWith('savedEpNb/')) {
        const remoteValue = Number(remote.saved[key]) || 0;
        const localValue = Number(value) || 0;
        if (localValue >= remoteValue) {
          mergedSaved[key] = localValue;
          // Mettre à jour le nom d'épisode correspondant
          const nameKey = key.replace('savedEpNb/', 'savedEpName/');
          mergedSaved[nameKey] = local.saved[nameKey];
        }
      }
    });

    return { histo: mergedHisto, saved: mergedSaved };
  }

  static async syncWithServer(token: string): Promise<AnimeProgress | null> {
    const localProgress = await LocalStore.getProgress();
    
    const response = await fetch(`${this.API_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(localProgress)
    });

    if (!response.ok) {
      throw new Error('Sync failed');
    }

    return response.json();
  }
}