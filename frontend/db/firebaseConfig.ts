// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// From Firebase Console → Project settings → Your apps → Web App
const firebaseConfig = {
  apiKey: "AIzaSyDwgwkVtullMquiuwc3tqZanhLTX57u1ag",
  authDomain: "nibblewise-78537.firebaseapp.com",
  projectId: "nibblewise-78537",
  storageBucket: "nibblewise-78537.firebasestorage.app",
  messagingSenderId: "645345181836",
  appId: "1:645345181836:web:f796ae38c174e10034bba9",
  measurementId: "G-XH2E4SWK3S"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Helper to ensure we’re signed in anonymously before Firestore reads
let authReadyPromise: Promise<void> | null = null;
export function ensureAnonAuth(): Promise<void> {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve();
        }
      },
      (err) => reject(err)
    );

    signInAnonymously(auth).catch(reject);
  });

  return authReadyPromise;
}