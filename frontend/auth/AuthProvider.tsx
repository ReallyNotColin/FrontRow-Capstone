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
  sendEmailVerification,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/db/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

/** Public API for consumers */
type AuthCtx = {
  user: User | null;
  loading: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  /** Force-refresh ID token & user object (needed after email verification) */
  refreshAuthClaims: () => Promise<void>;

  /** Re-send the verification email to the current user */
  resendVerification: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep client user in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("[AuthProvider] state changed:", u?.uid ?? "no user", "verified:", !!u?.emailVerified);
      setUser(u ?? null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      console.log("[Auth.signIn] start", email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log("[Auth.signIn] success");
    } catch (e: any) {
      console.log("[Auth.signIn] error", e?.code, e?.message);
      throw e;
    }
  };

  const signUp: AuthCtx["signUp"] = async (email, password) => {
    try {
      console.log("[Auth.signUp] start", email);
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 🔔 Send the verification email right after account creation
      try {
        await sendEmailVerification(cred.user /*, optionalActionCodeSettings */);
        console.log("[Auth.signUp] verification email sent");
      } catch (ve: any) {
        console.log("[Auth.signUp] sendEmailVerification failed:", ve?.code, ve?.message);
        // not fatal for account creation; still let the user proceed to verify later
      }

      // Optional: create a profile doc
      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          createdAt: serverTimestamp(),
        });
      } catch (pe: any) {
        console.log("[Auth.signUp] profile create failed:", pe?.code, pe?.message);
      }

      console.log("[Auth.signUp] success");
    } catch (e: any) {
      console.log("[Auth.signUp] error", e?.code, e?.message);
      throw e;
    }
  };

  const signOut: AuthCtx["signOut"] = async () => {
    try {
      console.log("[Auth.signOut] start");
      await fbSignOut(auth);
      console.log("[Auth.signOut] success");
    } catch (e: any) {
      console.log("[Auth.signOut] error", e?.code, e?.message);
      throw e;
    }
  };

  const refreshAuthClaims: AuthCtx["refreshAuthClaims"] = async () => {
    const u = auth.currentUser;
    if (!u) return;
    try {
      console.log("[Auth.refreshAuthClaims] forcing token refresh");
      // Force a new ID token (updates custom claims like email_verified)
      await u.getIdToken(true);
      // Refresh the user object (updates user.emailVerified)
      await u.reload();
      console.log("[Auth.refreshAuthClaims] refreshed; verified =", u.emailVerified);
    } catch (e: any) {
      console.log("[Auth.refreshAuthClaims] error", e?.code, e?.message);
      throw e;
    }
  };

  const resendVerification: AuthCtx["resendVerification"] = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("No current user to verify.");
    try {
      console.log("[Auth.resendVerification] sending email");
      await sendEmailVerification(u /*, optionalActionCodeSettings */);
      console.log("[Auth.resendVerification] sent");
    } catch (e: any) {
      console.log("[Auth.resendVerification] error", e?.code, e?.message);
      throw e;
    }
  };

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      signIn,
      signUp,
      signOut,
      refreshAuthClaims,
      resendVerification,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
