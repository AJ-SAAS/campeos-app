"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Campaign, listCampaigns } from "@/lib/firebase/campaigns";

const campaignTypes = [
  { title: "48 hour flash sale", length: "2 days", description: "Warm up, open the sale, then a last chance push." },
  { title: "Product launch", length: "2 weeks", description: "Build interest, open the cart, close it with a deadline." },
  { title: "Webinar promo", length: "1 week", description: "Get signups, remind them, and follow up after." },
  { title: "Holiday sale", length: "4 days", description: "A seasonal deal with a clear start and end." },
];

export default function Dashboard() {
  const { user, loading: authLoading, signIn } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    if (!user) {
      setCampaigns(null);
      return;
    }
    listCampaigns(user.uid).then(setCampaigns);
  }, [user]);

  return (
    <div className="min-h-screen flex bg-ivory text-slate font-body">
      <Sidebar active="dashboard" />

      <main className="flex-grow min-w-0 px-12 py-10 flex flex-col gap-8">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs uppercase tracking-wider text-faint">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
            <h1 className="font-display text-[40px] leading-tight font-semibold tracking-tight">
              Your campaigns
            </h1>
          </div>
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-clay text-white text-[15px] font-semibold"
          >
            <PlusIcon /> New campaign
          </Link>
        </div>

        {!authLoading && !user && (
          <div className="bg-white border border-[#DDD6C5] rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
            <div className="text-sm text-muted">
              Sign in to save campaigns to your account and see them here.
            </div>
            <button
              onClick={() => signIn()}
              className="shrink-0 inline-flex items-center h-10 px-4 rounded-[10px] bg-slate text-white text-sm font-semibold"
            >
              Sign in with Google
            </button>
          </div>
        )}

        <section aria-label="Start a campaign" className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Start a campaign</h2>
            <div className="text-sm text-faint">Pick a type. Add your offer. We build the rest.</div>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {campaignTypes.map((t) => (
              <Link
                key={t.title}
                href="/builder"
                className="flex flex-col gap-3 p-[18px] bg-white border border-[#DDD6C5] rounded-2xl"
              >
                <div className="h-10" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <div className="font-display text-[17px] font-semibold">{t.title}</div>
                  <div className="font-mono text-xs text-faint">{t.length}</div>
                </div>
                <div className="text-[13px] leading-relaxed text-[#4F4B42]">{t.description}</div>
              </Link>
            ))}
            <Link
              href="/builder"
              className="flex flex-col gap-3 p-[18px] border-[1.5px] border-dashed border-faint rounded-2xl"
            >
              <div className="h-10 flex items-center">
                <div className="w-8 h-8 rounded-full border-[1.5px] border-muted flex items-center justify-center">
                  <PlusIcon small />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-display text-[17px] font-semibold">Start from scratch</div>
                <div className="font-mono text-xs text-faint">Any length</div>
              </div>
              <div className="text-[13px] leading-relaxed text-[#4F4B42]">Pick your own steps and timing.</div>
            </Link>
          </div>
        </section>

        <section aria-label="Campaigns" className="bg-white border border-[#DDD6C5] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4.5 border-b border-line">
            <h2 className="font-display text-lg font-semibold">Your campaigns</h2>
          </div>

          {!user ? (
            <div className="px-5 py-8 text-sm text-faint text-center">
              Sign in to see your campaigns.
            </div>
          ) : campaigns === null ? (
            <div className="px-5 py-8 text-sm text-faint text-center">Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-faint text-center">
              No campaigns yet. Start one above.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2.2fr_1fr_1.5fr] gap-4 px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-faint bg-[#FAF7F0]">
                <div>Campaign</div>
                <div>Webinar date</div>
                <div>Offer</div>
              </div>
              {campaigns.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/builder?id=${c.id}`}
                  className={`grid grid-cols-[2.2fr_1fr_1.5fr] gap-4 items-center px-5 py-4 ${
                    i < campaigns.length - 1 ? "border-b border-[#EFE9DB]" : ""
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[15px] font-semibold">{c.title}</div>
                    <div className="text-[13px] text-faint">{c.offer.price}</div>
                  </div>
                  <div className="font-mono text-xs text-[#4F4B42]">
                    {new Date(c.eventDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  <div className="text-[13px] text-muted truncate">{c.offer.audience}</div>
                </Link>
              ))}
            </>
          )}
        </section>
      </main>
    </div>
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
