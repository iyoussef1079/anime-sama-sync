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

  // Récupère les données depuis le localStorage d'anime-sama.fr
  private static async getAnimeSamaData(): Promise<AnimeProgress> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
      if (tabs.length === 0) {
        console.warn('No anime-sama tabs found');
        return { histo: this.getEmptyHisto(), saved: {} };
      }

      // Exécuter du code dans le contexte de la page pour récupérer localStorage
      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id! },
        func: () => {
          const data: any = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              data[key] = localStorage.getItem(key);
            }
          }
          return data;
        }
      });

      const localData = result[0].result;
      console.log('Retrieved localStorage data:', localData);

      // Construire l'objet histo
      const histo: HistoData = {
        histoEp: this.parseJsonSafely(localData['histoEp'], []),
        histoImg: this.parseJsonSafely(localData['histoImg'], []),
        histoLang: this.parseJsonSafely(localData['histoLang'], []),
        histoNom: this.parseJsonSafely(localData['histoNom'], []),
        histoType: this.parseJsonSafely(localData['histoType'], []),
        histoUrl: this.parseJsonSafely(localData['histoUrl'], [])
      };

      // Construire l'objet saved
      const saved: SavedProgress = {};
      Object.keys(localData).forEach(key => {
        if (key.startsWith('savedEpName/') || key.startsWith('savedEpNb/')) {
          saved[key] = localData[key];
        }
      });

      return { histo, saved };
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return { histo: this.getEmptyHisto(), saved: {} };
    }
  }

// Ajouter une méthode utilitaire pour parser le JSON en toute sécurité
private static parseJsonSafely(jsonString: string | null, defaultValue: any[] = []): any[] {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
}

  // Récupère les données depuis le storage de l'extension
  private static getExtensionData(): Promise<AnimeProgress> {
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

  // Fusionne les données de l'extension et d'anime-sama
  static async getProgress(): Promise<AnimeProgress> {
    try {
      const [animeSamaData, extensionData] = await Promise.all([
        this.getAnimeSamaData(),
        this.getExtensionData()
      ]);

      // Fusionner les historiques
      const mergedHisto: HistoData = {
        histoEp: [...new Set([...animeSamaData.histo.histoEp, ...extensionData.histo.histoEp])],
        histoImg: [...new Set([...animeSamaData.histo.histoImg, ...extensionData.histo.histoImg])],
        histoLang: [...new Set([...animeSamaData.histo.histoLang, ...extensionData.histo.histoLang])],
        histoNom: [...new Set([...animeSamaData.histo.histoNom, ...extensionData.histo.histoNom])],
        histoType: [...new Set([...animeSamaData.histo.histoType, ...extensionData.histo.histoType])],
        histoUrl: [...new Set([...animeSamaData.histo.histoUrl, ...extensionData.histo.histoUrl])]
      };

      // Fusionner les données sauvegardées en prenant les plus récentes
      const mergedSaved: SavedProgress = {
        ...animeSamaData.saved,
        ...extensionData.saved
      };

      return { histo: mergedHisto, saved: mergedSaved };
    } catch (error) {
      console.error('Error merging data:', error);
      return { histo: this.getEmptyHisto(), saved: {} };
    }
  }

  // Sauvegarde les données dans le storage de l'extension ET dans anime-sama
  static async saveProgress(progress: AnimeProgress): Promise<void> {
    try {
      // Sauvegarder dans le storage de l'extension
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({
          ...progress.histo,
          ...progress.saved
        }, resolve);
      });

      // Sauvegarder dans le localStorage d'anime-sama
      await this.saveToAnimeSama(progress);

    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
    }
  }

  // Sauvegarde les données dans le localStorage d'anime-sama
  private static async saveToAnimeSama(progress: AnimeProgress): Promise<void> {
    try {
        const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
        if (tabs.length === 0) {
        console.log('No anime-sama tab found for saving');
        return; // Retourne silencieusement si pas d'onglet
        }

        // Utiliser executeScript pour sauvegarder
        await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id! },
        func: (data) => {
            // Sauvegarder chaque clé dans le localStorage
            Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
            } else {
                localStorage.setItem(key, JSON.stringify(value));
            }
            });
        },
        args: [{ ...progress.histo, ...progress.saved }]
        });

        console.log('Successfully saved to anime-sama localStorage');
    } catch (error) {
        console.error('Error saving to anime-sama:', error);
        throw new Error('Failed to save to anime-sama localStorage');
    }
  }

  private static getEmptyHisto(): HistoData {
    return {
      histoEp: [],
      histoImg: [],
      histoLang: [],
      histoNom: [],
      histoType: [],
      histoUrl: []
    };
  }
}