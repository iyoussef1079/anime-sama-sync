import { Router, Request, Response } from 'express';
import { SyncController } from '../controllers/syncController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/sync', async (req: Request, res: Response) => {
  await SyncController.syncProgress(req, res);
});

router.get('/sync', async (req: Request, res: Response) => {
  await SyncController.getProgress(req, res);
});

export const syncRouter = router;