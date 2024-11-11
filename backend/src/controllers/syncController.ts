import { NextFunction, Request, Response } from 'express';
import { db } from '../config/firebase';
import { AnimeProgress, HistoData } from '../../../shared/types';
import { ProgressService } from '../services/progressService';

export class SyncController {
  static async syncProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const clientProgress: AnimeProgress = req.body;
      const mergedProgress = await ProgressService.mergeUserProgress(userId, clientProgress);
      
      res.json({ success: true, data: mergedProgress });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  static getProgress = async (req: Request, res: Response, next: NextFunction) =>{
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const progress = await ProgressService.getUserProgress(userId);
      res.json({ success: true, data: progress });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
}