// extension/src/config/firebase.ts
import { initializeApp } from 'firebase/app';
// See https://firebase.google.com/docs/auth/web/chrome-extension?hl=fr#use-web-extension for more details
import { getAuth } from 'firebase/auth/web-extension';

// const firebaseConfig = {
//   apiKey: "AIzaSyAUjHFTguUAB_gbHuY62QqUbMB3pPJtf-Y",
//   authDomain: "anime-sama-sync.firebaseapp.com",
//   projectId: "anime-sama-sync",
//   storageBucket: "anime-sama-sync.firebasestorage.app",
//   messagingSenderId: "837579805766",
//   appId: "1:837579805766:web:b12960667b0966867ba647",
//   // measurementId: "G-D2JLKHH3R5"
// };


/// PROD config uncomment only to deploy
const firebaseConfig = {
  apiKey: "AIzaSyDM_7YvLRAtNdmUVibz6eMyLzbcDOFlViw",
  authDomain: "anime-sama-sync-prod-75fd6.firebaseapp.com",
  projectId: "anime-sama-sync-prod-75fd6",
  storageBucket: "anime-sama-sync-prod-75fd6.firebasestorage.app",
  messagingSenderId: "851220827175",
  appId: "1:851220827175:web:69a82d329ad8cfaa631202",
  // measurementId: "G-XFD16LECZC"
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);