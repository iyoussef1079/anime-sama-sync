// extension/src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAUjHFTguUAB_gbHuY62QqUbMB3pPJtf-Y",
  authDomain: "anime-sama-sync.firebaseapp.com",
  projectId: "anime-sama-sync",
  storageBucket: "anime-sama-sync.firebasestorage.app",
  messagingSenderId: "837579805766",
  appId: "1:837579805766:web:b12960667b0966867ba647",
  measurementId: "G-D2JLKHH3R5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);