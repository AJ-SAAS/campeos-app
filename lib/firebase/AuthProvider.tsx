"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "./client";
import { isDisposableEmail } from "@/lib/disposableEmail";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  /** Emails a 6-digit code. Returns the seconds before another can be asked for. */
  sendEmailCode: (email: string) => Promise<number>;
  /** Checks the code and signs in. Creates the account the first time. */
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Signed up with email + password and hasn't clicked the link we emailed. */
  needsVerification: boolean;
  /** Sends the link again. */
  resendVerification: () => Promise<void>;
  /** Re-checks with Firebase. Returns true once the email is confirmed. */
  refreshVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Wraps the whole app (see app/layout.tsx) and tracks the signed-in
// Firebase user. Google and email/password, both through Firebase Auth
// directly — email/password needs the "Email/Password" provider turned
// on in the Firebase console (Authentication -> Sign-in method) or
// these two calls fail with auth/operation-not-allowed.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // user.reload() changes the user object in place, which React can't see.
  const [, setVerifyTick] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn() {
    const provider = new GoogleAuthProvider();
    // Without this, Google silently reuses whatever Google account is
    // already active in the browser and never shows the account picker —
    // so there's no way to sign in as a different Google account.
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }

  async function sendEmailCode(email: string): Promise<number> {
    if (isDisposableEmail(email)) throw new Error("auth/disposable-email");
    const res = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; cooldown?: number };
    if (!res.ok) throw new Error(data.error || "We couldn't send the code. Try again.");
    return data.cooldown ?? 30;
  }

  async function verifyEmailCode(email: string, code: string) {
    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
    if (!res.ok || !data.token) throw new Error(data.error || "That code didn't work. Try again.");
    await signInWithCustomToken(auth, data.token);
  }

  const needsVerification =
    !!user && user.providerData.some((p) => p.providerId === "password") && !user.emailVerified;

  async function resendVerification() {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }

  async function refreshVerification(): Promise<boolean> {
    const u = auth.currentUser;
    if (!u) return false;
    await u.reload();
    if (u.emailVerified) {
      // The server reads this from the ID token, so get a fresh one.
      await u.getIdToken(true);
    }
    setVerifyTick((n) => n + 1);
    return u.emailVerified;
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, sendEmailCode, verifyEmailCode, signInWithEmail, signOut, needsVerification, resendVerification, refreshVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used inside <AuthProvider>.");
  }
  return ctx;
}
