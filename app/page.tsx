"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

// "Dashboard: day one" — the onboarding screen, from Start.dc.html.
// The website field is wired up visually (loading state, two-line "reading
// your site" panel) but doesn't crawl anything yet — that's a real feature
// to build later, not something to fake with a timeout.
export default function Home() {
  const [site, setSite] = useState("");
  const [isLearning, setIsLearning] = useState(false);

  function learnSite() {
    if (!site || isLearning) return;
    setIsLearning(true);
  }

  return (
    <div className="min-h-screen flex bg-ivory text-slate font-body">
      <Sidebar active="dashboard" />

      <main className="flex-grow min-w-0 px-16 py-14 flex flex-col gap-10 items-center">
        <div className="w-full max-w-[920px] flex flex-col gap-2 text-center">
          <div className="font-mono text-xs uppercase tracking-wider text-faint">
            Welcome to Campeos
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Let&apos;s build your first campaign
          </h1>
          <div className="text-[15px] text-muted leading-relaxed">
            Share your website and we&apos;ll learn your offer, your voice, and
            what you sell. Or skip ahead and start from a template.
          </div>
        </div>

        <div className="w-full max-w-[640px] flex flex-col gap-2.5">
          <label htmlFor="website" className="text-sm font-semibold text-center">
            Your website
          </label>
          <div className="flex gap-2.5">
            <input
              id="website"
              type="text"
              placeholder="yourwebsite.com"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="flex-grow h-[52px] border border-faint rounded-xl px-4 text-[15px] bg-white"
            />
            <button
              onClick={learnSite}
              className="shrink-0 inline-flex items-center gap-2 h-[52px] px-5 rounded-xl bg-clay text-white text-[15px] font-semibold"
            >
              {isLearning ? <SpinnerIcon /> : <SearchIcon />}
              {isLearning ? "Reading your site..." : "Learn my site"}
            </button>
          </div>
          {isLearning ? (
            <div className="flex flex-col gap-1.5 px-3.5 py-3 bg-white border border-line rounded-[10px]">
              <ReadingRow label="Reading your offer and pricing" />
              <ReadingRow label="Reading your voice and tone" />
            </div>
          ) : (
            <div className="text-xs text-faint text-center">
              We&apos;ll read your offer, pricing, and audience from the page.
              Nothing gets posted anywhere.
            </div>
          )}
        </div>

        <div className="w-full max-w-[920px] flex items-center gap-4">
          <span className="flex-grow h-px bg-[#DDD6C5]" />
          <span className="font-mono text-xs text-faint whitespace-nowrap">
            or start from a template
          </span>
          <span className="flex-grow h-px bg-[#DDD6C5]" />
        </div>

        <div className="w-full max-w-[920px] flex flex-col gap-3.5">
          <div className="grid grid-cols-3 gap-4">
            <TemplateCard
              href="/builder"
              title="High-ticket webinar"
              length="7 days"
              description="Ads, registration, reminders, the live event, replay, and call booking."
              recommended
            />
            <TemplateCard
              href="#"
              title="48 hour flash sale"
              length="2 days"
              description="Warm up, open the sale, then a last chance push."
            />
            <TemplateCard
              href="#"
              title="Product launch"
              length="2 weeks"
              description="Build interest, open the cart, close it with a deadline."
            />
          </div>
          <Link
            href="#"
            className="self-center text-sm font-semibold text-[#9A3412] min-h-11 inline-flex items-center"
          >
            See all campaign types
          </Link>
        </div>

        <div className="w-full max-w-[920px] bg-white border border-line rounded-2xl px-7 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-semibold">
              Get better results from the start
            </div>
            <span className="font-mono text-xs text-faint">0 of 2 done</span>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <ChecklistItem
              title="Add a winning headline"
              description="Paste an ad, email, or subject line that already worked. We'll use it to write in your style."
            />
            <ChecklistItem
              title="Add a sales call"
              description="Paste a transcript. We'll pull out why people buy, in their own words."
            />
          </div>
          <div className="text-xs text-faint">
            Optional. You can skip this and start from a template instead.
          </div>
        </div>
      </main>
    </div>
  );
}

function ReadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[#4F4B42]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B4F]" />
      {label}
    </div>
  );
}

function TemplateCard({
  href,
  title,
  length,
  description,
  recommended,
}: {
  href: string;
  title: string;
  length: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-3 p-5 bg-white rounded-2xl relative ${
        recommended ? "border-2 border-clay" : "border border-[#DDD6C5]"
      }`}
    >
      {recommended && (
        <span className="absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full bg-clay text-white text-[11px] font-semibold">
          Recommended
        </span>
      )}
      <div className="h-10" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="font-mono text-xs text-faint">{length}</div>
      </div>
      <div className="text-[13px] leading-relaxed text-[#4F4B42]">
        {description}
      </div>
    </Link>
  );
}

function ChecklistItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 p-3.5 border border-line rounded-xl">
      <div className="w-8 h-8 rounded-full border-[1.5px] border-faint shrink-0" />
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[13px] text-muted leading-snug">{description}</div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="animate-spin">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
