// extension/src/services/authService.ts
import { 
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { auth } from '../config/firebase';

export class AuthService {
  static async signInWithGoogle(): Promise<User | null> {
    try {
      // 1. Obtenir le token OAuth via chrome.identity
      const token = await new Promise<string>((resolve, reject) => {
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

      // 2. Créer des credentials Google avec ce token
      const credential = GoogleAuthProvider.credential(null, token);

      // 3. S'authentifier avec Firebase
      const userCredential = await signInWithCredential(auth, credential);
      console.log('Firebase authentication successful');

      return userCredential.user;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  static async getIdToken(): Promise<string | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;
    return user.getIdToken();
  }

  static async signOut(): Promise<void> {
    try {
      await auth.signOut();
      // Clear Chrome identity token
      await new Promise<void>((resolve, reject) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  }
}