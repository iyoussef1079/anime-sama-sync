import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { UserAuth } from '../../../shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: UserAuth;
      return;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {

  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await getAuth().verifyIdToken(token as string);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};