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
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type MultiFactorResolver,
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

  // sign-in/out
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // MFA
  mfaRequired: boolean;
  resolveTotp: (code: string) => Promise<void>;
  cancelMfa: () => void;

  refreshAuthClaims: () => Promise<void>;
  resendVerification: () => Promise<void>;
};

const ADMIN_HOME = "/admin";
const USER_HOME = "/(tabs)/scan";
const SIGNIN_PATH = "/auth/sign-in";
const VERIFY_PATH = "/auth/verify-email";

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  // MFA state
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);

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

  const routeNow = (u: User | null, admin: boolean, verified: boolean) => {
    if (!u) {
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

  useEffect(() => {
    if (loading) return;
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
      await refreshAuthClaims();
      routeNow(auth.currentUser, isAdmin, !!auth.currentUser?.emailVerified);
      console.log("[Auth.signIn] success");
    } catch (err: any) {
      if (err?.code === "auth/multi-factor-auth-required") {
        // Peek at what’s enrolled
        console.log("MFA required details:", err?.customData);
        const resolver = getMultiFactorResolver(auth, err);
        console.log(
          "Hints:",
          resolver.hints.map(h => ({
            factorId: h.factorId,
            uid: h.uid,
            displayName: (h as any).displayName
          }))
        );

        // Navigate to your MFA verify screen
        // (adjust this path if different)
        router.push("/auth/mfa-verify");
      } else {
        console.log("[Auth.signIn] error", err?.code, err?.message);
        throw err;
      }
    }
  };


  const resolveTotp: AuthCtx["resolveTotp"] = async (code: string) => {
    if (!mfaResolver) throw new Error("No MFA resolver available.");
    // Find a TOTP factor among the enrolled hints
    const totpHint = mfaResolver.hints.find(
      (h) => (h as any).factorId === TotpMultiFactorGenerator.FACTOR_ID
    );
    if (!totpHint) {
      throw new Error("This account has no TOTP factor. (It may be SMS-based MFA.)");
    }
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code);
      await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(null);
      await refreshAuthClaims();
      routeNow(auth.currentUser, isAdmin, !!auth.currentUser?.emailVerified);
    } catch (e: any) {
      console.log("[Auth.resolveTotp] error", e?.code, e?.message);
      throw e;
    }
  };

  const cancelMfa = () => setMfaResolver(null);

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
      setMfaResolver(null);
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
      await u.getIdToken(true);
      await u.reload();
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
      mfaRequired: !!mfaResolver,
      resolveTotp,
      cancelMfa,
      refreshAuthClaims,
      resendVerification,
    }),
    [user, loading, isAdmin, isVerified, mfaResolver]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
