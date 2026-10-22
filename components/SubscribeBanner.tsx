"use client";

import { useState } from "react";
import { PlanModal, usePlanSuggestion } from "@/components/PlanModal";

// The thin black banner across the top of signed-in pages for accounts
// with no plan yet. Not a block, just a reminder, and it opens the plan
// picker right here. The real paywall is server-side in
// /api/generate-step (see lib/access.ts).
//
// Says Starter by default. If their onboarding answer means Starter
// won't be enough (they launch every month, every week, or for clients),
// it names Pro instead, so the banner never suggests a plan they'd
// outgrow in a month.
export function SubscribeBanner() {
  const { plan, reason } = usePlanSuggestion();
  const [open, setOpen] = useState(false);
  const fit =
    plan === "pro" && reason
      ? "Pro fits how you launch, at $99/mo"
      : "Starter fits most launches, at $39/mo";

  return (
    <>
      <div className="bg-slate text-white px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-[13px]">
        <span>
          You're on the free preview. Your first 3 posts are on us
          <span className="opacity-70">&nbsp;&nbsp;·&nbsp;&nbsp;{fit}</span>
        </span>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white text-black text-xs font-bold hover:bg-[#F2F2F2]"
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
