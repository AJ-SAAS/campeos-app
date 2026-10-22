"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
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
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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

  async function signUpWithEmail(email: string, password: string) {
    // The cheapest fake sign-ups use throwaway inboxes. The server checks
    // again before any AI call (lib/serverAuth.ts).
    if (isDisposableEmail(email)) throw new Error("auth/disposable-email");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Proves the person owns the inbox. If sending fails they can tap
    // "Send it again" on the next screen.
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // handled by the resend button
    }
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
      value={{ user, loading, signIn, signUpWithEmail, signInWithEmail, signOut, needsVerification, resendVerification, refreshVerification }}
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
