"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getSubscription, Subscription } from "@/lib/firebase/subscription";
import { PlanKey, BillingInterval } from "@/lib/stripe/client";

// Two tiers, no free tier, no trial — the billing decision on record.
// Feature differences between Starter and Pro aren't decided yet, so
// this intentionally doesn't invent a feature list per plan; it shows
// price and lets the real content get filled in once that's settled.
// Yearly price matches the sales page's "2 months free" framing — 10
// months' worth of the monthly price, billed once a year.
const PLAN_COPY: Record<
  PlanKey,
  { name: string; price: Record<BillingInterval, string>; blurb: string }
> = {
  starter: {
    name: "Starter",
    price: { monthly: "$39", yearly: "$33" },
    blurb: "For one offer and one campaign at a time.",
  },
  pro: {
    name: "Pro",
    price: { monthly: "$99", yearly: "$83" },
    blurb: "For running campaigns all year round.",
  },
};

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  // Named billingInterval, not interval/setInterval, so it doesn't shadow
  // the global setInterval timer function.
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSub(null);
      return;
    }
    getSubscription(user.uid).then(setSub);
  }, [user]);

  async function subscribe(plan: PlanKey) {
    if (!user) {
      setError("Sign in first.");
      return;
    }
    setError(null);
    setPendingPlan(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, email: user.email, plan, interval: billingInterval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setPendingPlan(null);
    }
  }

  async function openPortal() {
    if (!user) return;
    setError(null);
    setPortalPending(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't open billing.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open billing.");
      setPortalPending(false);
    }
  }

  const activePlan = sub?.status === "active" ? sub.plan : null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-paper text-slate font-body">
      <Sidebar active="dashboard" />

      <main className="flex-grow min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 pb-24 md:pb-10 max-w-3xl">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted">Paid only — no free tier, no trial.</p>
        </div>

        {!authLoading && !user && (
          <div className="bg-paper border border-line rounded-2xl px-5 py-4 text-sm text-muted">
            Sign in to subscribe or manage billing.
          </div>
        )}

        {error && (
          <div className="px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm">{error}</div>
        )}

        {activePlan && (
          <div className="flex items-center justify-between gap-4 bg-ivory border border-line rounded-2xl px-5 py-4">
            <div>
              <div className="text-sm font-semibold">
                You&apos;re on the {PLAN_COPY[activePlan].name} plan
                {sub?.interval ? ` (billed ${sub.interval})` : ""}
              </div>
              <div className="text-xs text-muted">
                {PLAN_COPY[activePlan].price[sub?.interval ?? "monthly"]}/mo
              </div>
            </div>
            <button
              onClick={openPortal}
              disabled={portalPending}
              className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-[10px] border border-line bg-paper text-sm font-semibold disabled:opacity-50"
            >
              {portalPending ? "Opening..." : "Manage billing"}
            </button>
          </div>
        )}

        <div className="inline-flex items-center gap-1 self-start rounded-full bg-ivory p-1">
          <button
            onClick={() => setBillingInterval("monthly")}
            className={`h-9 px-4 rounded-full text-sm font-semibold transition ${
              billingInterval === "monthly" ? "bg-paper shadow-sm" : "text-muted"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval("yearly")}
            className={`h-9 px-4 rounded-full text-sm font-semibold transition ${
              billingInterval === "yearly" ? "bg-paper shadow-sm" : "text-muted"
            }`}
          >
            Yearly <span className="text-emerald-700">2 months free</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(PLAN_COPY) as PlanKey[]).map((key) => {
            const plan = PLAN_COPY[key];
            const isCurrent = activePlan === key && (sub?.interval ?? "monthly") === billingInterval;
            return (
              <div
                key={key}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6"
              >
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-muted">{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-[32px] font-semibold tracking-tight">
                      {plan.price[billingInterval]}
                    </span>
                    <span className="text-sm text-muted">/mo</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <div className="text-xs text-emerald-700 font-medium">Billed yearly. 2 months free.</div>
                  )}
                  <div className="text-sm text-muted">{plan.blurb}</div>
                </div>
                <button
                  onClick={() => subscribe(key)}
                  disabled={!user || pendingPlan === key || isCurrent}
                  className={`mt-auto flex items-center justify-center gap-2 min-h-12 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                    isCurrent
                      ? "bg-ivory text-muted border border-line"
                      : "bg-gradient-to-r from-clay to-pink text-white"
                  }`}
                >
                  {isCurrent ? "Current plan" : pendingPlan === key ? "Redirecting..." : `Subscribe to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
