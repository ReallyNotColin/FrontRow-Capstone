// src/db/userPaths.ts
import { auth, db } from "@/db/firebaseConfig";
import { collection, doc } from "firebase/firestore";

export function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

// Collections
export function usersCol() {
  return collection(db, "users");
}
export function userDoc(uid = requireUid()) {
  return doc(db, "users", uid);
}
export function historyCol(uid = requireUid()) {
  return collection(db, "users", uid, "history");
}
export function profilesCol(uid = requireUid()) {
  return collection(db, "users", uid, "profiles");
}
export function groupsCol(uid = requireUid()) {
  return collection(db, "users", uid, "groups");
}
