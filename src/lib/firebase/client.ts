import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = (): boolean => Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

/** Demo mode = explicit flag OR missing Firebase config. In demo mode no Firebase call is ever made. */
export const isDemoMode = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isFirebaseConfigured();

let app: FirebaseApp | undefined;
export function getFirebaseApp(): FirebaseApp {
  if (isDemoMode()) throw new Error("Firebase is not available in demo mode.");
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export const getFirebaseAuth = (): Auth => getAuth(getFirebaseApp());

let db: Firestore | undefined;
export function getDb(): Firestore {
  if (!db) {
    const a = getFirebaseApp();
    try {
      db = initializeFirestore(a, { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(a);
    }
  }
  return db;
}
