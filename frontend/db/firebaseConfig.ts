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

export const functions = getFunctions(app, 'us-central1');