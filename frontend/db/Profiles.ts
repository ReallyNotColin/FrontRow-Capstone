// db/Profiles.ts
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc,
  deleteDoc, where, serverTimestamp, FirestoreDataConverter
} from 'firebase/firestore';
import { db, auth } from '@/db/firebaseConfig';

/** ───────── Types ───────── */

export type SavedProfile = {
  name: string;
  allergens: string[];
  intolerances: string[];
  dietary: string[];
  updatedAt?: any; // Timestamp
};

export type SavedPetProfile = {
  name: string;
  petType: string;         // e.g. "Dog" | "Cat"
  allergens: string[];
  updatedAt?: any;
};

export type GroupMember =
  | { name: string; kind: 'human' }
  | { name: string; kind: 'pet' };

export type SavedGroup = {
  name: string;
  members: GroupMember[]; // NEW: typed members
  updatedAt?: any;
};

/** ───────── Utils ───────── */

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('[Profiles] No signed-in user');
  return uid;
}

function ucol(uid: string, sub: 'profiles'|'groups'|'pets') {
  return collection(db, 'users', uid, sub);
}

/** ───────── Converters (optional) ───────── */

const profileConv: FirestoreDataConverter<SavedProfile> = {
  toFirestore(p) { return p as any; },
  fromFirestore(snap, options) {
    const d = snap.data(options) as any;
    return {
      name: d.name ?? snap.id,
      allergens: Array.isArray(d.allergens) ? d.allergens : [],
      intolerances: Array.isArray(d.intolerances) ? d.intolerances : [],
      dietary: Array.isArray(d.dietary) ? d.dietary : [],
      updatedAt: d.updatedAt ?? null,
    };
  },
};

const groupConv: FirestoreDataConverter<SavedGroup> = {
  toFirestore(g) { return g as any; },
  fromFirestore(snap, options) {
    const d = snap.data(options) as any;
    let members: GroupMember[] = [];

    // Legacy: members as string[]
    if (Array.isArray(d.members) && d.members.length && typeof d.members[0] === 'string') {
      members = (d.members as string[]).map(n => ({ name: n, kind: 'human' as const }));
    }

    // New: members as typed objects
    if (Array.isArray(d.members) && d.members.length && typeof d.members[0] === 'object') {
      members = d.members.map((m: any) => ({
        name: String(m.name ?? ''),
        kind: m.kind === 'pet' ? 'pet' as const : 'human' as const,
      }));
    }

    return {
      name: d.name ?? snap.id,
      members,
      updatedAt: d.updatedAt ?? null,
    };
  },
};


const petConv: FirestoreDataConverter<SavedPetProfile> = {
  toFirestore(p) { return p as any; },
  fromFirestore(snap, options) {
    const d = snap.data(options) as any;
    // IMPORTANT: ignore legacy pet fields (intolerances/dietary) if present
    return {
      name: d.name ?? snap.id,
      petType: d.petType ?? 'Dog',
      allergens: Array.isArray(d.allergens) ? d.allergens : [],
      updatedAt: d.updatedAt ?? null,
    };
  },
};

/** ───────── Individuals ───────── */

export function onProfiles(cb: (rows: SavedProfile[]) => void) {
  const uid = requireUid();
  const q = query(ucol(uid, 'profiles').withConverter(profileConv), orderBy('name'));
  const unsub = onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => d.data()));
  });
  return unsub;
}

export async function saveProfileFS(
  name: string,
  allergens: string[],
  intolerances: string[],
  dietary: string[],
) {
  const uid = requireUid();
  const ref = doc(ucol(uid, 'profiles'), name);
  await setDoc(ref, {
    name,
    allergens,
    intolerances,
    dietary,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteProfileFS(name: string) {
  const uid = requireUid();
  await deleteDoc(doc(ucol(uid, 'profiles'), name));
}

/** ───────── Groups ───────── */

export function onGroups(cb: (rows: Record<string, GroupMember[]>) => void) {
  const uid = requireUid();
  const q = query(ucol(uid, 'groups').withConverter(groupConv), orderBy('name'));
  return onSnapshot(q, (snap) => {
    const map: Record<string, GroupMember[]> = {};
    for (const d of snap.docs) {
      const g = d.data();
      map[g.name] = g.members ?? [];
    }
    cb(map);
  });
}

export async function saveGroupProfile(name: string, members: GroupMember[]) {
  const uid = requireUid();
  const ref = doc(ucol(uid, 'groups'), name);
  await setDoc(ref, { name, members, updatedAt: serverTimestamp() }, { merge: true });
}


export async function deleteGroupProfile(name: string) {
  const uid = requireUid();
  await deleteDoc(doc(ucol(uid, 'groups'), name));
}

/** ───────── Pets (ALLERGENS ONLY) ───────── */

export function onPetProfiles(cb: (rows: SavedPetProfile[]) => void) {
  const uid = requireUid();
  const q = query(ucol(uid, 'pets').withConverter(petConv), orderBy('name'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => d.data()));
  });
}

/**
 * Save or update a pet profile (ALLERGENS ONLY).
 * This replaces the old signature that accepted intolerances/dietary.
 */
export async function savePetProfile(
  name: string,
  petType: string,
  allergens: string[],
) {
  const uid = requireUid();
  const ref = doc(ucol(uid, 'pets'), name);
  await setDoc(ref, {
    name,
    petType,
    allergens,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deletePetProfile(name: string) {
  const uid = requireUid();
  await deleteDoc(doc(ucol(uid, 'pets'), name));
}
