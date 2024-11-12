import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { UserAuth } from '../../../shared/types';

declare global {
  namespace Express {
    interface Request {
      user?: UserAuth;
    }
  }
}

export const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    console.log('Auth Header:', req.headers.authorization); // Debug
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      console.log('No token provided'); // Debug
      res.status(401).json({ error: 'No token provided' });
      return; // Ajout du return manquant
    }

    try {
      console.log('Verifying token...'); // Debug
      const decodedToken = await getAuth().verifyIdToken(token);
      console.log('Decoded token:', decodedToken); // Debug

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified
      };

      next();
    } catch (verifyError) {
      console.error('Token verification error:', verifyError); // Debug
      res.status(401).json({ 
        error: 'Invalid token',
        details: verifyError instanceof Error ? verifyError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error); // Debug
    res.status(401).json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};