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
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "./client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function signUpWithEmail(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUpWithEmail, signInWithEmail, signOut }}
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
