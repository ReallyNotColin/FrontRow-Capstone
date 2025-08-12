// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
