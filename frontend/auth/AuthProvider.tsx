// auth/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  getIdTokenResult,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth, db } from "@/db/firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { router } from "expo-router";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isVerified: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  refreshAuthClaims: () => Promise<void>;
  resendVerification: () => Promise<void>;
};

const ADMIN_HOME = "/admin";
const USER_HOME = "/(tabs)/scan";
const SIGNIN_PATH = "/auth/sign-in";
const VERIFY_PATH = "/auth/verify-email"; // ← change if your verify screen path is different

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // prevent double routing during initial bootstrap
  const bootRoutedRef = useRef(false);

  // Keep client user in sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log(
        "[AuthProvider] state changed:",
        u?.uid ?? "no user",
        "verified:",
        !!u?.emailVerified
      );
      setUser(u ?? null);
      setIsVerified(!!u?.emailVerified);

      // Try to read custom claims (non-forced to avoid spamming refresh)
      if (u) {
        try {
          const token = await getIdTokenResult(u, false);
          const admin = token.claims?.admin === true;
          setIsAdmin(admin);
          console.log("[AuthProvider] claims admin?", admin);
        } catch (e) {
          console.log("[AuthProvider] getIdTokenResult error", (e as any)?.message);
        }
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });
    return unsub;
  }, []);

  // Centralized router
  const routeNow = (u: User | null, admin: boolean, verified: boolean) => {
    if (!u) {
      if (router.canGoBack()) router.dismissAll();
      router.replace(SIGNIN_PATH);
      return;
    }
    if (admin) {
      router.replace(ADMIN_HOME);
      return;
    }
    if (!verified) {
      router.replace(VERIFY_PATH);
      return;
    }
    router.replace(USER_HOME);
  };

  // Route once when boot completes, and whenever user/admin/verified changes
  useEffect(() => {
    if (loading) return;
    // Avoid flashing routes during first render
    if (!bootRoutedRef.current) {
      bootRoutedRef.current = true;
    }
    routeNow(user, isAdmin, isVerified);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isAdmin, isVerified]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    try {
      console.log("[Auth.signIn] start", email);
      await signInWithEmailAndPassword(auth, email, password);
      // force a refresh so we immediately see updated claims
      await refreshAuthClaims();
      routeNow(auth.currentUser, isAdmin, !!auth.currentUser?.emailVerified);
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

      try {
        await sendEmailVerification(cred.user);
        console.log("[Auth.signUp] verification email sent");
      } catch (ve: any) {
        console.log("[Auth.signUp] sendEmailVerification failed:", ve?.code, ve?.message);
      }

      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          createdAt: serverTimestamp(),
        });
      } catch (pe: any) {
        console.log("[Auth.signUp] profile create failed:", pe?.code, pe?.message);
      }

      // Make sure claims/user object are fresh, then route (likely to verify screen)
      await refreshAuthClaims();
      routeNow(auth.currentUser, false, !!auth.currentUser?.emailVerified);
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
      setIsAdmin(false);
      setIsVerified(false);
      routeNow(null, false, false);
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
      await u.getIdToken(true); // refresh claims
      await u.reload(); // refresh user (emailVerified)
      const token = await getIdTokenResult(u, false);
      const admin = token.claims?.admin === true;
      setIsAdmin(admin);
      setIsVerified(!!u.emailVerified);
      console.log("[Auth.refreshAuthClaims] refreshed; verified =", u.emailVerified, "admin =", admin);
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
      await sendEmailVerification(u);
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
      isAdmin,
      isVerified,
      signIn,
      signUp,
      signOut,
      refreshAuthClaims,
      resendVerification,
    }),
    [user, loading, isAdmin, isVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
