import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator
} from "firebase/functions";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---- Your project config (unchanged) ----
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

// ---- Auth (unchanged) ----
declare global { var _firebaseAuthSingleton: Auth | undefined; }

let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  if (!global._firebaseAuthSingleton) {
    global._firebaseAuthSingleton = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
  auth = global._firebaseAuthSingleton;
}
export { auth };

// ---- Firestore (ALWAYS PROD) ----
export const db = getFirestore(app);

// ---- Functions (prod by default) ----
export const functions = getFunctions(app, "us-central1");

// Optional: connect ONLY the Functions emulator in dev if opted-in with env flags
// Set these via app.config.(ts|js) -> extra -> expose to EXPO_PUBLIC_*
// EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR=1
// EXPO_PUBLIC_FN_EMU_HOST=<your-machine-LAN-IP or 10.0.2.2 for Android emulator>
// EXPO_PUBLIC_FN_EMU_PORT=5001
if (__DEV__ && process.env.EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR === "1") {
  const defaultHost =
    Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1"; // phone-on-LAN? Prefer your laptop's LAN IP instead
  const host = process.env.EXPO_PUBLIC_FN_EMU_HOST || defaultHost;
  const port = Number(process.env.EXPO_PUBLIC_FN_EMU_PORT || "5001");
  connectFunctionsEmulator(functions, host, port);
  console.log(`[Firebase] Connected to Functions emulator at http://${host}:${port}`);
}
