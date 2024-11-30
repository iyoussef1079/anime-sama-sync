// src/config/firebase.ts
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

class FirebaseAdmin {
  private static instance: FirebaseAdmin;
  private app: App;
  private _db: Firestore;
  private _auth: Auth;

  private constructor() {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      // Adding these fields for completeness, they're needed for auth operations
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    try {
      console.log('Initializing Firebase with project:', process.env.FIREBASE_PROJECT_ID);
      
      this.app = initializeApp({
        credential: cert(serviceAccount as any)
      });
      
      // Initialize Firestore with your existing settings
      this._db = getFirestore(this.app);
      this._db.settings({ ignoreUndefinedProperties: true });
      
      // Initialize Auth
      this._auth = getAuth(this.app);

      console.log('Firebase Admin (Firestore & Auth) initialized successfully');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }

  public static getInstance(): FirebaseAdmin {
    if (!FirebaseAdmin.instance) {
      FirebaseAdmin.instance = new FirebaseAdmin();
    }
    return FirebaseAdmin.instance;
  }

  public get db(): Firestore {
    return this._db;
  }

  public get auth(): Auth {
    return this._auth;
  }
}

const firebaseAdmin = FirebaseAdmin.getInstance();

export const db = firebaseAdmin.db;
export const auth = firebaseAdmin.auth;
export { firebaseAdmin as admin };