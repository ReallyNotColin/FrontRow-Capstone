// auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

import { auth, db } from "@/db/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state changes once
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("[AuthProvider] state changed:", u?.uid ?? "no user");
      setUser(u ?? null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      console.log("[AuthProvider.signIn] start", email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log("[AuthProvider.signIn] success");
      // onAuthStateChanged will update `user`
    } catch (e: any) {
      console.log(
        "[AuthProvider.signIn] error",
        "code:", e?.code,
        "message:", e?.message,
        "name:", e?.name
      );
      throw e;
    }
  };

  const signUp: AuthCtx["signUp"] = async (email, password) => {
    try {
      console.log("[AuthProvider.signUp] start", email);
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Optional: create a starter user profile in Firestore
      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          createdAt: serverTimestamp(),
        });
      } catch (e: any) {
        console.log("[AuthProvider.signUp] profile create failed:", e?.message || e);
        // Not fatal for auth; don’t rethrow here
      }

      console.log("[AuthProvider.signUp] success");
      // onAuthStateChanged will update `user`
    } catch (e: any) {
      console.log(
        "[AuthProvider.signUp] error",
        "code:", e?.code,
        "message:", e?.message,
        "name:", e?.name
      );
      throw e;
    }
  };

  const signOut: AuthCtx["signOut"] = async () => {
    try {
      console.log("[AuthProvider.signOut] start");
      await fbSignOut(auth);
      console.log("[AuthProvider.signOut] success");
      // onAuthStateChanged will set user=null
    } catch (e: any) {
      console.log(
        "[AuthProvider.signOut] error",
        "code:", e?.code,
        "message:", e?.message,
        "name:", e?.name
      );
      throw e;
    }
  };

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
