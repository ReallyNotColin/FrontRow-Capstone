import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions} from "firebase/functions";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { Platform } from "react-native";
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

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 2) Auth (web vs native, and guard RN with a global singleton)
declare global {
  // eslint-disable-next-line no-var
  var _firebaseAuthSingleton: Auth | undefined;
}

let auth: Auth;
if (Platform.OS === "web") {
  // Web uses default browser persistence
  auth = getAuth(app);
} else {
  // RN: create once and reuse across Fast Refresh / re-imports
  if (!global._firebaseAuthSingleton) {
    global._firebaseAuthSingleton = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
  auth = global._firebaseAuthSingleton;
}
export { auth };

// 3) Firestore
export const db = getFirestore(app);

export const firestore = getFunctions(app, 'us-central1');

//  Firestore emulator (dev only)
import { connectFirestoreEmulator } from "firebase/firestore";

if (__DEV__) {
  const DEFAULT_DB_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  const DB_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST || DEFAULT_DB_HOST;
  connectFirestoreEmulator(db, DB_HOST, 8080);
  console.log(`[Firebase] Connected to Firestore emulator at http://${DB_HOST}:8080`);
}

// 4) Functions
export const functions = getFunctions(app, "us-central1");

import { connectFunctionsEmulator } from "firebase/functions";
if (__DEV__) {
  const DEFAULT_EMU_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  const EMU_HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST || DEFAULT_EMU_HOST;
  connectFunctionsEmulator(functions, EMU_HOST, 5001);
  console.log(`[Firebase] Connected to Functions emulator at http://${EMU_HOST}:5001`);
}