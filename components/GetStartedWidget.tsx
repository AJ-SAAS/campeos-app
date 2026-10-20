"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile, hideChecklist } from "@/lib/firebase/businessProfile";
import { listCampaigns } from "@/lib/firebase/campaigns";
import { listOffers } from "@/lib/firebase/offers";
import { listCallThemes, listWinningCopy } from "@/lib/firebase/library";

// The floating "Get started" task list in the bottom-right corner, like
// MailCheap's. Only for accounts that came through the new onboarding
// (businessProfile.onboardedAt), so older accounts never see it. Rendered
// by the Sidebar, so it follows the user across every main page. Goes
// away by itself once every step is done, or for good with the X.

const COLLAPSE_KEY = "campeos.checklistCollapsed";

interface Item {
  id: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  done: boolean;
}

export function GetStartedWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[] | null>(null);
  const [hidden, setHidden] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Starts minimized on phones, where the open list would cover the
    // page. After that it remembers what they last chose.
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(COLLAPSE_KEY);
    } catch {}
    setCollapsed(saved ? saved === "1" : window.innerWidth < 640);
  }, []);

  // Re-checked on every page change, so ticking a step off (saving a
  // winning line, say) shows up as soon as they move on.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getBusinessProfile(user.uid);
        if (!profile?.onboardedAt || profile.checklistHidden) {
          if (!cancelled) setHidden(true);
          return;
        }
        const [campaigns, offers, winners, themes] = await Promise.all([
          listCampaigns(user.uid),
          listOffers(user.uid),
          listWinningCopy(user.uid),
          listCallThemes(user.uid),
        ]);
        if (cancelled) return;
        const firstId = profile.firstCampaignId ?? campaigns[campaigns.length - 1]?.id;
        setItems([
          {
            id: "campaign",
            title: "Write your first campaign",
            sub: "Pick a campaign and Campeos writes every step from your offer.",
            cta: firstId ? "Open my campaign" : "Choose a campaign",
            href: firstId ? `/builder?id=${firstId}` : "/campaigns",
            done: campaigns.length > 0,
          },
          {
            id: "offer",
            title: "Save your offer",
            sub: "Save what you sell once. Pick it for any campaign after that.",
            cta: "Add an offer",
            href: "/offers",
            done: offers.length > 0,
          },
          {
            id: "winners",
            title: "Add copy that already sold",
            sub: "Paste a headline, ad or email that worked. New campaigns use it.",
            cta: "Add winning copy",
            href: "/winning-copy",
            done: winners.length > 0,
          },
          {
            id: "insights",
            title: "Add a sales call",
            sub: "Paste a call transcript. Campeos writes in your buyers' own words.",
            cta: "Add buyer insights",
            href: "/buyer-insights",
            done: themes.length > 0,
          },
        ]);
        setHidden(false);
      } catch {
        if (!cancelled) setHidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  // Not on Billing, where it would sit on top of the Subscribe button.
  if (hidden || !items || pathname === "/billing") return null;
  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;
  const next = items.findIndex((i) => !i.done);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  function hideForGood() {
    setHidden(true);
    if (user) hideChecklist(user.uid).catch(() => {});
  }

  if (collapsed) {
    return (
      <button
        onClick={toggleCollapsed}
        className="fixed z-40 right-4 bottom-20 md:bottom-5 md:right-5 inline-flex items-center gap-3 h-12 pl-4 pr-3 rounded-full bg-paper border border-line text-sm font-semibold shadow-[0_20px_40px_-20px_rgba(23,19,31,.35)] animate-step-in"
      >
        Get started
        <span className="font-mono text-xs text-muted">
          {doneCount} of {items.length}
        </span>
        <ChevronUp />
      </button>
    );
  }

  return (
    <section
      aria-label="Get started"
      className="fixed z-40 right-3 left-3 bottom-20 sm:left-auto sm:w-[400px] md:bottom-5 md:right-5 bg-paper border border-line rounded-3xl p-5 shadow-[0_30px_60px_-30px_rgba(23,19,31,.45)] animate-step-in"
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 font-display text-lg font-semibold tracking-tight">Get started</h2>
        <button onClick={toggleCollapsed} aria-label="Minimize" title="Minimize" className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:bg-ivory">
          <ChevronDown />
        </button>
        <button onClick={hideForGood} aria-label="Hide for good" title="Hide for good" className="w-9 h-9 rounded-xl flex items-center justify-center bg-ivory text-slate hover:bg-line">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex-1 flex gap-1.5">
          {items.map((it) => (
            <span key={it.id} className={`flex-1 h-1.5 rounded-full transition-colors duration-500 ${it.done ? "bg-slate" : "bg-[#ECEAF0]"}`} />
          ))}
        </div>
        <span className="font-mono text-xs text-muted shrink-0">
          {doneCount} of {items.length}
        </span>
      </div>

      <div className="flex flex-col gap-1 mt-4">
        {items.map((it, i) => {
          if (i === next) {
            return (
              <div key={it.id} className="flex gap-3 rounded-2xl bg-[#F8F8F8] px-3.5 py-3.5">
                <span className="shrink-0 w-7 h-7 rounded-full border-2 border-slate flex items-center justify-center text-[13px] font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold">{it.title}</div>
                  <div className="text-[13.5px] text-muted mt-0.5 leading-snug">{it.sub}</div>
                  <Link href={it.href} className="mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-slate text-white text-[13px] font-semibold">
                    {it.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                </div>
              </div>
            );
          }
          const badge = it.done ? (
            <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
          ) : (
            <span className="shrink-0 w-7 h-7 rounded-full border border-line flex items-center justify-center text-[13px] text-muted">
              {i + 1}
            </span>
          );
          return (
            <Link key={it.id} href={it.href} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-ivory">
              {badge}
              <span className={`flex-1 text-[15px] ${it.done ? "text-muted line-through decoration-[#C9C4D2]" : ""}`}>{it.title}</span>
              {!it.done && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ChevronDown() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
