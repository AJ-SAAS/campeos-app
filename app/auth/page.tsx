"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";

// The one sign-in/create-account page for the whole app. Soft gate,
// mailcheap.ai-style — create an account, answer a few onboarding
// questions, land in the dashboard. Payment happens later, at
// generate-time or from the dashboard's nag banner, not here. So
// "create account" always ends at /onboarding, never at Stripe
// Checkout — there's no plan to pick yet.
//
// Arrives here two ways:
//   /auth          - nav "Sign in", defaults to the sign-in tab
//   /auth?signup   - a landing-page CTA, defaults to the create-account tab
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
  const wantsSignup = searchParams.has("signup");

  const [mode, setMode] = useState<"signup" | "signin">(wantsSignup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  // Already signed in and lands here anyway (bookmark, back button) —
  // route the same way a fresh sign-in would, instead of showing the form.
  // useRequireAccess (run from the destination page) is what actually
  // decides dashboard vs. onboarding; this just gets them off /auth.
  useEffect(() => {
    if (authLoading || !user) return;
    getBusinessProfile(user.uid).then((profile) => {
      router.replace(profile ? "/dashboard" : "/onboarding");
    });
  }, [authLoading, user, router]);

  function afterSignUp() {
    router.push("/onboarding");
  }

  function afterSignIn() {
    router.push("/dashboard");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("email");
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        afterSignUp();
      } else {
        await signInWithEmail(email, password);
        afterSignIn();
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
      if (mode === "signup") {
        afterSignUp();
      } else {
        afterSignIn();
      }
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-slate font-body flex flex-col">
      <div className="px-6 py-5">
        <Link href="/" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" className="h-6 w-auto object-contain" />
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
                ? "Create your account — a few quick questions, then you're in."
                : "Welcome back."}
            </p>
          </div>

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
                ? "Create account"
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
                  Create one
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
