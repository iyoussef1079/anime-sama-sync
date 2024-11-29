// extension/src/services/authService.ts
import {
  signInWithCustomToken,
  User
} from 'firebase/auth';
import { auth } from '../config/firebase';

export class AuthService {
  private static readonly API_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000/auth'
    : 'https://anime-sama-sync-iszecoxgd-iyoussef1079s-projects.vercel.app/auth';

  private static currentUser: User | null = null;

  static async signInWithGoogle(): Promise<User | null> {
    try {
      const googleToken = await new Promise<string>((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (token) {
            resolve(token);
          } else {
            reject(new Error('No token received'));
          }
        });
      });

      console.log('Got OAuth token from Chrome');

      const response = await fetch(`${this.API_URL}/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: googleToken })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const authData = await response.json();
      
      if (!authData.customToken) {
        throw new Error('No custom token received');
      }

      // Sign in with the custom token to get a proper Firebase user
      const userCredential = await signInWithCustomToken(auth, authData.customToken);
      this.currentUser = userCredential.user;

      return this.currentUser;
    } catch (error) {
      console.error('Authentication error:', error);
      this.currentUser = null;
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        this.currentUser = user;
        resolve(user);
      });
    });
  }

  static async getIdToken(): Promise<string | null> {
    return this.currentUser?.getIdToken() || null;
  }

  static async signOut(): Promise<void> {
    try {
      await auth.signOut();
      await new Promise<void>((resolve, reject) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      this.currentUser = null;
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  }
}