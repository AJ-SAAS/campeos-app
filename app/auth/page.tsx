"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getSubscription, isActive } from "@/lib/firebase/subscription";
import { PlanKey } from "@/lib/stripe/client";

// The one sign-in/create-account page for the whole app. Hard paywall —
// "you want access, you pay" — so "create account" always ends at
// Stripe Checkout for a chosen plan, never at a free dashboard.
// "sign in" is for a returning user: if their subscription is active
// they land on /dashboard, if not they land on /billing to pick one.
//
// Arrives here two ways:
//   /auth                 - nav "Sign in", defaults to the sign-in tab
//   /auth?plan=starter    - a pricing-page plan button, defaults to the
//                           create-account tab with that plan selected
const PLAN_COPY: Record<PlanKey, { name: string; price: string }> = {
  starter: { name: "Starter", price: "$39/mo" },
  pro: { name: "Pro", price: "$99/mo" },
};

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-paper text-muted">
          Loading...
        </div>
      }
    >
      <AuthInner />
    </Suspense>
  );
}

function AuthInner() {
  const { user, loading: authLoading, signIn, signUpWithEmail, signInWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const initialPlan: PlanKey = planParam === "pro" ? "pro" : "starter";

  const [mode, setMode] = useState<"signup" | "signin">(planParam ? "signup" : "signin");
  const [plan, setPlan] = useState<PlanKey>(initialPlan);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  // Already signed in and lands here anyway (bookmark, back button) —
  // route the same way a fresh sign-in would, instead of showing the form.
  useEffect(() => {
    if (authLoading || !user) return;
    getSubscription(user.uid).then((sub) => {
      router.replace(isActive(sub) ? "/dashboard" : "/billing");
    });
  }, [authLoading, user, router]);

  async function afterSignUp(uid: string, userEmail: string | null) {
    if (!userEmail) {
      setError("That account has no email address to bill — try a different sign-in method.");
      return;
    }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, email: userEmail, plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
    window.location.href = data.url;
  }

  async function afterSignIn(uid: string) {
    const sub = await getSubscription(uid);
    router.push(isActive(sub) ? "/dashboard" : "/billing");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("email");
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        // onAuthStateChanged hasn't necessarily fired with the new user
        // yet, but createUserWithEmailAndPassword's own resolved result
        // isn't threaded here — read auth.currentUser indirectly via a
        // fresh signIn is unnecessary; Firebase sets it synchronously
        // with the promise resolving, so `auth.currentUser` is already
        // this user by the time we get here.
        const { auth } = await import("@/lib/firebase/client");
        const uid = auth.currentUser?.uid;
        const userEmail = auth.currentUser?.email ?? email;
        if (!uid) throw new Error("Account created, but sign-in didn't complete. Try signing in.");
        await afterSignUp(uid, userEmail);
      } else {
        await signInWithEmail(email, password);
        const { auth } = await import("@/lib/firebase/client");
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Sign-in didn't complete. Try again.");
        await afterSignIn(uid);
      }
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setPending(null);
    }
  }

  async function handleGoogle() {
    setError(null);
    setPending("google");
    try {
      await signIn();
      const { auth } = await import("@/lib/firebase/client");
      const uid = auth.currentUser?.uid;
      const userEmail = auth.currentUser?.email ?? null;
      if (!uid) throw new Error("Sign-in didn't complete. Try again.");
      if (mode === "signup") {
        await afterSignUp(uid, userEmail);
      } else {
        await afterSignIn(uid);
      }
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-slate font-body flex flex-col">
      <div className="px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-display font-extrabold text-base tracking-tight">CAMPEOS</span>
        </Link>
      </div>

      <div className="flex-grow flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[420px] flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[26px] font-extrabold tracking-tight">
              {mode === "signup" ? "Create your account" : "Sign in"}
            </h1>
            <p className="text-sm text-muted">
              {mode === "signup"
                ? "Pick a plan, create your account, and you're straight into the builder."
                : "Welcome back."}
            </p>
          </div>

          {mode === "signup" && (
            <div className="flex gap-2.5" role="radiogroup" aria-label="Plan">
              {(Object.keys(PLAN_COPY) as PlanKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={plan === key}
                  onClick={() => setPlan(key)}
                  className={`flex-1 text-left rounded-2xl border px-4 py-3.5 transition-colors ${
                    plan === key ? "border-clay bg-agentWash" : "border-line bg-paper"
                  }`}
                >
                  <div className="text-sm font-bold">{PLAN_COPY[key].name}</div>
                  <div className="font-mono text-xs text-muted">{PLAN_COPY[key].price}</div>
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm leading-snug">{error}</div>
          )}

          <button
            onClick={handleGoogle}
            disabled={pending !== null}
            className="w-full flex items-center justify-center gap-2.5 min-h-12 rounded-xl border border-line bg-paper text-sm font-semibold disabled:opacity-50"
          >
            <GoogleIcon />
            {pending === "google" ? "Working..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-grow bg-line" />
            <span className="font-mono text-[11px] text-faint">OR</span>
            <div className="h-px flex-grow bg-line" />
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 px-3.5 rounded-xl border border-line bg-paper text-sm focus-visible:outline-clay"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 px-3.5 rounded-xl border border-line bg-paper text-sm focus-visible:outline-clay"
              />
            </label>
            <button
              type="submit"
              disabled={pending !== null}
              className="mt-1 min-h-12 rounded-xl bg-gradient-to-r from-clay to-pink text-white text-sm font-bold disabled:opacity-50"
            >
              {pending === "email"
                ? "Working..."
                : mode === "signup"
                ? `Continue to checkout — ${PLAN_COPY[plan].price}`
                : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-muted">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="font-semibold text-slate"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="font-semibold text-slate"
                >
                  Pick a plan
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// Firebase's raw "Firebase: Error (auth/weak-password)." messages aren't
// something to show someone mid-signup.
function friendlyAuthError(message: string): string {
  if (message.includes("auth/email-already-in-use")) return "That email already has an account. Try signing in instead.";
  if (message.includes("auth/weak-password")) return "Use at least 6 characters for your password.";
  if (message.includes("auth/invalid-email")) return "That doesn't look like a valid email address.";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) return "Wrong email or password.";
  if (message.includes("auth/user-not-found")) return "No account with that email. Try creating one instead.";
  if (message.includes("auth/popup-closed-by-user")) return "Sign-in was closed before it finished.";
  if (message.includes("auth/operation-not-allowed")) return "Email/password sign-in isn't turned on yet — use Google for now.";
  return message.replace(/^Firebase:\s*/, "");
}

function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="authLogoGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="16" stroke="url(#authLogoGrad)" strokeWidth="5" />
      <circle cx="28" cy="13" r="4.5" fill="#EC4899" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c2.8 0 5.3 1 7.3 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5c-7.5 0-13.9 4.3-17.1 10.5z" />
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.6 26.7 35.5 24 35.5c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.1 16.3 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.9 36.5 43.5 30.9 43.5 24c0-1.2-.1-2.4-.3-3.5z" />
    </svg>
  );
}
