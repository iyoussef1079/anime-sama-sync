import { db } from '../config/firebase';
import { AnimeProgress, HistoData, SavedProgress, AnimeEntry } from '../../../shared/types';

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
      
      console.log('2. Existing server data:', serverProgress ? {
        entriesCount: serverProgress.histo.entries.length,
        savedCount: Object.keys(serverProgress.saved).length
      } : 'No existing data');

      // If no server progress, use client progress directly
      if (!serverProgress) {
        console.log('3. No server progress - using client progress');
        await db.collection('progress').doc(userId).set(clientProgress);
        return clientProgress;
      }

      console.log('3. Merging with server progress');
      
      // Create a map for easy lookup and merging
      const entriesMap = new Map<string, AnimeEntry>();
      
      // Add server entries first
      serverProgress.histo.entries.forEach(entry => {
        entriesMap.set(entry.url, entry);
      });
      
      // Add or update with client entries
      clientProgress.histo.entries.forEach(entry => {
        entriesMap.set(entry.url, entry);
      });
      
      // Create merged progress
      const mergedProgress: AnimeProgress = {
        histo: {
          entries: Array.from(entriesMap.values())
            .sort((a, b) => b.name.localeCompare(a.name))
            .slice(0, 10)
        },
        saved: this.mergeSavedProgress(serverProgress.saved, clientProgress.saved),
        lastUpdate: Date.now()
      };

      console.log('4. Merged progress:', {
        entriesCount: mergedProgress.histo.entries.length,
        savedCount: Object.keys(mergedProgress.saved).length
      });
      
      // Save to Firestore
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
      if (!serverEpisode || clientEpisode.number > serverEpisode.number) {
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