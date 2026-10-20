"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { usePlanSuggestion } from "@/components/PlanModal";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getSubscription, Subscription } from "@/lib/firebase/subscription";
import { PlanKey } from "@/lib/stripe/client";
import { authFetch } from "@/lib/firebase/authFetch";

// Billing, laid out like MailCheap's: one big card. The left side picks
// the plan (what changes between them, shown big), the right side shows
// the price, what's included, and one Subscribe button. Feature lists
// match the pricing on the sales page (components/landing).

const PLANS: Record<
  PlanKey,
  {
    name: string;
    price: string;
    tagline: string;
    big: string;
    bigLabel: string;
    detail: string;
    includes: string[];
  }
> = {
  starter: {
    name: "Starter",
    price: "$39",
    tagline: "A few launches a year",
    big: "3",
    bigLabel: "campaigns a month",
    detail: "2 saved offers · 1 person",
    includes: [
      "Email, SMS, ads and posts",
      "We scan your website",
      "2 saved offers",
      "1 person",
      "Save up to 20 winners",
      "3 sales calls a month",
      "Every campaign type we add",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price: "$99",
    tagline: "Launch all year",
    big: "Unlimited",
    bigLabel: "campaigns",
    detail: "Unlimited offers · your team, up to 5 people",
    includes: [
      "Email, SMS, ads and posts",
      "We scan your website",
      "Unlimited offers",
      "Your team, up to 5 people",
      "Unlimited winners",
      "Unlimited sales calls",
      "New campaign types first",
      "Priority support",
      "Ajay reviews your first launch",
    ],
  },
};

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const { plan: fit, reason } = usePlanSuggestion();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [picked, setPicked] = useState<PlanKey | null>(null);
  const [pending, setPending] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSub(null);
      return;
    }
    getSubscription(user.uid).then(setSub).catch(() => {});
  }, [user]);

  const activePlan = sub?.status === "active" ? sub.plan : null;
  const selected: PlanKey = picked ?? activePlan ?? fit;
  const plan = PLANS[selected];

  async function subscribe() {
    if (!user) {
      setError("Sign in first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await authFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout didn't open.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout didn't open. Try again.");
      setPending(false);
    }
  }

  async function openPortal() {
    if (!user) return;
    setError(null);
    setPortalPending(true);
    try {
      const res = await authFetch("/api/stripe/portal", { method: "POST", body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open billing.");
      setPortalPending(false);
    }
  }

  const isCurrent = activePlan === selected;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-paper text-slate font-body">
      <Sidebar active={null} />

      <main className="flex-grow min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-14 flex flex-col items-center gap-8 pb-28 md:pb-14">
        <div className="text-center max-w-[560px]">
          <h1 className="font-display text-[34px] sm:text-[44px] font-bold tracking-tight leading-tight">
            {activePlan ? "Your plan" : "Pick a plan"}
          </h1>
          <p className="mt-2 text-[16px] text-muted leading-relaxed">
            {activePlan
              ? `You're on ${PLANS[activePlan].name}. Change or cancel anytime.`
              : "Both plans write every email, text, ad and post. They differ in how many campaigns you run."}
          </p>
        </div>

        {!authLoading && !user && (
          <div className="bg-paper border border-line rounded-2xl px-5 py-4 text-sm text-muted">
            Sign in to pick a plan.
          </div>
        )}

        <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] rounded-[28px] border border-line overflow-hidden shadow-[0_30px_60px_-50px_rgba(23,19,31,.4)]">
          {/* Left: pick the plan */}
          <div className="bg-paper p-6 sm:p-10 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold">How often do you launch?</span>
              {reason && !activePlan && (
                <span className="hidden sm:inline text-xs text-muted text-right max-w-[220px]">{reason}</span>
              )}
            </div>

            <div key={selected} className="mt-8 animate-step-in">
              <div className="font-display text-[64px] sm:text-[84px] font-bold leading-none tracking-tight">
                {plan.big}
              </div>
              <div className="mt-2 text-[16px] text-muted">
                <b className="text-slate font-semibold">{plan.bigLabel}</b> · {plan.detail}
              </div>
            </div>

            <div className="mt-10 lg:mt-auto pt-2 grid grid-cols-2 gap-3">
              {(["starter", "pro"] as PlanKey[]).map((id) => {
                const on = id === selected;
                return (
                  <button
                    key={id}
                    onClick={() => setPicked(id)}
                    aria-pressed={on}
                    className={`relative text-left rounded-2xl px-4 py-4 transition-colors duration-200 ${
                      on ? "bg-slate text-white" : "bg-[#F5F5F5] text-slate hover:bg-[#EEEEEE]"
                    }`}
                  >
                    {id === fit && !activePlan && (
                      <span
                        className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
                        style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                      >
                        Fits you
                      </span>
                    )}
                    {activePlan === id && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-lime text-white text-[11px] font-bold">
                        Current
                      </span>
                    )}
                    <div className="text-[15px] font-semibold">{PLANS[id].tagline}</div>
                    <div className={`text-[13px] mt-0.5 ${on ? "text-white/70" : "text-muted"}`}>
                      {PLANS[id].name} · {PLANS[id].price}/mo
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: price, what's in it, one button */}
          <div className="bg-[#F8F8F8] border-t lg:border-t-0 lg:border-l border-line p-6 sm:p-10 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] text-muted">{plan.name}</span>
              <span className="px-2.5 py-1 rounded-full bg-[#EDEDED] text-xs text-muted font-medium">
                Founding price
              </span>
            </div>
            <div key={selected} className="mt-3 flex items-baseline gap-1.5 animate-step-in">
              <span className="font-display text-[56px] font-bold tracking-tight leading-none">{plan.price}</span>
              <span className="text-[17px] text-muted">/month</span>
            </div>
            <div className="mt-1.5 text-[14px] text-muted">Billed monthly</div>

            <div className="mt-6 pt-6 border-t border-line lg:min-h-[250px]">
              <div className="text-[13px] text-muted mb-3">{plan.name} includes</div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {plan.includes.map((line) => (
                  <li key={line} className="flex gap-2.5 text-[14.5px]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-[3px] text-slate">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 lg:mt-auto pt-2 flex flex-col gap-3">
              {error && <div className="px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm">{error}</div>}
              {activePlan ? (
                isCurrent ? (
                  <button
                    onClick={openPortal}
                    disabled={portalPending}
                    className="h-14 rounded-xl border-[1.5px] border-slate text-slate text-[16px] font-semibold disabled:opacity-60"
                  >
                    {portalPending ? "Opening..." : "Manage billing"}
                  </button>
                ) : (
                  <button
                    onClick={openPortal}
                    disabled={portalPending}
                    className="h-14 rounded-xl bg-slate text-white text-[16px] font-semibold disabled:opacity-60"
                  >
                    {portalPending ? "Opening..." : `Switch to ${plan.name}`}
                  </button>
                )
              ) : (
                <button
                  onClick={subscribe}
                  disabled={!user || pending}
                  className="h-14 rounded-xl bg-slate text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {pending ? "Opening checkout..." : "Subscribe"}
                  {!pending && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              )}
              <p className="text-center text-[13px] text-muted">
                The first 100 members keep this price for life. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
