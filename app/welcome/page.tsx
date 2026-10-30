"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { authFetch } from "@/lib/firebase/authFetch";
import { getSubscription, isActive } from "@/lib/firebase/subscription";
import { canTrack, trackPurchase } from "@/lib/meta/browser";

// Where Stripe sends people after they pay. It does three things:
//  1. asks the server to confirm the payment is real and theirs,
//  2. sends the browser copy of the one Purchase (same id as the server copy,
//     so Meta counts one sale), once, and only if they allow tracking,
//  3. waits for the Stripe webhook to switch their account on, then goes
//     to the dashboard.
// Whether they get access never depends on any of the tracking.

type Phase = "checking" | "confirmed" | "unconfirmed";

function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const [phase, setPhase] = useState<Phase>("checking");
  const [unlocked, setUnlocked] = useState(false);
  const [slow, setSlow] = useState(false);
  const started = useRef(false);

  // 1 + 2: confirm, then report.
  useEffect(() => {
    if (!ready || !user || started.current) return;
    started.current = true;
    if (!sessionId) {
      setPhase("unconfirmed");
      return;
    }
    (async () => {
      try {
        const res = await authFetch("/api/stripe/verify-session", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok || !data.paid) {
          setPhase("unconfirmed");
          return;
        }
        setPhase("confirmed");
        if (data.countable && canTrack()) {
          const key = `campeos:purchase-fired:${data.eventId}`;
          let already = false;
          try {
            already = localStorage.getItem(key) === "1";
          } catch {
            /* ignore */
          }
          if (!already) {
            trackPurchase({ eventId: data.eventId, value: data.value, currency: data.currency });
            try {
              localStorage.setItem(key, "1");
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        setPhase("unconfirmed");
      }
    })();
  }, [ready, user, sessionId]);

  // 3: wait for the webhook to unlock the account.
  useEffect(() => {
    if (phase !== "confirmed" || !user) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries++;
      try {
        const sub = await getSubscription(user.uid);
        if (cancelled) return;
        if (isActive(sub)) {
          setUnlocked(true);
          return;
        }
      } catch {
        /* try again */
      }
      if (tries >= 12) {
        if (!cancelled) setSlow(true);
        return;
      }
      setTimeout(tick, 1500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [phase, user]);

  useEffect(() => {
    if (!unlocked) return;
    const t = setTimeout(() => router.replace("/dashboard"), 1400);
    return () => clearTimeout(t);
  }, [unlocked, router]);

  if (!ready) return <LoadingScreen />;

  const gradient = "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)";

  return (
    <div className="min-h-screen bg-paper text-slate font-body grid place-items-center px-6">
      <div className="w-full max-w-[520px] flex flex-col items-center text-center gap-5">
        {phase === "unconfirmed" ? (
          <>
            <h1 className="font-serif text-[36px] leading-tight font-medium tracking-tight">We couldn&apos;t confirm that payment</h1>
            <p className="text-[16px] text-muted">
              If you were charged, your account will unlock on its own in a minute. Check your plan on the billing page.
            </p>
            <Link href="/billing" className="inline-flex items-center h-11 px-6 rounded-full text-white text-sm font-semibold" style={{ background: gradient }}>
              Go to billing
            </Link>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full grid place-items-center text-white shadow-[0_14px_34px_-10px_rgba(155,31,214,.6)]" style={{ background: gradient }}>
              {unlocked ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              ) : (
                <span className="w-6 h-6 rounded-full border-[3px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
              )}
            </div>
            <h1 className="font-serif text-[40px] leading-tight font-medium tracking-tight">You&apos;re in. Welcome to Campeos.</h1>
            <p className="text-[16px] text-muted max-w-[44ch]">
              {phase === "checking"
                ? "Confirming your payment..."
                : unlocked
                ? "Your account is unlocked. Taking you to your dashboard."
                : slow
                ? "Your payment is confirmed. Your account is still switching on."
                : "Payment confirmed. Unlocking your account..."}
            </p>
            {(unlocked || slow) && (
              <Link href="/dashboard" className="inline-flex items-center h-11 px-6 rounded-full text-white text-sm font-semibold" style={{ background: gradient }}>
                Open my dashboard
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Welcome />
    </Suspense>
  );
}
