"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { Campaign, latestCampaignByTemplate, listCampaigns } from "@/lib/firebase/campaigns";
import { catalog, categoryLabels, categoryOrder } from "@/lib/templates/catalog";

// The campaign template gallery — every campaign type Campeos offers, one
// card each. Clicking an available card either opens the user's most
// recent campaign already built from that template, or starts a new one
// (/builder?template=<id>). A "soon" card isn't a link yet — the copy
// for that template hasn't been written (see lib/templates/catalog.ts).
//
// Card design ported from the campaigns-mockup canvas (Variation 2): a
// gradient accent bar as the one shared element across every state (brand
// violet/pink by default, green when there's an active campaign built
// from it), an initials badge instead of a bare title, and a soft ambient
// glow behind the grid instead of tinting every card. Categories were
// regrouped at the same time — see catalog.ts's comment on why.
function initialsOf(title: string): string {
  const words = title.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    if (!user) {
      setCampaigns(null);
      return;
    }
    listCampaigns(user.uid).then(setCampaigns);
  }, [user]);

  const byTemplate = useMemo(
    () => (campaigns ? latestCampaignByTemplate(campaigns) : {}),
    [campaigns]
  );

  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body relative">
      {/* Ambient glow fixed to the bottom of the viewport, not the page
          background itself — stays put while the card grid scrolls past
          it, same as the mockup. */}
      <div
        aria-hidden="true"
        className="fixed left-0 right-0 bottom-0 h-[46vh] min-h-[340px] pointer-events-none z-0"
        style={{
          background:
            "linear-gradient(to top, rgba(124,58,237,0.20) 0%, rgba(236,72,153,0.14) 38%, rgba(236,72,153,0) 100%)",
        }}
      />

      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0 relative z-10">
        <Sidebar active="campaigns" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-8 pb-24 md:pb-10">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs uppercase tracking-wider text-faint">
              {catalog.length} campaign types
            </div>
            <h1 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] leading-tight font-semibold tracking-tight">
              Start a campaign
            </h1>
            <p className="text-sm text-muted max-w-[52ch]">
              Pick a template. If you&apos;ve already built one from it, picking it
              again picks up where you left off.
            </p>
          </div>

          {categoryOrder.map((category) => {
            const entries = catalog.filter((c) => c.category === category);
            if (entries.length === 0) return null;
            return (
              <section key={category} className="flex flex-col gap-3">
                <h2 className="font-display text-[19px] font-bold tracking-tight">
                  {categoryLabels[category]}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {entries.map((entry) => {
                    const existing = byTemplate[entry.id];
                    const available = entry.status === "available";
                    const activeCampaign = available && !!existing;
                    const href = !available
                      ? undefined
                      : existing
                        ? `/builder?id=${existing.id}`
                        : `/builder?template=${entry.id}`;

                    const card = (
                      <div
                        className={`relative flex flex-col gap-3 h-full min-h-[168px] rounded-2xl border bg-paper p-5 pt-[22px] overflow-hidden transition-all ${
                          activeCampaign
                            ? "border-lime/55 hover:shadow-[0_8px_20px_-10px_rgba(19,23,26,0.18)]"
                            : available
                              ? "border-line hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-10px_rgba(19,23,26,0.18)]"
                              : "border-line opacity-55"
                        }`}
                      >
                        {/* Shared accent bar across every card — only the
                            color changes by state (brand vs. active). */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${
                            activeCampaign ? "from-lime to-emerald-300" : "from-clay to-pink"
                          }`}
                        />

                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-[30px] h-[30px] shrink-0 rounded-[9px] flex items-center justify-center font-display text-[11px] font-bold text-white bg-gradient-to-r ${
                                activeCampaign ? "from-lime to-emerald-300" : "from-clay to-pink"
                              }`}
                            >
                              {initialsOf(entry.title)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {activeCampaign && (
                                <span className="w-[7px] h-[7px] rounded-full bg-lime shrink-0 animate-pulse" />
                              )}
                              <h3 className="font-display text-[17px] font-bold leading-snug">
                                {entry.title}
                              </h3>
                            </div>
                          </div>
                          {!available && (
                            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint border border-line rounded-full px-2 py-0.5">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-[13.5px] text-muted leading-snug flex-grow">
                          {entry.description}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="font-mono text-[11px] text-faint">{entry.length}</span>
                          {available && (
                            <span className="text-[12px] font-semibold text-clay">
                              {existing ? "Continue →" : "Start →"}
                            </span>
                          )}
                        </div>
                      </div>
                    );

                    return href ? (
                      <Link key={entry.id} href={href} title={entry.description}>
                        {card}
                      </Link>
                    ) : (
                      <div key={entry.id}>{card}</div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}
