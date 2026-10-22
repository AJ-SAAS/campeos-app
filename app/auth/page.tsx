"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";
import { LoadingScreen } from "@/components/LoadingScreen";
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
// Email sign-in is "email me a code": type your email, get a 6-digit code,
// type it here. It all happens on this page (no pop-up). Same flow for new
// and returning people. Older accounts can still use "Use a password
// instead". The code is sent by /api/auth/send-code and checked by
// /api/auth/verify-code (lib/emailCode.ts).
export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <AuthInner />
    </Suspense>
  );
}

const PLAN_KEY = "campeos.planIntent";

function AuthInner() {
  const { user, loading: authLoading, signIn, sendEmailCode, verifyEmailCode, signInWithEmail, needsVerification, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const wantsSignup = searchParams.has("signup") || !!plan;

  const [mode, setMode] = useState<"signup" | "signin">(wantsSignup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "code" | "resend" | "google" | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const handedOff = useRef(false);

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
    if (authLoading || !user || needsVerification) return;
    getBusinessProfile(user.uid)
      .then((profile) => router.replace(profile ? "/dashboard" : "/onboarding"))
      .catch(() => router.replace("/onboarding"));
  }, [authLoading, user, needsVerification, router]);

  useEffect(() => {
    if (usePassword) passwordRef.current?.focus();
  }, [usePassword]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // An older account made with a password that never confirmed its email:
  // sign it out here and finish with a code, right on this page.
  useEffect(() => {
    if (!user || !needsVerification || handedOff.current) return;
    handedOff.current = true;
    const addr = user.email ?? "";
    signOut()
      .then(() => {
        setEmail(addr);
        setUsePassword(false);
        setPassword("");
        return askForCode(addr);
      })
      .catch(() => setPending(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, needsVerification]);

  async function handleGoogle() {
    setError(null);
    setPending("google");
    try {
      await signIn();
      // The effect above routes once `user` updates.
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function askForCode(addr: string, resend = false) {
    setError(null);
    setInfo(null);
    setPending(resend ? "resend" : "email");
    try {
      const wait = await sendEmailCode(addr);
      setCooldown(wait);
      setCode("");
      setStep("code");
      if (resend) setInfo("New code sent.");
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  async function submitCode(value: string) {
    if (pending) return;
    setError(null);
    setPending("code");
    try {
      await verifyEmailCode(email.trim(), value);
      // The effect above routes once `user` updates.
    } catch (err) {
      setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      setCode("");
      codeRef.current?.focus();
    } finally {
      setPending(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) {
      setError("That doesn't look like a valid email address.");
      return;
    }
    if (usePassword) {
      setPending("email");
      try {
        await signInWithEmail(addr, password);
      } catch (err) {
        setError(err instanceof Error ? friendlyAuthError(err.message) : "Something went wrong.");
      } finally {
        setPending(null);
      }
      return;
    }
    await askForCode(addr);
  }

  function useAnotherEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setInfo(null);
    setPending(null);
    setTimeout(() => document.getElementById("email")?.focus(), 0);
  }

  if (authLoading || (user && !needsVerification)) return <LoadingScreen />;
  if (user && needsVerification) return <LoadingScreen />;

  return (
    <div className="cob-root">
      <div className="cob-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
        <img src="/logo-lockup.png" alt="Campeos" style={{ height: 26, width: "auto", alignSelf: "flex-start" }} />
        <div className="cob-center" style={{ padding: "48px 0" }}>
          <div style={{ width: "100%", maxWidth: 420 }}>
            <h1 className="cob-h1" style={{ fontSize: 52, lineHeight: 1.02 }}>
              {mode === "signup" ? "Start your first launch" : "Welcome back"}
            </h1>
            <p className="cob-sub" style={{ marginTop: 14 }}>
              {mode === "signup"
                ? "It's free to start. You'll see your first 3 messages written before you pay anything."
                : "Pick up right where your launch left off."}
            </p>

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

            {step === "email" ? (
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

                {usePassword && (
                  <div className="cob-rise">
                    <label htmlFor="password" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                      Password
                    </label>
                    <input
                      ref={passwordRef}
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Password"
                      className="cob-field"
                      style={{ minHeight: 54, fontSize: 17, marginTop: 10 }}
                    />
                  </div>
                )}

                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="submit"
                  className="cob-btn"
                  disabled={pending !== null || (usePassword && password.length === 0)}
                  style={{ marginTop: 14, width: "100%", minHeight: 54, fontSize: 17 }}
                >
                  {pending === "email" && <Spinner light />}
                  {usePassword ? "Sign in" : "Email me a code"}
                  {pending !== "email" && <Arrow />}
                </button>

                {mode === "signin" && (
                  <p style={{ fontSize: 14, color: "#6B6577", margin: "14px 0 0" }}>
                    <button type="button" onClick={() => { setUsePassword(!usePassword); setError(null); }} style={linkBtn}>
                      {usePassword ? "Email me a code instead" : "Use a password instead"}
                    </button>
                  </p>
                )}
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.length === 6) submitCode(code);
                }}
              >
                <p className="cob-rise" style={{ fontSize: 16, color: "#6B6577", margin: "0 0 10px", lineHeight: 1.5 }}>
                  Enter the code sent to <b style={{ color: "#17131F", wordBreak: "break-all" }}>{email.trim()}</b>
                </p>
                <label htmlFor="code" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  6-digit code
                </label>
                <input
                  ref={codeRef}
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={7}
                  value={code}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(digits);
                    setError(null);
                    if (digits.length === 6) submitCode(digits);
                  }}
                  placeholder="000000"
                  className="cob-field"
                  style={{ minHeight: 54, fontSize: 24, textAlign: "center", letterSpacing: "0.45em", paddingLeft: "0.45em", fontVariantNumeric: "tabular-nums" }}
                />

                {info && !error && <p role="status" style={{ margin: "12px 0 0", fontSize: 14, color: "#166534" }}>{info}</p>}
                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="submit"
                  className="cob-btn"
                  disabled={pending !== null || code.length !== 6}
                  style={{ marginTop: 14, width: "100%", minHeight: 54, fontSize: 17 }}
                >
                  {pending === "code" && <Spinner light />}
                  {mode === "signup" ? "Create my account" : "Sign in"}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14, fontSize: 15 }}>
                  <button type="button" onClick={useAnotherEmail} style={{ ...linkBtn, fontWeight: 500, textDecoration: "none", color: "#6B6577" }}>
                    Use another email
                  </button>
                  <button
                    type="button"
                    onClick={() => askForCode(email.trim(), true)}
                    disabled={cooldown > 0 || pending !== null}
                    style={{ ...linkBtn, fontWeight: 500, textDecoration: "none", color: "#6B6577", opacity: cooldown > 0 ? 0.6 : 1, cursor: cooldown > 0 ? "default" : "pointer" }}
                  >
                    {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
                  </button>
                </div>
                <p style={{ fontSize: 13, color: "#6B6577", margin: "14px 0 0", lineHeight: 1.5 }}>Can&apos;t see it? Check spam or promotions.</p>
              </form>
            )}

            {mode === "signup" && (
              <p style={{ fontSize: 14, color: "#6B6577", margin: "12px 0 0" }}>No card needed. Setup takes about a minute.</p>
            )}

            <p style={{ fontSize: 15, color: "#6B6577", margin: "18px 0 0" }}>
              {mode === "signup" ? "Already have an account? " : "New to Campeos? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                  setUsePassword(false);
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
          Your whole launch, <span style={{ fontStyle: "italic" }}>written</span> for you.
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "#5B5566", margin: "16px 0 0", maxWidth: 520, paddingRight: 40 }}>
          Tell Campeos what you sell. It writes the emails, texts, ads and posts, and picks the best time to send each one.
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

const linkBtn: React.CSSProperties = { border: 0, background: "none", padding: 0, font: "inherit", color: "#17131F", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" };

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="cob-rise" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#7C2D12", fontSize: 15, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes("auth/disposable-email")) return "Use your real email so we can send you a code. Temporary inboxes don't work.";
  if (message.includes("auth/email-already-in-use")) return "That email already has an account. Tap \"Sign in\" below.";
  if (message.includes("auth/weak-password")) return "Use at least 6 characters for your password.";
  if (message.includes("auth/invalid-email")) return "That doesn't look like a valid email address.";
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password"))
    return "Wrong email or password. Or tap \"Email me a code instead\".";
  if (message.includes("auth/user-not-found")) return "No password account with that email. Tap \"Email me a code instead\".";
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
