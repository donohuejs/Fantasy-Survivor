import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export type FirebaseUser = User;
export const firebaseConfig = {
  apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};
export const missingFirebaseSettings = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY',firebaseConfig.apiKey],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',firebaseConfig.authDomain],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID',firebaseConfig.projectId],
  ['NEXT_PUBLIC_FIREBASE_APP_ID',firebaseConfig.appId],
].filter(([,value])=>!value).map(([name])=>name as string);
export const firebaseConfigured = missingFirebaseSettings.length === 0;

export function getFirebase() {
  if (!firebaseConfigured) throw new Error(`Firebase is not configured. Missing: ${missingFirebaseSettings.join(', ')}. Add these to Vercel Production environment variables and redeploy.`);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return {auth:getAuth(app),db:getFirestore(app)};
}

export function authenticationError(error:unknown):string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages:Record<string,string> = {
    'auth/unauthorized-domain':'This website domain is not authorized in Firebase. Add this site’s hostname under Authentication → Settings → Authorized domains.',
    'auth/popup-blocked':'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
    'auth/popup-closed-by-user':'The Google sign-in window was closed before sign-in finished. Please try again.',
    'auth/cancelled-popup-request':'Another sign-in window is already open. Finish or close it before trying again.',
    'auth/operation-not-allowed':'Google sign-in is not enabled in Firebase Authentication.',
    'auth/invalid-api-key':'The Firebase API key in this deployment is invalid. Check the Vercel Production environment variables and redeploy.',
    'auth/network-request-failed':'Google sign-in could not connect. Check your connection and content blockers, then try again.',
  };
  return messages[code] ?? (error instanceof Error ? error.message : 'Authentication failed. Please try again.');
}
