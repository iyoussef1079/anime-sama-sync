import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/sync', SyncController.syncProgress);
router.get('/sync', SyncController.getProgress);

export const syncRouter = router;