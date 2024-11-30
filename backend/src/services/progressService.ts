import { db } from '../config/firebase';
import { AnimeProgress, HistoData, SavedProgress, AnimeEntry } from '../types';

export class ProgressService {
  static async getUserProgress(userId: string): Promise<AnimeProgress> {
    try {
      const userDoc = await db.collection('progress').doc(userId).get();
      
      if (!userDoc.exists) {
        return { 
          histo: { entries: [] }, 
          saved: {},
          lastUpdate: Date.now()
        };
      }

      return userDoc.data() as AnimeProgress;
    } catch (error) {
      console.error('Error getting user progress:', error);
      throw error;
    }
  }

  static async mergeUserProgress(userId: string, clientProgress: AnimeProgress): Promise<AnimeProgress> {
    try {
        console.log('=== ProgressService: mergeUserProgress ===');
        console.log('1. Starting merge for user:', userId);
        
        // Get existing progress from Firestore
        const userDoc = await db.collection('progress').doc(userId).get();
        const serverProgress = userDoc.exists ? userDoc.data() as AnimeProgress : null;
        
        if (!serverProgress) {
            console.log('3. No server progress - using client progress');
            await db.collection('progress').doc(userId).set(clientProgress);
            return clientProgress;
        }

        console.log('3. Starting merge process');
        
        const entriesMap = new Map<string, AnimeEntry>();
        
        // Add server entries first
        serverProgress.histo.entries.forEach(entry => {
            const serverSavedEp = serverProgress.saved[entry.url];
            console.log(`Processing server entry: ${entry.url}`, {
                beforeUpdate: {
                    histoEp: entry.episode,
                    savedEp: serverSavedEp?.name,
                    savedNum: serverSavedEp?.number
                }
            });

            entriesMap.set(entry.url, {
                ...entry,
                episode: serverSavedEp?.name || entry.episode,
                lastWatched: entry.lastWatched || Date.now()
            });
        });
        
        // Add or update with client entries
        clientProgress.histo.entries.forEach(entry => {
            const existingEntry = entriesMap.get(entry.url);
            const clientSavedEp = clientProgress.saved[entry.url];
            
            console.log(`Processing client entry: ${entry.url}`, {
                before: {
                    histoEp: entry.episode,
                    savedEp: clientSavedEp?.name,
                    savedNum: clientSavedEp?.number
                },
                existing: existingEntry ? {
                    histoEp: existingEntry.episode,
                    savedEp: serverProgress.saved[entry.url]?.name,
                    savedNum: serverProgress.saved[entry.url]?.number
                } : null
            });

            // Always update if saved episode exists and is different
            if (clientSavedEp && (!existingEntry || 
                clientSavedEp.name !== existingEntry.episode ||
                clientSavedEp.number > (serverProgress.saved[entry.url]?.number || 0))) {
                
                entriesMap.set(entry.url, {
                    ...entry,
                    episode: clientSavedEp.name,
                    lastWatched: Date.now()
                });

                console.log(`Updated client entry: ${entry.url}`, {
                    afterUpdate: {
                        histoEp: clientSavedEp.name,
                        savedEp: clientSavedEp.name,
                        savedNum: clientSavedEp.number
                    }
                });
            }
        });

        const mergedSaved = this.mergeSavedProgress(serverProgress.saved, clientProgress.saved);

        // Create merged progress with forced histoEp updates
        const mergedProgress: AnimeProgress = {
            histo: {
                entries: Array.from(entriesMap.values())
                    .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0))
                    .map(entry => ({
                        ...entry,
                        episode: mergedSaved[entry.url]?.name || entry.episode
                    }))
            },
            saved: mergedSaved,
            lastUpdate: Date.now()
        };

        console.log('4. Final merged state:', {
            entries: mergedProgress.histo.entries.map(e => ({
                url: e.url,
                histoEp: e.episode,
                savedEp: mergedProgress.saved[e.url]?.name,
                savedNum: mergedProgress.saved[e.url]?.number
            }))
        });
        
        await db.collection('progress').doc(userId).set(mergedProgress);
        console.log('5. Saved to Firestore successfully');
        
        return mergedProgress;
    } catch (error) {
        console.error('Error in mergeUserProgress:', error);
        throw error;
    }
}

  private static mergeSavedProgress(
    serverSaved: SavedProgress, 
    clientSaved: SavedProgress
  ): SavedProgress {
    const mergedSaved: SavedProgress = { ...serverSaved };
    
    Object.entries(clientSaved).forEach(([url, clientEpisode]) => {
      const serverEpisode = serverSaved[url];
      
      if (!serverEpisode || 
          parseInt(clientEpisode.name.split(' ')[1]) > parseInt(serverEpisode.name.split(' ')[1])) {
        mergedSaved[url] = clientEpisode;
      }
    });

    return mergedSaved;
  }

  private static createEmptyProgress(): AnimeProgress {
    return {
      histo: { entries: [] },
      saved: {},
      lastUpdate: Date.now()
    };
  }
}