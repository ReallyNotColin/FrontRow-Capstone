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

export type HistoryRow = {
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
  await addDoc(historyCol(), {
    foodName,
    warnings: warningsCsv,
    matched: matchedCsv,
    createdAt: serverTimestamp(),
  } as HistoryRow);
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

/** Live subscription (sorted by newest first) */
export function onHistory(callback: (rows: HistoryRow[]) => void): Unsubscribe {
  const q = query(historyCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as HistoryRow[];
    callback(rows);
  });
}

/** TEMP compatibility shim while you remove old callers, if any */
// export const getHistory = getHistoryOnce;
