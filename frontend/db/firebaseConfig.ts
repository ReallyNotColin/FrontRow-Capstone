// src/db/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDwgwkVtullMquiuwc3tqZanhLTX57u1ag",
  authDomain: "nibblewise-78537.firebaseapp.com",
  projectId: "nibblewise-78537",
  storageBucket: "nibblewise-78537.firebasestorage.app",
  messagingSenderId: "645345181836",
  appId: "1:645345181836:web:f796ae38c174e10034bba9",
  measurementId: "G-XH2E4SWK3S",
};

// 1) App: reuse if already initialized
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2) Auth: guard to avoid “multiple Auth instances” errors
let _auth;
try {
  _auth = getAuth(app);
} catch {
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}
export const auth = _auth;

// 3) Firestore
export const db = getFirestore(app);
