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

  // 1. First reading data
private static async getAnimeSamaData(): Promise<AnimeProgress> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.anime-sama.fr/*' });
      if (tabs.length === 0) {
        console.warn('No anime-sama tabs found');
        return this.createEmptyProgress();
      }

      // Add debug logging
      console.log('Getting anime-sama data from tabs:', tabs);

      for (const tab of tabs) {
        try {
          const response = await this.sendMessageToTab(tab.id!, { type: 'GET_LOCAL_STORAGE' });
          console.log('Raw localStorage response:', response?.data);
          
          if (!response?.success) continue;

          const localData = response.data;
          const progress = this.processAnimeData(localData);
          
          console.log('Processed anime data:', progress);
          return progress;
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

// 2. Processing the data
private static processAnimeData(localData: Record<string, string>): AnimeProgress {
    console.log('Processing raw data:', localData);
    
    // Extract saved data first
    const saved: SavedProgress = {};
    Object.entries(localData).forEach(([key, value]) => {
      if (key.startsWith('savedEpNb/')) {
        const url = key.replace('savedEpNb/', '');
        let normalizedUrl = url.startsWith('/') ? url : '/' + url;
        const nameKey = `savedEpName/${url}`;

        const cleanedEpisodeName = localData[nameKey]?.replace(/['"]+/g, '') || ''

        
        console.log(`Processing saved data for ${normalizedUrl}:`, {
          number: value,
          name: cleanedEpisodeName
        });

        
        saved[normalizedUrl] = {
          number: Number(value) || 0,
          name: cleanedEpisodeName
        };
      }
    });

    // Parse history arrays with website's format in mind
    const parseArray = (str: string): string[] => {
      console.log('Parsing array string:', str);
      if (!str) return [];
      // Remove quotes and brackets and split
      const cleaned = str.replace(/^\[|\]$/g, '')
        .split(',')
        .map(item => item.trim().replace(/['"]+/g, '')); // Remove all quotes
      console.log('Parsed array:', cleaned);
      return cleaned;
    };

    const histoEp = parseArray(localData['histoEp'] || '');
    const histoUrl = parseArray(localData['histoUrl'] || '');
    const histoImg = parseArray(localData['histoImg'] || '');
    const histoLang = parseArray(localData['histoLang'] || '');
    const histoNom = parseArray(localData['histoNom'] || '');
    const histoType = parseArray(localData['histoType'] || '');

    console.log('Parsed arrays:', {
      histoEp, histoUrl, histoLang, histoNom, histoType
    });

    // Create entries using saved episode names
    const entries = histoUrl.map((url, index) => {
      const normalizedUrl = url.startsWith('/') ? url : '/' + url;
      const entry = {
        url: normalizedUrl,
        episode: (saved[normalizedUrl]?.name || histoEp[index] || 'Episode 1').replace(/['"]+/g, ''),
        image: histoImg[index] || '',
        language: histoLang[index] || 'VO',
        name: histoNom[index] || '',
        type: histoType[index] || 'Saison 1',
        lastWatched: Date.now()
      };
      console.log(`Created entry for ${normalizedUrl}:`, entry);
      return entry;
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

      // Verify data before sending
      console.log('Verifying save data:', {
          histoEp: JSON.parse(saveData.histoEp),
          saved: Object.fromEntries(
              Object.entries(saveData)
                  .filter(([key]) => key.startsWith('savedEpName/'))
          )
      });

      const response = await this.sendMessageToTab(tabId, {
        type: 'SET_LOCAL_STORAGE',
        data: saveData
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save to localStorage');
      }

      // Verify storage after save
      const verifyResponse = await this.sendMessageToTab(tabId, {
          type: 'GET_LOCAL_STORAGE'
      });

      console.log('Storage after save:', {
          histoEp: JSON.parse(verifyResponse.data.histoEp),
          saved: Object.fromEntries(
              Object.entries(verifyResponse.data)
                  .filter(([key]) => key.startsWith('savedEpName/'))
          )
      });

    } catch (error) {
      console.error('Error saving to anime-sama:', error);
      throw new Error('Failed to save to anime-sama localStorage');
    }
}

  private static prepareSaveData(progress: AnimeProgress): Record<string, string> {
    const histoArrays = {
        histoEp: `[${progress.histo.entries.map(e => `"${e.episode.replace(/['"]+/g, '')}"`)}]`,
        histoImg: `[${progress.histo.entries.map(e => `"${e.image}"`)}]`,
        histoLang: `[${progress.histo.entries.map(e => `"${e.language}"`)}]`,
        histoNom: `[${progress.histo.entries.map(e => `"${e.name}"`)}]`,
        histoType: `[${progress.histo.entries.map(e => `"${e.type}"`)}]`,
        histoUrl: `[${progress.histo.entries.map(e => `"${e.url}"`)}]`
    };

    const saveData: Record<string, string> = {};
    Object.entries(histoArrays).forEach(([key, value]) => {
        saveData[key] = value;
    });

    Object.entries(progress.saved).forEach(([url, episode]) => {
        const storageUrl = url.replace(/^\//, '');
        saveData[`savedEpNb/${storageUrl}`] = String(episode.number);
        saveData[`savedEpName/${storageUrl}`] = `"${episode.name.replace(/['"]+/g, '')}"`;
    });

    return saveData;
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