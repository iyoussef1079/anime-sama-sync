import { AnimeProgress, HistoData, SavedProgress } from '../../../shared/types';

export class LocalStore {
  public static readonly HISTO_KEYS: (keyof HistoData)[] = [
    'histoEp',
    'histoImg',
    'histoLang',
    'histoNom',
    'histoType',
    'histoUrl'
  ];

  static async getProgress(): Promise<AnimeProgress> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const histo: HistoData = {
          histoEp: items.histoEp || [],
          histoImg: items.histoImg || [],
          histoLang: items.histoLang || [],
          histoNom: items.histoNom || [],
          histoType: items.histoType || [],
          histoUrl: items.histoUrl || []
        };

        const saved: SavedProgress = {};
        Object.keys(items).forEach(key => {
          if (key.startsWith('savedEpName/') || key.startsWith('savedEpNb/')) {
            saved[key] = items[key];
          }
        });

        resolve({ histo, saved });
      });
    });
  }

  static async saveProgress(progress: AnimeProgress): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        ...progress.histo,
        ...progress.saved
      }, resolve);
    });
  }
}