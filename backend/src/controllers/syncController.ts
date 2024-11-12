// backend/src/controllers/syncController.ts
import { NextFunction, Request, Response } from 'express';
import { db } from '../config/firebase';
import { AnimeProgress, HistoData } from '../../../shared/types';
import { ProgressService } from '../services/progressService';

export class SyncController {
  static async syncProgress(req: Request, res: Response) {
    try {
      console.log('Sync request received');
      const userId = req.user?.uid;
      console.log('User ID:', userId);

      if (!userId) {
        console.log('No user ID found in request');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const clientProgress: AnimeProgress = req.body;
      // Validation de base des données
      if (!clientProgress || !clientProgress.histo || !clientProgress.saved) {
        console.log('Invalid progress data received:', clientProgress);
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid progress data format' 
        });
      }
      
      console.log('Merging progress for user:', userId);
      const mergedProgress = await ProgressService.mergeUserProgress(userId, clientProgress);
      console.log('Progress merged successfully');
      
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
      console.log('Get progress request received');
      const userId = req.user?.uid;
      console.log('User ID:', userId);

      if (!userId) {
        console.log('No user ID found in request');
        return res.status(401).json({ error: 'User not authenticated' });
      }

      console.log('Fetching progress for user:', userId);
      const progress = await ProgressService.getUserProgress(userId);
      console.log('Progress fetched successfully');

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
      console.log('Test auth request received');
      const userId = req.user?.uid;
      console.log('Auth test for user:', userId);

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
}