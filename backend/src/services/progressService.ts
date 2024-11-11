import { db } from '../config/firebase';
import { AnimeProgress, HistoData } from '../../../shared/types';

export class ProgressService {
  static async getUserProgress(userId: string): Promise<AnimeProgress> {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return { 
        histo: this.createEmptyHisto(), 
        saved: {} 
      };
    }

    return (userDoc.data() as { progress: AnimeProgress }).progress;
  }

  static async mergeUserProgress(
    userId: string, 
    clientProgress: AnimeProgress
  ): Promise<AnimeProgress> {
    const userDoc = await db.collection('users').doc(userId).get();
    const serverProgress = userDoc.exists ? 
      (userDoc.data() as { progress: AnimeProgress }).progress : 
      { histo: this.createEmptyHisto(), saved: {} };

    const mergedProgress = this.mergeProgress(serverProgress, clientProgress);

    await db.collection('users').doc(userId).set({
      progress: mergedProgress,
      lastSync: new Date().toISOString()
    });

    return mergedProgress;
  }

  private static createEmptyHisto(): HistoData {
    return {
      histoEp: [],
      histoImg: [],
      histoLang: [],
      histoNom: [],
      histoType: [],
      histoUrl: []
    };
  }

  private static mergeProgress(
    serverProgress: AnimeProgress,
    clientProgress: AnimeProgress
  ): AnimeProgress {
    return {
      histo: this.mergeHistoData(serverProgress.histo, clientProgress.histo),
      saved: this.mergeSavedProgress(serverProgress.saved, clientProgress.saved),
      lastUpdate: Date.now()
    };
  }

  private static mergeHistoData(server: HistoData, client: HistoData): HistoData {
    const mergeArrays = (a: string[], b: string[]) => 
      Array.from(new Set([...b, ...a])).slice(0, 10);

    return {
      histoEp: mergeArrays(server.histoEp, client.histoEp),
      histoImg: mergeArrays(server.histoImg, client.histoImg),
      histoLang: mergeArrays(server.histoLang, client.histoLang),
      histoNom: mergeArrays(server.histoNom, client.histoNom),
      histoType: mergeArrays(server.histoType, client.histoType),
      histoUrl: mergeArrays(server.histoUrl, client.histoUrl)
    };
  }

  private static mergeSavedProgress(
    server: Record<string, any>, 
    client: Record<string, any>
  ): Record<string, any> {
    const merged = { ...server };
    
    Object.entries(client).forEach(([key, value]) => {
      if (key.startsWith('savedEpNb/')) {
        const localValue = Number(value) || 0;
        const remoteValue = Number(server[key]) || 0;
        
        if (localValue >= remoteValue) {
          merged[key] = localValue;
          const nameKey = key.replace('savedEpNb/', 'savedEpName/');
          merged[nameKey] = client[nameKey];
        }
      }
    });

    return merged;
  }
}