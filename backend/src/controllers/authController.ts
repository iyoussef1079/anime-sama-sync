// src/controllers/authController.ts
import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getAuth } from 'firebase-admin/auth';

// We're still using the same Google OAuth client from Phase 1
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID
});

export const authenticateWithGoogle = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'No token provided' });
    }

    oauth2Client.setCredentials({
      access_token: token
    });

    const userInfoClient = await oauth2Client.getTokenInfo(token);
    
    if (!userInfoClient.email) {
      return res.status(401).json({ error: 'Could not get user email' });
    }

    let firebaseUser;
    try {
      firebaseUser = await getAuth().getUserByEmail(userInfoClient.email);
    } catch (error) {
      if ((error as any).code === 'auth/user-not-found') {
        firebaseUser = await getAuth().createUser({
          email: userInfoClient.email,
          emailVerified: userInfoClient.email_verified || false,
        });
      } else {
        throw error;
      }
    }

    // Just create a custom token
    const customToken = await getAuth().createCustomToken(firebaseUser.uid);

    res.status(200).json({
      customToken,  // Send the custom token
      user: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified
      }
    });

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userRecord = await getAuth().getUser(decodedToken.uid);

    return res.status(200).json({
      valid: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      valid: false,
      error: 'Invalid token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Types for better code organization
interface TokenVerificationResponse {
  valid: boolean;
  user?: {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
    photoURL: string | null;
    createdAt: string;
    lastSignIn: string;
  };
  refreshedToken?: string;
  tokenStatus?: {
    issuedAt: Date;
    expiresAt: Date | null;
    authTime: Date;
  };
  error?: string;
  details?: string;
  expiredAt?: Date;
}