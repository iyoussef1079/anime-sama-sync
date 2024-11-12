import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL
};

console.log('Initializing Firebase with project:', process.env.FIREBASE_PROJECT_ID); // Debug log

try {
  initializeApp({
    credential: cert(serviceAccount as any)
  });
  console.log('Firebase initialized successfully'); // Debug log
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
