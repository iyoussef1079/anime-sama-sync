// backend/src/controllers/syncController.ts
import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { AnimeProgress, AnimeEntry } from '../../../shared/types';
import { ProgressService } from '../services/progressService';

export class SyncController {
  static async syncProgress(req: Request, res: Response) {
    try {
      console.log('=== Sync Request Details ===');
      
      const userId = req.user?.uid;
      console.log('1. Processing for userId:', userId);

      if (!userId) {
        console.log('Error: No user ID found');
        return res.status(401).json({ 
          success: false, 
          error: 'User not authenticated' 
        });
      }

      const clientProgress: AnimeProgress = req.body;
      
      // Validate client progress structure
      if (!this.validateProgressData(clientProgress)) {
        console.log('Error: Invalid progress structure:', clientProgress);
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid progress data format' 
        });
      }
      
      // Log incoming data
      console.log('2. Client progress stats:', {
        historyCount: clientProgress.histo.entries.length,
        savedCount: Object.keys(clientProgress.saved).length,
        animeNames: clientProgress.histo.entries.map(e => e.name),
        lastUpdate: new Date(clientProgress.lastUpdate).toISOString()
      });

      // Merge progress
      const mergedProgress = await ProgressService.mergeUserProgress(userId, clientProgress);
      
      // Log merged results
      console.log('3. Merged progress stats:', {
        historyCount: mergedProgress.histo.entries.length,
        savedCount: Object.keys(mergedProgress.saved).length,
        animeNames: mergedProgress.histo.entries.map(e => e.name),
        lastUpdate: new Date(mergedProgress.lastUpdate).toISOString()
      });

      // Send response
      res.json({ 
        success: true, 
        data: mergedProgress 
      });
      
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  static async getProgress(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      console.log('Getting progress for user:', userId);

      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'User not authenticated' 
        });
      }

      const progress = await ProgressService.getUserProgress(userId);
      console.log('Progress retrieved:', {
        historyCount: progress.histo.entries.length,
        savedCount: Object.keys(progress.saved).length
      });

      res.json({ 
        success: true, 
        data: progress 
      });
      
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  static async testAuth(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      console.log('Testing auth for user:', userId);

      res.json({
        success: true,
        message: 'Authentication successful',
        user: req.user,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Test auth error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Authentication test failed' 
      });
    }
  }

  private static validateProgressData(progress: any): progress is AnimeProgress {
    if (!progress || typeof progress !== 'object') return false;
    
    // Validate histo structure
    if (!progress.histo || !Array.isArray(progress.histo.entries)) return false;
    
    // Validate each entry in the history
    for (const entry of progress.histo.entries) {
      if (!this.validateHistoryEntry(entry)) return false;
    }
    
    // Validate saved structure
    if (!progress.saved || typeof progress.saved !== 'object') return false;
    
    // Validate lastUpdate
    if (typeof progress.lastUpdate !== 'number') return false;
    
    return true;
  }

  private static validateHistoryEntry(entry: any): entry is AnimeEntry {
    return (
      entry &&
      typeof entry.url === 'string' &&
      typeof entry.episode === 'string' &&
      typeof entry.image === 'string' &&
      typeof entry.language === 'string' &&
      typeof entry.name === 'string' &&
      typeof entry.type === 'string'
    );
  }
}