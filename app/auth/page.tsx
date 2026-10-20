"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";
import "@/components/onboarding/onboarding.css";

// The one sign-in / create-account page (approved "Sign in to Campeos"
// design: form on the left, an example email on the right). Soft gate:
// create an account, answer five onboarding questions, land in the first
// campaign. Payment happens later, from the dashboard, never here.
//
// Arrives here from the sales page:
//   /auth               "Sign in"
//   /auth?signup        "Get started"
//   /auth?plan=starter  a pricing-card button (also pro). The plan is
//                       remembered in localStorage ("campeos.planIntent")
//                       so the dashboard can open on that plan later.
//
// Email sign-in is email + password (Firebase's Email/Password provider).
// One email box first, then the password box appears, the same feel as
// "email me a code" without needing the Email Link provider turned on.
export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <AuthInner />
    </Suspense>
  );
}

const PLAN_KEY = "campeos.planIntent";

function AuthInner() {
  const { user, loading: authLoading, signIn, signUpWithEmail, signInWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const wantsSignup = searchParams.has("signup") || !!plan;

  const [mode, setMode] = useState<"signup" | "signin">(wantsSignup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (plan === "starter" || plan === "pro") {
      try {
        localStorage.setItem(PLAN_KEY, plan);
      } catch {
        // Private mode etc. Only a convenience.
      }
    }
  }, [plan]);

  // Signed in (just now, or already): profile means onboarding is done.
  useEffect(() => {
    if (authLoading || !user) return;
    getBusinessProfile(user.uid)
      .then((profile) => router.replace(profile ? "/dashboard" : "/onboarding"))
      .catch(() => router.replace("/onboarding"));
  }, [authLoading, user, router]);

  useEffect(() => {
    if (showPassword) passwordRef.current?.focus();
  }, [showPassword]);

  async function handleGoogle() {
    setError(null);
    setPending("google");
    try {
      await signIn();
      // The effect above routes once `user` updates.
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setPending(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!showPassword) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError("That doesn't look like a valid email address.");
        return;
      }
      setShowPassword(true);
      return;
    }
    setPending("email");
    try {
      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setPending(null);
    }
  }

  if (authLoading || user) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="cob-root">
      <div className="cob-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
        <img src="/logo-lockup.png" alt="Campeos" style={{ height: 26, width: "auto", alignSelf: "flex-start" }} />
        <div className="cob-center" style={{ padding: "48px 0" }}>
          <div style={{ width: "100%", maxWidth: 420 }}>
            <h1 className="cob-h1" style={{ fontSize: 52, lineHeight: 1.02 }}>
              Sign in to Campeos
            </h1>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={pending !== null}
              style={{
                marginTop: 36,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                minHeight: 54,
                borderRadius: 12,
                border: "1px solid #E3E1E8",
                background: "#FFFFFF",
                color: "#17131F",
                font: "inherit",
                fontSize: 17,
                fontWeight: 600,
                cursor: "pointer",
                opacity: pending === "email" ? 0.5 : 1,
              }}
            >
              {pending === "google" ? (
                <Spinner />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- local /public asset
                <img src="/brand/google.png" alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
              )}
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "24px 0", color: "#6B6577", fontSize: 14 }}>
              <span style={{ flex: 1, height: 1, background: "#ECEAF0" }} />
              or
              <span style={{ flex: 1, height: 1, background: "#ECEAF0" }} />
            </div>

            <form onSubmit={handleEmailSubmit}>
              <label htmlFor="email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="Email"
                className="cob-field"
                style={{ minHeight: 54, fontSize: 17 }}
              />

              {showPassword && (
                <div className="cob-rise">
                  <label htmlFor="password" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    Password
                  </label>
                  <input
                    ref={passwordRef}
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder={mode === "signup" ? "Make a password (6+ characters)" : "Password"}
                    className="cob-field"
                    style={{ minHeight: 54, fontSize: 17, marginTop: 10 }}
                  />
                </div>
              )}

              {error && (
                <div role="alert" className="cob-rise" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#7C2D12", fontSize: 15, lineHeight: 1.45 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="cob-btn"
                disabled={pending !== null || (showPassword && password.length === 0)}
                style={{ marginTop: 14, width: "100%", minHeight: 54, fontSize: 17 }}
              >
                {pending === "email" && <Spinner light />}
                {!showPassword ? "Continue with email" : mode === "signup" ? "Create my account" : "Sign in"}
                {pending !== "email" && <Arrow />}
              </button>
            </form>

            <p style={{ fontSize: 15, color: "#6B6577", margin: "18px 0 0" }}>
              {mode === "signup" ? "Already have an account? " : "New to Campeos? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                }}
                style={{ border: 0, background: "none", padding: 0, font: "inherit", color: "#17131F", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" }}
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>

            <p style={{ fontSize: 13, lineHeight: 1.5, color: "#6B6577", margin: "20px 0 0" }}>
              By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>

      <div className="cob-right" style={{ padding: "64px 0 0 64px" }}>
        <h2 style={{ fontFamily: "Newsreader, serif", fontWeight: 500, fontSize: 44, letterSpacing: "-.03em", lineHeight: 1.06, margin: 0, maxWidth: 520, paddingRight: 40 }}>
          Run a <span style={{ fontStyle: "italic" }}>sold-out</span> launch, without the blank page.
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "#5B5566", margin: "16px 0 0", maxWidth: 520, paddingRight: 40 }}>
          Tell Campeos about your offer. It writes every email, text, ad and post, and plans when each one goes out.
        </p>

        <div className="cob-rise" style={{ animationDelay: ".3s", margin: "48px 56px 0 0", maxWidth: 500, background: "#FFFFFF", border: "1px solid #ECEAF0", borderRadius: 20, boxShadow: "0 40px 80px -44px rgba(23,19,31,.35)", padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid #F0EEF4" }}>
            <Avatar initials="SK" size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Sarah Kim</div>
              <div style={{ fontSize: 13, color: "#6B6577" }}>To: your customers</div>
            </div>
            <span style={{ fontSize: 13, color: "#6B6577" }}>9:00 AM</span>
          </div>
          <div style={{ fontFamily: "Newsreader, serif", fontWeight: 500, fontSize: 30, letterSpacing: "-.025em", lineHeight: 1.12, marginTop: 18 }}>
            Your summer glow starts Monday
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3D3747", margin: "12px 0 0" }}>
            Hey there, our 4-week skin plan opens Monday. Easy steps, real results, and 20% off for the first 50 people.
          </p>
          <span style={{ display: "inline-flex", alignItems: "center", marginTop: 16, padding: "10px 16px", borderRadius: 10, background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>
            Save my spot
          </span>
        </div>

        <div className="cob-rise" style={{ animationDelay: "1.1s", marginTop: 18, display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 16px 12px 12px", borderRadius: 16, background: "#FFFFFF", border: "1px solid #ECEAF0", boxShadow: "0 20px 40px -24px rgba(23,19,31,.35)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)", color: "#FFFFFF" }}>
            <Check size={15} />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Written for you in about a minute</div>
            <div style={{ fontSize: 13, color: "#6B6577" }}>Plus the texts and posts to go with it</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes("auth/email-already-in-use")) return "That email already has an account. Tap \"Sign in\" below.";
  if (message.includes("auth/weak-password")) return "Use at least 6 characters for your password.";
  if (message.includes("auth/invalid-email")) return "That doesn't look like a valid email address.";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password"))
    return "Wrong email or password. New here? Tap \"Create an account\" below.";
  if (message.includes("auth/user-not-found")) return "No account with that email. Tap \"Create an account\" below.";
  if (message.includes("auth/popup-closed-by-user")) return "Sign-in was closed before it finished.";
  if (message.includes("auth/too-many-requests")) return "Too many tries. Wait a minute and try again.";
  if (message.includes("auth/operation-not-allowed")) return "Email sign-in isn't turned on yet. Use Google for now.";
  return message.replace(/^Firebase:\s*/, "");
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)", color: "#FFFFFF", fontSize: Math.round(size * 0.34), fontWeight: 700 }}>
      {initials}
    </span>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function Spinner({ light }: { light?: boolean }) {
  return (
    <svg className="cob-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={light ? "#FFFFFF" : "#9B1FD6"} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}
