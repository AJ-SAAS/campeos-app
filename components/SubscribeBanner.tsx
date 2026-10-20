"use client";

import { useState } from "react";
import { PlanModal, PLAN_PRICE, usePlanSuggestion } from "@/components/PlanModal";

// The thin black banner across the top of signed-in pages for accounts
// with no plan yet. Not a block, just a reminder. It names the plan that
// fits this person (from onboarding) and opens the plan picker right
// here instead of sending them off to another page. The real paywall is
// server-side in /api/generate-step (see lib/access.ts).
export function SubscribeBanner() {
  const { plan } = usePlanSuggestion();
  const [open, setOpen] = useState(false);
  const name = plan === "pro" ? "Pro" : "Starter";

  return (
    <>
      <div className="bg-slate text-white px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[13px]">
        <span>
          <b>Pick a plan to start launching</b>
          <span className="opacity-75"> · {name} fits how you launch, at {PLAN_PRICE[plan]} a month</span>
        </span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white text-slate text-xs font-bold"
        >
          See plans
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <PlanModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
