"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/firebase/authFetch";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";
import { FREQUENCIES, PlanId, suggestedPlan } from "@/lib/onboarding/answers";

// The "Pick your plan" pop-up from the approved dashboard design. Opened
// from the top banner, the dashboard's first-launch card and checklist,
// and the builder's locked steps. Choosing a plan goes straight to Stripe
// Checkout (same /api/stripe/checkout route the Billing page uses).

const PLAN_INFO: Record<PlanId, { name: string; price: string; lines: string[] }> = {
  starter: {
    name: "Starter",
    price: "$39",
    lines: ["3 campaigns a month", "2 offers, 1 person", "Save up to 20 winners"],
  },
  pro: {
    name: "Pro",
    price: "$99",
    lines: ["Unlimited campaigns and offers", "Your team, up to 5 people", "Unlimited winners, priority support"],
  },
};

export const PLAN_PRICE: Record<PlanId, string> = { starter: "$39", pro: "$99" };

/**
 * Which plan fits this person, from their onboarding answer ("How often
 * do you run a sale?"), or the plan they clicked on the sales page if
 * they came in that way. Defaults to Pro, the plan most people need.
 */
export function usePlanSuggestion(): { plan: PlanId; reason: string | null } {
  const { user } = useAuth();
  const [state, setState] = useState<{ plan: PlanId; reason: string | null }>({ plan: "pro", reason: null });

  useEffect(() => {
    if (!user) return;
    let intent: string | null = null;
    try {
      intent = localStorage.getItem("campeos.planIntent");
    } catch {}
    getBusinessProfile(user.uid)
      .then((p) => {
        const freq = FREQUENCIES.find((f) => f.id === p?.frequency);
        if (freq) {
          const plan = suggestedPlan(freq.id);
          const said =
            freq.id === "agency"
              ? "You said you do marketing for clients"
              : `You said you run a sale ${freq.label.toLowerCase()}`;
          setState({ plan, reason: `${said}, so ${PLAN_INFO[plan].name} fits best.` });
        } else if (intent === "starter" || intent === "pro") {
          setState({ plan: intent, reason: null });
        }
      })
      .catch(() => {});
  }, [user]);

  return state;
}

export function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plan: fit, reason } = usePlanSuggestion();
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function choose(plan: PlanId) {
    setError(null);
    setPending(plan);
    try {
      const res = await authFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout didn't open.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout didn't open. Try again.");
      setPending(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(23,19,31,0.45)] animate-step-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick your plan"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] max-h-[92vh] overflow-y-auto bg-paper rounded-3xl p-6 sm:p-8 shadow-[0_40px_80px_-30px_rgba(23,19,31,0.5)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-[32px] leading-tight font-medium tracking-tight">Pick your plan</h2>
            {reason && <p className="mt-1.5 text-[15px] text-muted">{reason}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full border border-line flex items-center justify-center hover:bg-ivory"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {(["starter", "pro"] as PlanId[]).map((id) => {
            const info = PLAN_INFO[id];
            const isFit = id === fit;
            return (
              <div
                key={id}
                className={`relative flex flex-col rounded-2xl p-5 ${
                  isFit ? "border-2 border-transparent" : "border border-line"
                }`}
                style={
                  isFit
                    ? {
                        background:
                          "linear-gradient(#FFFFFF,#FFFFFF) padding-box, linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8) border-box",
                        boxShadow: "0 24px 48px -32px rgba(155,31,214,.6)",
                      }
                    : undefined
                }
              >
                {isFit && (
                  <span
                    className="absolute -top-3 left-5 px-2.5 py-0.5 rounded-full text-white text-xs font-bold"
                    style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                  >
                    Fits how you launch
                  </span>
                )}
                <div className="font-semibold">{info.name}</div>
                <div className="mt-1">
                  <span className="font-serif text-[40px] font-medium tracking-tight">{info.price}</span>
                  <span className="text-muted"> /month</span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted leading-relaxed flex-grow">
                  {info.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <button
                  onClick={() => choose(id)}
                  disabled={pending !== null}
                  className={`mt-4 h-11 rounded-xl text-sm font-bold disabled:opacity-60 ${
                    isFit ? "text-white" : "border-[1.5px] border-slate text-slate"
                  }`}
                  style={isFit ? { background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" } : undefined}
                >
                  {pending === id ? "Opening checkout..." : `Choose ${info.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {error && <div className="mt-4 px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm">{error}</div>}
        <p className="mt-5 text-center text-[13px] text-muted">
          Founding members keep this price for life. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
