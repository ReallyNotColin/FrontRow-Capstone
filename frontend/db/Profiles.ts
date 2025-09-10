// src/db/Profiles.ts
import { auth, db } from "@/db/firebaseConfig";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, writeBatch, arrayUnion, arrayRemove
} from "firebase/firestore";

export type Profile = {
  name: string;
  allergens: string[];
};

export type GroupProfile = {
  groupName: string;
  members: Profile[]; // kept for compatibility with your type
};

// --------- helpers ---------
function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in");
  return uid;
}
function profilesCol(uid = requireUid()) {
  return collection(db, "users", uid, "profiles");
}
function profileDoc(name: string, uid = requireUid()) {
  return doc(db, "users", uid, "profiles", name);
}
function groupsCol(uid = requireUid()) {
  return collection(db, "users", uid, "groups");
}
function groupDoc(name: string, uid = requireUid()) {
  return doc(db, "users", uid, "groups", name);
}

// -------------------------------------------------------------------
// ❇️ PROFILES (individual)
// Stored at /users/{uid}/profiles/{profileName} → { name, allergens[], updatedAt }
//
// Your original API shape is kept. Where appropriate, arrayUnion/arrayRemove
// are used to avoid race conditions for single-item updates.
// -------------------------------------------------------------------

/** Return a map of profileName -> allergens[] */
export const getAllProfileData = async (): Promise<Record<string, string[]>> => {
  const snap = await getDocs(profilesCol());
  const out: Record<string, string[]> = {};
  snap.forEach(d => {
    const data = d.data() as { allergens?: string[] };
    out[d.id] = Array.isArray(data.allergens) ? data.allergens : [];
  });
  return out;
};

/** INTERNAL in your old file — still provided, overwrites all profiles to match `data`. */
const saveAllProfileData = async (data: Record<string, string[]>): Promise<void> => {
  const uid = requireUid();
  const batch = writeBatch(db);
  // clear all existing docs first (optional; here we overwrite existing and create missing)
  // We won't delete extras, to be safer. If you need a full sync (delete missing), fetch and delete first.
  Object.entries(data).forEach(([name, allergens]) => {
    const ref = doc(db, "users", uid, "profiles", name);
    batch.set(ref, { name, allergens, updatedAt: serverTimestamp() }, { merge: true });
  });
  await batch.commit();
};

/** Create or overwrite a profile */
export const saveProfile = async (profileName: string, options: string[]): Promise<void> => {
  await setDoc(profileDoc(profileName), {
    name: profileName,
    allergens: options,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/** Get a single profile's allergens[] */
export const getProfiles = async (profileName: string): Promise<string[]> => {
  const snap = await getDoc(profileDoc(profileName));
  if (!snap.exists()) return [];
  const data = snap.data() as { allergens?: string[] };
  return Array.isArray(data.allergens) ? data.allergens : [];
};

/** Add a new allergen to a profile */
export const addProfile = async (profileName: string, newOption: string): Promise<void> => {
  await setDoc(
    profileDoc(profileName),
    { name: profileName, allergens: arrayUnion(newOption), updatedAt: serverTimestamp() },
    { merge: true }
  );
};

/** Replace one allergen value with another */
export const updateProfile = async (
  profileName: string,
  oldOption: string,
  newOption: string
): Promise<void> => {
  // Fetch current, replace, write back (array transforms can’t "replace")
  const current = await getProfiles(profileName);
  const updated = current.map(opt => (opt === oldOption ? newOption : opt));
  await setDoc(
    profileDoc(profileName),
    { name: profileName, allergens: updated, updatedAt: serverTimestamp() },
    { merge: true }
  );
};

/** Remove a single allergen from a profile */
export const deleteProfile = async (profileName: string, optionToDelete: string): Promise<void> => {
  // Prefer arrayRemove (idempotent)
  await setDoc(
    profileDoc(profileName),
    { name: profileName, allergens: arrayRemove(optionToDelete), updatedAt: serverTimestamp() },
    { merge: true }
  );
};

/** Delete the whole profile document */
export const clearProfile = async (profileName: string): Promise<void> => {
  await deleteDoc(profileDoc(profileName));
};

/** Get all profile names */
export const getAllProfileNames = async (): Promise<string[]> => {
  const snap = await getDocs(profilesCol());
  return snap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b));
};

// -------------------------------------------------------------------
// ❇️ GROUPS
// Stored at /users/{uid}/groups/{groupName} → { name, members[] (profile names), updatedAt }
// Your old types used Profile[] for members; to keep behavior, we store just names
// and your UI can still resolve to profiles if needed.
// -------------------------------------------------------------------

/** Save a group with member profile names */
export const saveGroupProfile = async (groupName: string, profileNames: string[]): Promise<void> => {
  await setDoc(groupDoc(groupName), {
    name: groupName,
    members: profileNames,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/** Get a group's member profile names */
export const getGroupMembers = async (groupName: string): Promise<string[]> => {
  const snap = await getDoc(groupDoc(groupName));
  if (!snap.exists()) return [];
  const data = snap.data() as { members?: string[] };
  return Array.isArray(data.members) ? data.members : [];
};

/** Get all group names */
export const getAllGroupProfileNames = async (): Promise<string[]> => {
  const snap = await getDocs(groupsCol());
  return snap.docs.map(d => d.id).sort((a, b) => a.localeCompare(b));
};

/** Delete a saved group */
export const deleteGroupProfile = async (groupName: string): Promise<void> => {
  await deleteDoc(groupDoc(groupName));
};

// -------------------------------------------------------------------
// The AsyncStorage-only helpers from your old file are no-ops now.
// Keeping compatibility stubs in case other code imports them.
// -------------------------------------------------------------------

const saveAllGroupData = async (_data: Record<string, string[]>): Promise<void> => {
  // No global "save all" for groups in Firestore; implement if you actually need it.
};

export const getAllGroupData = async (): Promise<Record<string, string[]>> => {
  // Build map groupName -> members[] from Firestore, for compatibility
  const snap = await getDocs(groupsCol());
  const out: Record<string, string[]> = {};
  snap.forEach(d => {
    const data = d.data() as any;
    out[d.id] = Array.isArray(data.members) ? data.members : [];
  });
  return out;
};

/** Alias that matches your old "saveGroup" signature (writes one group) */
export const saveGroup = async (groupName: string, options: string[]): Promise<void> => {
  await saveGroupProfile(groupName, options);
};
