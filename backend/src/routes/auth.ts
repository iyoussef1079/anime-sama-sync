import express from 'express';
import { authenticateWithGoogle, verifyToken } from '../controllers/authController';

const router = express.Router();

router.post('/google', authenticateWithGoogle);
router.post('/verify', verifyToken);

export default router;