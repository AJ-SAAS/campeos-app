"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { Campaign, deleteCampaign, listCampaigns } from "@/lib/firebase/campaigns";

// "Dashboard: in the works" — from Main.dc.html, redesigned around the
// agent as the primary surface (the chat-first "Helena-style" flow) with
// the campaign list and templates as the secondary, "here's what it
// built" proof layer. The campaign list is real (Firestore for the
// signed-in user). The "going out next" schedule panel from the mockup
// is still mock data — that needs the per-step scheduling view built
// out, a later step. The full set of campaign templates — webinar, flash
// sale, and the rest — now lives at /campaigns (see
// lib/templates/catalog.ts); this page just links out to it rather than
// duplicating the pill row that used to be here.

export default function Dashboard() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  // Tracks which campaign's delete is in flight, so that row's button
  // can show a spinner/disabled state without blocking the rest of the
  // list — a user could plausibly delete two old drafts back to back.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCampaigns(null);
      return;
    }
    listCampaigns(user.uid).then(setCampaigns);
  }, [user]);

  async function handleDelete(campaign: Campaign) {
    // Permanent and can't be undone — confirm before it fires. A native
    // confirm() is plain but unambiguous for a destructive action like
    // this, and needs no modal infrastructure to get right.
    const ok = window.confirm(
      `Delete "${campaign.title}"? This can't be undone — every step and its generated copy will be permanently removed.`
    );
    if (!ok) return;

    setDeletingId(campaign.id);
    try {
      await deleteCampaign(campaign.id);
      setCampaigns((prev) => prev?.filter((c) => c.id !== campaign.id) ?? prev);
    } catch {
      window.alert("Couldn't delete that campaign — try again in a moment.");
    } finally {
      setDeletingId(null);
    }
  }

  // Not signed in / onboarding not finished -> useRequireAccess is
  // already redirecting to /auth or /onboarding. Don't flash the
  // dashboard shell in the meantime. No subscription check here — the
  // dashboard itself is free to browse (see useRequireAccess's comment).
  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
      <Sidebar active="dashboard" />

      <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 lg:gap-8 pb-24 md:pb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs uppercase tracking-wider text-faint">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
            <h1 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] leading-tight font-semibold tracking-tight">
              Your campaigns
            </h1>
          </div>
          <Link
            href="/builder"
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-line bg-paper text-slate text-sm font-semibold"
          >
            <PlusIcon small /> New campaign manually
          </Link>
        </div>

        <div className="flex-grow min-h-0 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 items-start">
          <AgentPanel />

          <div className="flex flex-col gap-5">
            <section aria-label="Start a campaign" className="flex flex-col gap-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-faint">
                <span className="w-1.5 h-1.5 rounded-full bg-clay" />
                Or start from a template yourself
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/campaigns"
                  className="inline-flex items-center h-9 px-3.5 rounded-full border border-line bg-paper text-sm font-semibold text-slate"
                >
                  Browse all campaign templates
                </Link>
                <Link
                  href="/builder"
                  className="inline-flex items-center h-9 px-3.5 rounded-full border-[1.5px] border-dashed border-faint text-sm font-semibold text-slate"
                >
                  Start from scratch
                </Link>
              </div>
            </section>

            <section aria-label="Campaigns" className="bg-paper border border-line rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <h2 className="font-display text-sm font-semibold">Your campaigns</h2>
              </div>

              {!user ? (
                <div className="px-4 py-6 text-sm text-faint text-center">
                  Sign in to see your campaigns.
                </div>
              ) : campaigns === null ? (
                <div className="px-4 py-6 text-sm text-faint text-center">Loading...</div>
              ) : campaigns.length === 0 ? (
                <div className="px-4 py-6 text-sm text-faint text-center">
                  No campaigns yet. Ask the agent, or start one above.
                </div>
              ) : (
                campaigns.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/builder?id=${c.id}`}
                    className={`group flex items-center gap-3 px-4 py-3 ${
                      i < campaigns.length - 1 ? "border-b border-line" : ""
                    } ${deletingId === c.id ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="flex-grow min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{c.title}</div>
                      <div className="text-xs text-faint truncate">{c.offer.audience}</div>
                    </div>
                    <div className="font-mono text-xs text-muted shrink-0">
                      {new Date(c.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${c.title}`}
                      disabled={deletingId === c.id}
                      onClick={(e) => {
                        // Stop the click from bubbling to the parent
                        // Link and navigating into the builder instead
                        // of deleting.
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(c);
                      }}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-faint opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-ivory hover:text-dangerFg transition-opacity"
                    >
                      <TrashIcon />
                    </button>
                  </Link>
                ))
              )}
            </section>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}

function PlusIcon({ small }: { small?: boolean }) {
  const size = small ? 16 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
