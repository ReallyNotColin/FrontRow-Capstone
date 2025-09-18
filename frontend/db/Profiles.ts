// src/db/Profiles.ts
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "@/db/firebaseConfig";

/** Require a signed-in user and return their uid. */
function requireUid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("Profiles: no signed-in user.");
  return u.uid;
}

/** /users/{uid} */
function userDoc() {
  return doc(db, "users", requireUid());
}

/** /users/{uid}/profiles */
function profilesCol() {
  return collection(userDoc(), "profiles");
}

/** /users/{uid}/groups */
function groupsCol() {
  return collection(userDoc(), "groups");
}

/* ----------------------------------------------------------------------------
 * Individual profiles
 * Doc id = profile name (trimmed). Fields: { name, allergens[], createdAt, updatedAt }
 * ---------------------------------------------------------------------------*/

/** Create or update an individual profile. */
export async function saveProfileFS(name: string, allergens: string[]) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Profile name is required.");

  const ref = doc(profilesCol(), trimmed);
  await setDoc(
    ref,
    {
      name: trimmed,
      allergens: Array.isArray(allergens) ? allergens : [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // will just get overwritten; that's OK for now
    },
    { merge: true }
  );
}

/** Delete an individual profile by name (doc id). */
export async function deleteProfileFS(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await deleteDoc(doc(profilesCol(), trimmed));
}

/** Subscribe to all individual profiles (sorted by name). */
export function onProfiles(
  callback: (profiles: { name: string; allergens: string[] }[]) => void
): Unsubscribe {
  const q = query(profilesCol(), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        name: (data?.name ?? d.id) as string,
        allergens: Array.isArray(data?.allergens) ? data.allergens : [],
      };
    });
    callback(rows);
  });
}

/* ----------------------------------------------------------------------------
 * Group profiles
 * Doc id = group name (trimmed). Fields: { name, members[], createdAt, updatedAt }
 * ---------------------------------------------------------------------------*/

/** Create or update a group profile. */
export async function saveGroupProfile(groupName: string, members: string[]) {
  const trimmed = groupName.trim();
  if (!trimmed) throw new Error("Group name is required.");

  const ref = doc(groupsCol(), trimmed);
  await setDoc(
    ref,
    {
      name: trimmed,
      members: Array.isArray(members) ? members : [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Delete a group profile by name (doc id). */
export async function deleteGroupProfile(groupName: string) {
  const trimmed = groupName.trim();
  if (!trimmed) return;
  await deleteDoc(doc(groupsCol(), trimmed));
}

/** Subscribe to all group profiles.
 *  Returns a map { [groupName]: members[] } to match your screen.
 */
export function onGroups(
  callback: (groupsMap: Record<string, string[]>) => void
): Unsubscribe {
  const q = query(groupsCol(), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const map: Record<string, string[]> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      const name = (data?.name ?? d.id) as string;
      const members = Array.isArray(data?.members) ? data.members : [];
      map[name] = members;
    });
    callback(map);
  });
}
