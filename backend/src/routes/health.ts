import express from 'express';
import { healthController } from '../controllers/healthController';

const router = express.Router();

router.get('/', healthController.check);

export default router;