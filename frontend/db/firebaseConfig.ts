import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
} from "firebase/functions";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { Platform, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- Firebase web config (unchanged) ---
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

// ---------- Auth (native-safe singleton) ----------
declare global {
  // eslint-disable-next-line no-var
  var _firebaseAuthSingleton: Auth | undefined;
}

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

// ---------- Core services ----------
export const db = getFirestore(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_REGION || "us-central1");

// ---------- Emulator wiring (host-aware, optional) ----------
const USE_EMU = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "1";

// Try to infer Metro host as a fallback when running on-device in dev
function inferDevHost(): string | undefined {
  try {
    // Available in dev builds/Expo Go
    // @ts-ignore
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    const m = scriptURL?.match(/\/\/([^:]+):\d+\//);
    return m?.[1];
  } catch {}
  return undefined;
}

// Default hosts for different runtimes
const defaultHost =
  Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";

const EMU_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST || inferDevHost() || defaultHost;

const FS_PORT = Number(process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
const FN_PORT = Number(process.env.EXPO_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);

// Toggle Firestore emulator here.
// If you want Firestore to stay on PROD while Functions uses the emulator,
// set EXPO_PUBLIC_USE_FIREBASE_EMULATORS="0" in app.json.
if (USE_EMU) {
  connectFirestoreEmulator(db, EMU_HOST, FS_PORT);
  console.log(`[Firebase] Firestore emulator: http://${EMU_HOST}:${FS_PORT}`);
}

// You can keep Functions on the emulator regardless of USE_EMU if you want.
// For now we follow USE_EMU for consistency:
if (USE_EMU) {
  connectFunctionsEmulator(functions, EMU_HOST, FN_PORT);
  console.log(`[Firebase] Functions emulator: http://${EMU_HOST}:${FN_PORT}`);
}
