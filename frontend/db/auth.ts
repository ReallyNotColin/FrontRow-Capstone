// src/db/auth.ts
import { createUserWithEmailAndPassword, UserCredential } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/db/firebaseConfig";

/**
 * Sign up and create the user doc in Firestore.
 */
export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  // 1) Create user in Firebase Auth
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // 2) Create user doc in Firestore
  const userRef = doc(db, "users", cred.user.uid);
  await setDoc(userRef, {
    email: cred.user.email,
    createdAt: serverTimestamp(),
  });

  return cred;
}
