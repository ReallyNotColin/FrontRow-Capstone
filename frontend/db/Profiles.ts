// src/db/Profiles.ts
import { auth, db } from "@/db/firebaseConfig";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, type Unsubscribe
} from "firebase/firestore";

/* ----------------- helpers ----------------- */
function requireUid(): string {
  const u = auth.currentUser;
  if (!u) throw new Error("Profiles: no signed-in user.");
  return u.uid;
}
function userDoc() {
  return doc(db, "users", requireUid());
}
function profilesCol() {
  return collection(userDoc(), "profiles");
}
function groupsCol() {
  return collection(userDoc(), "groups");
}
function petsCol() {
  return collection(userDoc(), "pets"); // <— pet profiles live here
}

/* ----------------- types ----------------- */
export type ProfileDoc = {
  name: string;
  allergens: string[];
  intolerances: string[];
  dietary: string[];
  createdAt?: any;
  updatedAt?: any;
};

export type PetProfileDoc = ProfileDoc & {
  petType: string; // e.g., "Dog", "Cat"
};

/* ----------------- individual profiles ----------------- */
export function onProfiles(cb: (rows: ProfileDoc[]) => void): Unsubscribe {
  const q = query(profilesCol(), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const rows: ProfileDoc[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        name: (data?.name ?? d.id) as string,
        allergens: Array.isArray(data?.allergens) ? data.allergens : [],
        intolerances: Array.isArray(data?.intolerances) ? data.intolerances : [],
        dietary: Array.isArray(data?.dietary) ? data.dietary : [],
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
      };
    });
    cb(rows);
  });
}

export async function saveProfileFS(
  name: string,
  allergens: string[],
  intolerances: string[],
  dietary: string[]
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Profile name is required.");
  const ref = doc(profilesCol(), trimmed);
  await setDoc(
    ref,
    {
      name: trimmed,
      allergens: Array.isArray(allergens) ? allergens : [],
      intolerances: Array.isArray(intolerances) ? intolerances : [],
      dietary: Array.isArray(dietary) ? dietary : [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteProfileFS(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await deleteDoc(doc(profilesCol(), trimmed));
}

/* ----------------- group profiles ----------------- */
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

export async function deleteGroupProfile(groupName: string) {
  const trimmed = groupName.trim();
  if (!trimmed) return;
  await deleteDoc(doc(groupsCol(), trimmed));
}

export function onGroups(cb: (groups: Record<string, string[]>) => void): Unsubscribe {
  const q = query(groupsCol(), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const map: Record<string, string[]> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      const name = (data?.name ?? d.id) as string;
      map[name] = Array.isArray(data?.members) ? data.members : [];
    });
    cb(map);
  });
}

/* ----------------- pet profiles (NEW) ----------------- */
export function onPetProfiles(cb: (rows: PetProfileDoc[]) => void): Unsubscribe {
  const q = query(petsCol(), orderBy("name"));
  return onSnapshot(q, (snap) => {
    const rows: PetProfileDoc[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        name: (data?.name ?? d.id) as string,
        petType: (data?.petType ?? "") as string,
        allergens: Array.isArray(data?.allergens) ? data.allergens : [],
        intolerances: Array.isArray(data?.intolerances) ? data.intolerances : [],
        dietary: Array.isArray(data?.dietary) ? data.dietary : [],
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
      };
    });
    cb(rows);
  });
}

export async function savePetProfile(
  name: string,
  petType: string,
  allergens: string[],
  intolerances: string[],
  dietary: string[]
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Pet name is required.");
  const ref = doc(petsCol(), trimmed); // use name as doc id for easy edit/delete
  await setDoc(
    ref,
    {
      name: trimmed,
      petType: petType.trim(),
      allergens: Array.isArray(allergens) ? allergens : [],
      intolerances: Array.isArray(intolerances) ? intolerances : [],
      dietary: Array.isArray(dietary) ? dietary : [],
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deletePetProfile(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await deleteDoc(doc(petsCol(), trimmed));
}
