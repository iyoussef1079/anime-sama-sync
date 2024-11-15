import { AnimeProgress, HistoData, SavedProgress, AnimeEntry } from '../../../shared/types';

export class LocalStore {
  // Récupère les données depuis le localStorage d'anime-sama.fr
  private static async getAnimeSamaData(): Promise<AnimeProgress> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
      if (tabs.length === 0) {
        console.warn('No anime-sama tabs found');
        return this.createEmptyProgress();
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

      // Parse the old format arrays
      const histoEp = this.parseJsonSafely(localData['histoEp'], []);
      const histoImg = this.parseJsonSafely(localData['histoImg'], []);
      const histoLang = this.parseJsonSafely(localData['histoLang'], []);
      const histoNom = this.parseJsonSafely(localData['histoNom'], []);
      const histoType = this.parseJsonSafely(localData['histoType'], []);
      const histoUrl = this.parseJsonSafely(localData['histoUrl'], []);

      // Convert to new entry format
      const entries: AnimeEntry[] = histoUrl.map((url, index) => ({
        url,
        episode: histoEp[index] || 'Episode 1',
        image: histoImg[index] || '',
        language: histoLang[index] || 'VO',
        name: histoNom[index] || '',
        type: histoType[index] || 'Saison 1'
      }));

      // Process saved episodes
      const saved: SavedProgress = {};
      Object.entries(localData).forEach(([key, value]) => {
        if (key.startsWith('savedEpNb/')) {
          const url = key.replace('savedEpNb/', '');
          const nameKey = `savedEpName/${url}`;
          saved[url] = {
            number: Number(value) || 0,
            name: localData[nameKey] || ''
          };
        }
      });

      return {
        histo: { entries },
        saved,
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return this.createEmptyProgress();
    }
  }

  private static parseJsonSafely(jsonString: string | null, defaultValue: string[] = []): string[] {
    if (!jsonString) return defaultValue;
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return defaultValue;
    }
  }

  // Récupère les données depuis le storage de l'extension
  private static async getExtensionData(): Promise<AnimeProgress> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const progress = items.progress as AnimeProgress || this.createEmptyProgress();
        console.log('Retrieved extension storage data:', progress);
        resolve(progress);
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

      // Utiliser les données les plus récentes comme principales
      const mainData = (animeSamaData?.lastUpdate ?? 0) > (extensionData?.lastUpdate ?? 0)
        ? animeSamaData
        : extensionData;

      const secondaryData = (animeSamaData?.lastUpdate ?? 0) > (extensionData?.lastUpdate ?? 0)
        ? extensionData
        : animeSamaData;

      // Create a map for merging entries
      const entriesMap = new Map<string, AnimeEntry>();

      // Add entries from both sources
      [...mainData.histo.entries, ...secondaryData.histo.entries].forEach(entry => {
        entriesMap.set(entry.url, entry);
      });

      // Convert map back to array and sort by most recent
      const entries = Array.from(entriesMap.values())
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 10);

      // Merge saved progress
      const saved: SavedProgress = { ...mainData.saved };
      Object.entries(secondaryData.saved).forEach(([url, episode]) => {
        if (!saved[url] || episode.number > saved[url].number) {
          saved[url] = episode;
        }
      });

      return {
        histo: { entries },
        saved,
        lastUpdate: Date.now()
      };
    } catch (error) {
      console.error('Error merging data:', error);
      return this.createEmptyProgress();
    }
  }

  static async saveProgress(progress: AnimeProgress): Promise<void> {
    try {
      // Save to extension storage
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ progress }, resolve);
      });

      // Save to anime-sama localStorage
      await this.saveToAnimeSama(progress);
    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
    }
  }

  private static async saveToAnimeSama(progress: AnimeProgress): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
      if (tabs.length === 0) {
        console.log('No anime-sama tab found for saving');
        return;
      }

      // Convert new format to localStorage format
      const saveData: Record<string, string> = {};

      // Convert entries to arrays
      const histoArrays = {
        histoEp: progress.histo.entries.map(e => e.episode),
        histoImg: progress.histo.entries.map(e => e.image),
        histoLang: progress.histo.entries.map(e => e.language),
        histoNom: progress.histo.entries.map(e => e.name),
        histoType: progress.histo.entries.map(e => e.type),
        histoUrl: progress.histo.entries.map(e => e.url),
      };

      // Convert arrays to JSON strings
      Object.entries(histoArrays).forEach(([key, value]) => {
        saveData[key] = JSON.stringify(value);
      });

      // Add saved episodes
      Object.entries(progress.saved).forEach(([url, episode]) => {
        saveData[`savedEpNb/${url}`] = String(episode.number);
        saveData[`savedEpName/${url}`] = episode.name;
      });

      console.log('Saving to localStorage:', saveData);

      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id! },
        func: (data) => {
          Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
        },
        args: [saveData]
      });

      console.log('Successfully saved to anime-sama localStorage');
    } catch (error) {
      console.error('Error saving to anime-sama:', error);
      throw new Error('Failed to save to anime-sama localStorage');
    }
  }

  private static createEmptyProgress(): AnimeProgress {
    return {
      histo: { entries: [] },
      saved: {},
      lastUpdate: Date.now()
    };
  }
}