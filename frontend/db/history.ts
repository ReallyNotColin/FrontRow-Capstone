// src/db/history.ts
import {
  addDoc, collection, serverTimestamp,
  query, orderBy, getDocs, onSnapshot, Unsubscribe
} from "firebase/firestore";
import { historyCol } from "./userPaths";

// Create
export async function saveToHistory(foodName: string, warningsCsv: string, matchedCsv: string) {
  await addDoc(historyCol(), {
    foodName,
    warnings: warningsCsv,
    matched: matchedCsv,
    createdAt: serverTimestamp(),
  });
}

// Read (one-shot)
export async function getHistoryOnce() {
  const q = query(historyCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
}

// Subscribe (live updates)
export function onHistory(callback: (rows: any[]) => void): Unsubscribe {
  const q = query(historyCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(rows);
  });
}
