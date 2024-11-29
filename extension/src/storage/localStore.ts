import { AnimeProgress, HistoData, SavedProgress, AnimeEntry } from '../types';

export class LocalStore {
  private static async sendMessageToTab(tabId: number, message: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await new Promise<any>((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(response);
          });
        });
        return response;
      } catch (error) {
        if (i === retries - 1) throw error;
        console.log(`Communication attempt ${i + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  private static async ensureAnimesamaTab(): Promise<number> {
  const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
  
  if (tabs.length === 0) {
    const newTab = await chrome.tabs.create({
      url: 'https://anime-sama.fr',
      active: false
    });
    
    // Wait for tab to fully load
    await new Promise<void>(resolve => {
      const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    // Additional wait to ensure content script is initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return newTab.id!;
  }
  
  // If tab exists, ensure it's loaded
  const tab = tabs[0];
  try {
    // Try to ping the content script
    await new Promise<void>((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id!, { type: 'PING' }, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else if (response?.success) {
          resolve();
        } else {
          reject(new Error('Content script not ready'));
        }
      });
    });
    return tab.id!;
  } catch (error) {
    // If ping fails, reload the tab and wait for it
    await chrome.tabs.reload(tab.id!);
    await new Promise<void>(resolve => {
      const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    // Additional wait to ensure content script is initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return tab.id!;
  }
}

  private static async getAnimeSamaData(): Promise<AnimeProgress> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
      if (tabs.length === 0) {
        console.warn('No anime-sama tabs found');
        return this.createEmptyProgress();
      }

      // Try each tab until we get a response
      for (const tab of tabs) {
        try {
          const response = await this.sendMessageToTab(tab.id!, { type: 'GET_LOCAL_STORAGE' });
          if (!response?.success) continue;

          const localData = response.data;
          return this.processAnimeData(localData);
        } catch (error) {
          console.error('Error with tab:', tab.url, error);
          continue;
        }
      }

      return this.createEmptyProgress();
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return this.createEmptyProgress();
    }
  }

  private static processAnimeData(localData: Record<string, string>): AnimeProgress {
    const histoEp = this.parseJsonSafely(localData['histoEp'], []);
    const histoImg = this.parseJsonSafely(localData['histoImg'], []);
    const histoLang = this.parseJsonSafely(localData['histoLang'], []);
    const histoNom = this.parseJsonSafely(localData['histoNom'], []);
    const histoType = this.parseJsonSafely(localData['histoType'], []);
    const histoUrl = this.parseJsonSafely(localData['histoUrl'], []);

    const entries = histoUrl.map((url, index) => ({
      url,
      episode: histoEp[index] || 'Episode 1',
      image: histoImg[index] || '',
      language: histoLang[index] || 'VO',
      name: histoNom[index] || '',
      type: histoType[index] || 'Saison 1'
    }));

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
  }

  private static async saveToAnimeSama(progress: AnimeProgress): Promise<void> {
    try {
      const tabId = await this.ensureAnimesamaTab();
      const saveData = this.prepareSaveData(progress);

      const response = await this.sendMessageToTab(tabId, {
        type: 'SET_LOCAL_STORAGE',
        data: saveData
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save to localStorage');
      }
    } catch (error) {
      console.error('Error saving to anime-sama:', error);
      throw new Error('Failed to save to anime-sama localStorage');
    }
  }

  private static prepareSaveData(progress: AnimeProgress): Record<string, string> {
    const histoArrays = {
      histoEp: progress.histo.entries.map(e => e.episode),
      histoImg: progress.histo.entries.map(e => e.image),
      histoLang: progress.histo.entries.map(e => e.language),
      histoNom: progress.histo.entries.map(e => e.name),
      histoType: progress.histo.entries.map(e => e.type),
      histoUrl: progress.histo.entries.map(e => e.url),
    };

    const saveData: Record<string, string> = {};
    Object.entries(histoArrays).forEach(([key, value]) => {
      saveData[key] = JSON.stringify(value);
    });

    Object.entries(progress.saved).forEach(([url, episode]) => {
      saveData[`savedEpNb/${url}`] = String(episode.number);
      saveData[`savedEpName/${url}`] = episode.name;
    });

    return saveData;
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

  private static async getExtensionData(): Promise<AnimeProgress> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        resolve(items.progress as AnimeProgress || this.createEmptyProgress());
      });
    });
  }

  static async getProgress(): Promise<AnimeProgress> {
    try {
      const [animeSamaData, extensionData] = await Promise.all([
        this.getAnimeSamaData(),
        this.getExtensionData()
      ]);

      const isAnimeSamaNewer = (animeSamaData?.lastUpdate ?? 0) > (extensionData?.lastUpdate ?? 0);
      const [mainData, secondaryData] = isAnimeSamaNewer 
        ? [animeSamaData, extensionData]
        : [extensionData, animeSamaData];

      const entriesMap = new Map<string, AnimeEntry>();
      [...mainData.histo.entries, ...secondaryData.histo.entries].forEach(entry => {
        entriesMap.set(entry.url, entry);
      });

      const entries = Array.from(entriesMap.values())
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 10);

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
      await Promise.all([
        new Promise<void>((resolve) => {
          chrome.storage.local.set({ progress }, resolve);
        }),
        this.saveToAnimeSama(progress)
      ]);
    } catch (error) {
      console.error('Error saving progress:', error);
      throw error;
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