"use client";

import Link from "next/link";

// The mailcheap.ai-style nag banner — shown across the top of every
// signed-in page once onboarding is done but there's no active
// subscription yet. Not a block, just a constant reminder; the real
// enforcement happens at generate-time (see generateCampaign() in
// app/builder/page.tsx and executeCreateCampaign in lib/ai/agentActions.ts).
export function SubscribeBanner() {
  return (
    <div className="bg-slate text-white px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[13px]">
      <span>Pick a plan to start generating campaigns — Starter fits most launches, at $39/mo.</span>
      <Link href="/billing" className="shrink-0 font-semibold underline underline-offset-2">
        See plans &rarr;
      </Link>
    </div>
  );
}
