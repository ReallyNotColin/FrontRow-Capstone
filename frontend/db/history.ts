// src/db/history.ts
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  type Unsubscribe,
  doc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "@/db/firebaseConfig";

/** Ensure we have a signed-in user and return their uid. */
function requireUid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("History: no signed-in user.");
  return u.uid;
}

/** /users/{uid} */
function userDoc() {
  return doc(db, "users", requireUid());
}

/** /users/{uid}/history */
function historyCol() {
  return collection(userDoc(), "history");
}

/** /users/{uid}/results */
function resultsCol() {
  return collection(userDoc(), "results");
}

export type HistoryRow = {
  id?: string;
  foodName: string;     // e.g., "Peanut Butter"
  warnings: string;     // CSV string of allergens present
  matched: string;      // CSV string of matches vs profile
  createdAt?: any;
};

export type ResultsRow = {
  id?: string;
  foodName: string;     // e.g., "Peanut Butter"
  warnings: string;     // CSV string of allergens present
  matched: string;      // CSV string of matches vs profile
  createdAt?: any;
};

/** Create a new history row (auto-id) under /users/{uid}/history */
export async function saveToHistory(
  foodName: string,
  warningsCsv: string,
  matchedCsv: string
) {
  const docId = foodName.toLowerCase().replace(/\s+/g, "_");
  await setDoc(doc(historyCol(), docId), {
    foodName,
    warnings: warningsCsv,
    matched: matchedCsv,
    createdAt: serverTimestamp(),
  } as HistoryRow);
}

/** Create a new result row (auto-id) under /users/{uid}/results */
export async function saveToResults(
  foodName: string,
  warningsCsv: string,
  matchedCsv: string
) {
  const docId = foodName.toLowerCase().replace(/\s+/g, "_"); // consistent ID
  await setDoc(doc(resultsCol(), docId), {
    foodName,
    warnings: warningsCsv,
    matched: matchedCsv,
    createdAt: serverTimestamp(),
  } as ResultsRow); // ⬅️ only change
}

/** Optional helpers */
export async function deleteHistory(id: string) {
  await deleteDoc(doc(historyCol(), id));
}

/** One-shot read (sorted by newest first) */
export async function getHistoryOnce(): Promise<HistoryRow[]> {
  const q = query(historyCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as HistoryRow[];
}

export async function getResultsOnce(): Promise<ResultsRow[]> { // ⬅️ only change
  const q = query(resultsCol(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ResultsRow[];
}

/** Clear all results */
export async function clearResults() {
  const results = await getResultsOnce();
  for (const r of results) {
    if (r.id) {
      await deleteDoc(doc(resultsCol(), r.id));
    }
  }
}

/** Live subscription (sorted by newest first) */
export function onHistory(callback: (rows: HistoryRow[]) => void): Unsubscribe {
  const q = query(historyCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as HistoryRow[];
    callback(rows);
  });
}

export function onResults(callback: (rows: ResultsRow[]) => void): Unsubscribe {
  const q = query(resultsCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ResultsRow[];
    console.log('Results subscription:', rows);
    callback(rows);
  });
}

/** TEMP compatibility shim while you remove old callers, if any */
// export const getHistory = getHistoryOnce;
