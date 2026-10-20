"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { PlanKey } from "@/lib/stripe/client";

// The marketing/sales page at campeos.com — the first-touch page for
// everyone who isn't signed in yet. Built from the approved "Campeos
// sales page" Design mockup (the second pass — serif display type, the
// campaign-type marquee, the before/after comparison, real founder copy
// and real pricing/FAQ content, replacing the first pass's bracketed
// placeholders with what Ajay actually supplied). The mockup's busiest
// panels — the Offers/Buyer-insights/Agent "live demo" tiles that cycle
// through scripted states on a timer — are presented here as clean
// static previews instead of 1:1 ports of that cycling state machine;
// everything else (copy, pricing numbers, FAQ answers, the founder
// story) is used verbatim from what was supplied.
//
// One placeholder remains on purpose: the "client launches before
// Campeos" stat and the demo video are facts/assets only Ajay has.

const AUDIENCES = [
  {
    title: "Webinar sellers",
    body: "A webinar funnel is 20+ pieces of copy before you even go live. Campeos writes the registration ads, the reminders and the whole backend sequence in one pass.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    title: "High-ticket launchers",
    body: "Cart-open, FOMO, objection-handling, cart-close. The sequence that actually sells a high-ticket offer, mapped out and written, not guessed at.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
      </svg>
    ),
  },
  {
    title: "Agencies and DFY shops",
    body: "Build a campaign once per client instead of from scratch every time. Save what works, reuse it on the next account.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 14.5c2.8.2 5 2.6 5 5.5" />
      </svg>
    ),
  },
];

// From the mockup's marquee — every campaign "pocket," not just the one
// that's built (webinar). Real scope, not a teaser list.
const CAMPAIGN_TYPES: { code: string; name: string; live?: boolean }[] = [
  { code: "BF", name: "Black Friday" },
  { code: "CM", name: "Cyber Monday" },
  { code: "HS", name: "Holiday Sale" },
  { code: "XH", name: "Xmas Holidays" },
  { code: "VD", name: "Valentine's Day" },
  { code: "4H", name: "48 Hour Flash Sale" },
  { code: "CC", name: "Cart Close" },
  { code: "CI", name: "Cash Injection" },
  { code: "DD", name: "Daily Deals" },
  { code: "WL", name: "Webinar Launch", live: true },
  { code: "PL", name: "Product Launch" },
  { code: "ML", name: "MVP Launch" },
  { code: "MC", name: "Mini-Launch" },
  { code: "LM", name: "Lead Magnet" },
  { code: "GC", name: "Giveaway" },
  { code: "PE", name: "Post Engagement" },
  { code: "EC", name: "Ebook" },
  { code: "PB", name: "Physical Book + Free Shipping" },
  { code: "BA", name: "Book a Call" },
  { code: "HC", name: "Hand-Raiser" },
  { code: "W", name: "Win-Back" },
  { code: "NC", name: "Newsletter" },
];

const OLD_WAY = [
  "Writing 9 emails, 4 ads and 6 posts by hand",
  "Rewriting ChatGPT copy line by line",
  "Guessing what to send, and when",
  "Losing your best lines in old Google Docs",
  "Starting from zero, every launch",
];

const NEW_WAY = [
  "Your whole launch, planned day by day",
  "Copy built from your best lines and your buyers' words",
  "Every email, ad and post, ready to paste",
  "Change anything by just asking",
  "Your winners saved, so the next launch starts ahead",
];

const FEATURES = [
  {
    title: "Campaign templates",
    body: "24 campaign types, from Black Friday to Win-Back. Come back anytime and pick up where you left off.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="15" width="7" height="7" rx="1.5" /><rect x="14" y="15" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    title: "Offers",
    body: "Save an offer once. Then pick it for any campaign, no retyping.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.59 13.41L13 21l-9-9V4h8l9 9a2 2 0 010 2.41z" /><circle cx="8.5" cy="8.5" r="1.5" />
      </svg>
    ),
  },
  {
    title: "Buyer insights",
    body: "Paste a sales call. Campeos pulls out why people buy, in their own words.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    title: "Campaign timeline",
    body: "See every email and ad, day by day. Each one comes with the best time to send it.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "Winning copy",
    body: "Save the lines that already sold. Every new campaign builds on them.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
      </svg>
    ),
  },
  {
    title: "Your campaign agent",
    body: "Tell it what to change in plain words. It edits the copy and tells you exactly what it did.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4M9 4h6" />
        <circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" />
      </svg>
    ),
  },
];

const READING_LEVELS = [
  { text: "5TH", full: "5th grade", sample: "Your next launch, written in plain words. Short sentences. No jargon." },
  { text: "7TH", full: "7th grade", sample: "Your next launch, written clearly, with a little more room for nuance where the offer needs it." },
  { text: "9TH", full: "9th grade", sample: "Your next launch, written with natural sentence variety and the occasional industry term your audience already uses." },
  { text: "PRO", full: "Professional", sample: "Your next launch, written for an informed reader who expects precision, category language, and zero hedging." },
];

const WINNER_STEPS = [
  { n: "01", title: "Write", body: "Every email, ad and post, written." },
  { n: "02", title: "Test", body: "See which hooks and subject lines pull." },
  { n: "03", title: "Save the winners", body: "Keep what your buyers responded to." },
  { n: "04", title: "Double down", body: "Your next launch is built from it." },
];

const WINNERS_LIBRARY = [
  { cat: "Ad hooks", sub: "that stop the scroll", line: "Posting every day and still no clients?" },
  { cat: "Subject lines", sub: "that get opened", line: "Your next 10 clients start Monday" },
  { cat: "Headlines", sub: "that get clicks", line: "Book 10 calls a week without cold DMs" },
  { cat: "Buyer words", sub: "your audience uses", line: "“I was posting for nothing.”" },
  { cat: "Angles", sub: "your buyers care about", line: "No time to run ads myself" },
  { cat: "Deadlines", sub: "that make people act", line: "Seats close Friday at midnight" },
];

const VIDEO_CHAPTERS = [
  { t: "0:00", title: "The night before launch" },
  { t: "0:20", title: "Save your offer once" },
  { t: "0:50", title: "Add your winning copy and sales calls" },
  { t: "1:30", title: "Pick a campaign" },
  { t: "1:50", title: "Your whole campaign, day by day" },
  { t: "2:30", title: "Change anything with the agent" },
  { t: "3:05", title: "Copy and launch" },
  { t: "3:25", title: "Your next launch starts ahead" },
];

const PILLARS = [
  {
    title: "Launch-tested.",
    body: "Every campaign type comes from launches I ran for real clients. Not generic AI guesses.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" />
      </svg>
    ),
  },
  {
    title: "Your buyers, learned.",
    body: "Your offer and your sales calls shape every line, until it sounds like you wrote it.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    title: "Gets sharper.",
    body: "Every winner you save trains your agent. So each launch starts smarter than the last.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
      </svg>
    ),
  },
];

const PLANS: {
  key: PlanKey;
  name: string;
  tagline: string;
  priceMonthly: string;
  priceYearly: string;
  badge?: string;
  featured: boolean;
  cta: string;
  groups: { label: string; items: string[] }[];
}[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For your first launches.",
    priceMonthly: "$39",
    priceYearly: "$33",
    featured: false,
    cta: "Start with Starter",
    groups: [
      { label: "Campaigns", items: ["3 full campaigns a month", "Email, SMS, ads and social posts in each one", "24 launch playbooks"] },
      { label: "Your brand", items: ["We scan your website to learn your brand", "2 saved offers", "1 person"] },
      { label: "Learning", items: ["Save up to 20 winners", "Learn from 3 sales calls a month"] },
      { label: "Support", items: ["Email support"] },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "For people who launch all year.",
    priceMonthly: "$99",
    priceYearly: "$83",
    badge: "Unlimited everything",
    featured: true,
    cta: "Get Pro",
    groups: [
      { label: "Campaigns", items: ["Unlimited campaigns", "Email, SMS, ads and social posts in each one", "Get new campaign types first"] },
      { label: "Your brand", items: ["We scan your website to learn your brand", "Unlimited offers", "Your team, up to 5 people"] },
      { label: "Learning", items: ["Unlimited winners — your agent learns from every one", "Unlimited sales calls"] },
      { label: "Support", items: ["Priority support", "I personally review your first launch"] },
    ],
  },
];

const FAQS = [
  { q: "Why not just use ChatGPT?", a: "You can. But you start from a blank chat every time. ChatGPT doesn't know your best headlines, what your buyers said on calls, or what sold last launch. And it won't plan your launch day by day. Campeos does all of that, and it remembers." },
  { q: "Does Campeos send my emails or post my ads?", a: "No. Campeos builds the whole campaign for you. Then you copy each piece and paste it into the tools you already use. So it works with any email tool and any ad account." },
  { q: "What campaign types can I build?", a: "Webinar Launch is live now. 23 more are on the way, like Black Friday, Cart Close, Product Launch, Book a Call and Win-Back. Every plan gets every new type." },
  { q: "Will it sound like me?", a: "You tell Campeos about your offer and the headlines that already worked. It writes from those. You can edit every word before you use it." },
  { q: "Is there a free trial?", a: "No. Plans start at $39 a month, and you can cancel anytime." },
  { q: "Can I get a refund?", a: "You can cancel anytime from your billing page. Your plan keeps working until the end of the month you paid for. We don't refund part of a month. If we ever close your account and you didn't break our terms, we'll refund the part you didn't use." },
  { q: "Who is behind Campeos?", a: "Ajay Sharma built it. His UK company, Campeos Solutions LTD, runs it. Questions? Email ajay@ajaysharma.co." },
];

const MOCK_ROWS = [
  { lane: "AD", fg: "#1B6B4F", bg: "#DFF0E8", title: "Registration ad", delay: "0s", w: "150px" },
  { lane: "EMAIL", fg: "#1F5FA6", bg: "#E4EDF8", title: "You're invited", delay: ".3s", w: "110px" },
  { lane: "SMS", fg: "#6B4FA3", bg: "#ECE7F5", title: "Save your seat", delay: ".6s", w: "90px" },
  { lane: "EMAIL", fg: "#1F5FA6", bg: "#E4EDF8", title: "A confession", delay: ".9s", w: "130px" },
];

// The hero's word carousel — "Run a sold-out ___ Campaign."
const HERO_WORDS = ["Webinar Launch", "Black Friday", "Flash Sale", "Cart Close", "Product Launch", "Win-Back"];

export default function MarketingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [word, setWord] = useState(0);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  // Signed-in users who land on "/" (bookmark, back button) belong on
  // the dashboard — soft gate, so no subscription check gates it.
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace("/dashboard");
  }, [authLoading, user, router]);

  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % HERO_WORDS.length), 2400);
    return () => clearInterval(id);
  }, []);

  if (authLoading || user) {
    return <div className="min-h-screen bg-paper" />;
  }

  const activeLevel = READING_LEVELS[level];

  return (
    <div className="bg-paper text-slate font-body">
      {/* NAV */}
      <div className="sticky top-0 z-40 backdrop-blur border-b border-line bg-white/80">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center gap-7">
          <div className="flex items-center flex-grow min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
            <img src="/logo-lockup.png" alt="Campeos" className="h-7 w-auto object-contain" />
          </div>
          <div className="hidden md:flex items-center gap-6 font-mono shrink-0">
            <a href="#features" className="text-[13px] text-muted font-medium">Campaigns</a>
            <a href="#pricing" className="text-[13px] text-muted font-medium">Pricing</a>
            <a href="#faq" className="text-[13px] text-muted font-medium">Help</a>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/auth" className="text-[13px] font-semibold text-slate px-1.5 py-2">
              Sign in
            </Link>
            <Link
              href="/auth?signup"
              className="text-[13px] font-bold text-white px-[18px] py-2.5 rounded-[10px] bg-gradient-to-r from-clay to-pink whitespace-nowrap"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="relative px-6 pt-[72px] pb-20 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: "radial-gradient(#E4DCF4 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-28 -right-20 w-[460px] h-[460px] rounded-full blur-[10px] animate-drift"
          style={{ background: "radial-gradient(circle at 30% 30%, rgba(124,58,237,.22), transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute top-48 -left-28 w-[360px] h-[360px] rounded-full blur-[10px] animate-drift2"
          style={{ background: "radial-gradient(circle at 60% 40%, rgba(236,72,153,.18), transparent 70%)" }}
        />

        <div className="max-w-[1200px] mx-auto relative flex flex-wrap gap-14 items-center">
          <div className="flex-1 min-w-[300px] basis-[480px] flex flex-col gap-5">
            <h1 className="font-serif font-medium text-[38px] sm:text-[58px] leading-[1.06] tracking-tight max-w-[640px]">
              Run a <span className="italic">sold-out</span>
              <br />
              <span key={word} className="animate-step-in bg-gradient-to-r from-clay to-pink bg-clip-text text-transparent">
                {HERO_WORDS[word]}
              </span>{" "}
              Campaign
            </h1>
            <p className="text-lg leading-[1.55] text-muted max-w-[520px]">
              No more blank pages. Campeos writes your whole launch. Every win you save trains your agent, so each launch starts smarter than the last.
            </p>
            <div className="flex items-center gap-3.5 flex-wrap pt-1.5">
              <Link
                href="/auth?signup"
                className="inline-flex items-center gap-2 text-[15px] font-bold text-white px-[22px] py-3.5 rounded-xl bg-slate shadow-[0_10px_30px_-10px_rgba(19,23,26,.6)]"
              >
                Get started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a href="#pricing" className="text-sm font-semibold text-slate px-2.5 py-3.5">See pricing &rarr;</a>
            </div>
            <div className="inline-flex self-start items-center gap-2.5 mt-1 pl-2 pr-4 py-2 rounded-full bg-white border border-line text-left">
              <span className="w-8 h-8 shrink-0 rounded-full bg-[#FCE7F3] text-[#9D174D] font-extrabold text-xs flex items-center justify-center">OA</span>
              <span className="text-[13.5px]">&ldquo;You over-delivered.&rdquo; <b>Olivia Alexa</b>, 434K on YouTube</span>
            </div>
          </div>

          <div className="flex-1 min-w-[300px] basis-[440px] flex justify-center">
            <div className="relative w-full max-w-[420px]">
              <div
                aria-hidden="true"
                className="absolute -inset-3.5 rounded-3xl blur-[18px] z-0"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,.18), rgba(236,72,153,.14))" }}
              />
              <div className="relative z-10 bg-white border border-line rounded-[18px] shadow-[0_30px_60px_-24px_rgba(19,23,26,.25)] p-[18px] flex flex-col gap-3 animate-floaty">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[13.5px]">Webinar launch</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-agentWash">
                    <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
                    <span className="font-mono text-[10px] font-bold text-clay">WRITING</span>
                  </span>
                </div>
                {MOCK_ROWS.map((row) => (
                  <div key={row.title} className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-[10px] bg-white">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.fg }} />
                    <span
                      className="font-mono text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: row.bg, color: row.fg }}
                    >
                      {row.lane}
                    </span>
                    <span className="text-[12.5px] font-semibold shrink-0 max-w-[112px] truncate">{row.title}</span>
                    <span
                      className="flex-grow h-2 rounded-full bg-ivory animate-pulse"
                      style={{ maxWidth: row.w, animationDelay: row.delay }}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1 border-t border-line">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span className="font-mono text-[10.5px] text-faint">22 steps &middot; 11 days &middot; scheduled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CAMPAIGN TYPE MARQUEE */}
      <div className="pb-20 text-center">
        <p className="text-[15px] text-muted">24 campaign types. Webinar Launch is live now. More are coming soon.</p>
        <div
          aria-hidden="true"
          className="relative mt-4 overflow-hidden"
          style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)" }}
        >
          <div className="flex w-max animate-marquee">
            {[...CAMPAIGN_TYPES, ...CAMPAIGN_TYPES].map((c, i) => (
              <span
                key={i}
                className="shrink-0 inline-flex items-center gap-2.5 mr-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border border-line bg-white text-[14px] font-medium whitespace-nowrap"
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10.5px] font-bold ${
                    c.live ? "bg-gradient-to-br from-clay to-pink text-white" : "bg-ivory text-muted"
                  }`}
                >
                  {c.code}
                </span>
                {c.name}
                {c.live && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] text-[10.5px] font-bold">Live</span>
                )}
              </span>
            ))}
          </div>
        </div>
        {/* Real numbers only — "launches run by hand" is a figure only
            Ajay has; swap the bracket for the real count. */}
        <div className="max-w-[900px] mx-auto mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="p-6 rounded-[18px] bg-white border border-line">
            <div className="font-serif font-medium text-[44px] leading-none text-clay">0</div>
            <div className="text-[15px] text-muted mt-2">blank pages. Every launch starts with a plan that works</div>
          </div>
          <div className="p-6 rounded-[18px] bg-white border border-line">
            <div className="font-serif font-medium text-[44px] leading-none text-clay">[#]</div>
            <div className="text-[15px] text-muted mt-2">client launches I built by hand before Campeos</div>
          </div>
          <div className="p-6 rounded-[18px] bg-white border border-line">
            <div className="font-serif font-medium text-[44px] leading-none text-clay">434K</div>
            <div className="text-[15px] text-muted mt-2">YouTube fans of a client I run launches for. 2 years and counting</div>
          </div>
        </div>
        <p className="text-[14px] text-faint mt-4">Real numbers only. We&apos;ll add more as Campeos grows.</p>
      </div>

      {/* WHO IT'S FOR */}
      <div className="max-w-[1200px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="border border-line rounded-2xl p-6 flex flex-col gap-3 transition-shadow hover:shadow-lg">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-agentWash text-clay flex items-center justify-center">{a.icon}</div>
              <h3 className="font-display text-base font-bold">{a.title}</h3>
              <p className="text-sm leading-[1.55] text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* OLD WAY VS NEW */}
      <div className="px-6 pb-24">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.05] tracking-tight text-center max-w-[760px] mx-auto">
            The night before <span className="italic">launch</span>
          </h2>
          <p className="text-[17px] text-muted text-center max-w-[480px] mx-auto mt-3">
            Two ways to run it. You&apos;ve probably lived the first one.
          </p>
          <div className="flex flex-wrap gap-5 mt-12">
            <div className="flex-1 min-w-[300px] basis-[420px] p-7 sm:p-9 rounded-[28px] bg-ivory">
              <div className="text-[13px] font-bold tracking-wide uppercase text-faint">The old way</div>
              <div className="text-[21px] font-semibold tracking-tight mt-2 text-muted">A blank page and a long night</div>
              <div className="grid gap-3.5 mt-6">
                {OLD_WAY.map((line) => (
                  <div key={line} className="flex items-center gap-3 text-[15.5px] leading-[1.4] text-muted">
                    <span className="inline-flex items-center justify-center w-[22px] h-[22px] shrink-0 rounded-full bg-line text-faint">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="flex-1 min-w-[300px] basis-[420px] p-7 sm:p-9 rounded-[28px] bg-white"
              style={{ border: "2px solid transparent", backgroundImage: "linear-gradient(#FFFFFF,#FFFFFF), linear-gradient(135deg,#7C3AED,#EC4899)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", boxShadow: "0 40px 80px -50px rgba(124,58,237,.5)" }}
            >
              <div className="text-[13px] font-bold tracking-wide uppercase text-clay">The Campeos way</div>
              <div className="text-[21px] font-semibold tracking-tight mt-2">Done in one evening</div>
              <div className="grid gap-3.5 mt-6">
                {NEW_WAY.map((line) => (
                  <div key={line} className="flex items-center gap-3 text-[15.5px] leading-[1.4]">
                    <span className="inline-flex items-center justify-center w-[22px] h-[22px] shrink-0 rounded-full bg-gradient-to-br from-clay to-pink text-white">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" className="bg-ivory px-6 py-24">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center flex flex-col gap-3 mb-14">
            <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.05] tracking-tight">Everything you need to run a launch</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line rounded-[18px] overflow-hidden">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-paper p-7 flex flex-col gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-agentWash text-clay flex items-center justify-center">{f.icon}</div>
                <h3 className="font-display text-[15.5px] font-bold">{f.title}</h3>
                <p className="text-[13.5px] leading-[1.6] text-muted">{f.body}</p>
              </div>
            ))}
          </div>

          {/* Real, working reading-level demo — matches the "reading
              level and tone" feature above, not a static mockup */}
          <div className="mt-7 border border-line rounded-[18px] p-8 bg-paper flex flex-wrap gap-8 items-center">
            <div className="flex-1 min-w-[280px] flex flex-col gap-2.5">
              <h3 className="font-display text-[17px] font-bold">Try the reading-level slider</h3>
              <p className="text-[13.5px] leading-[1.6] text-muted">
                Every campaign gets written at the level your audience actually reads at. Drag it.
              </p>
            </div>
            <div className="flex-1 min-w-[260px] basis-[320px] flex flex-col gap-3.5 bg-ivory border border-line rounded-2xl px-[22px] py-5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-muted tracking-wide">READING LEVEL</span>
                <span className="font-mono text-xs font-bold text-clay">{activeLevel.full}</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                aria-label="Reading level"
                className="w-full accent-clay"
              />
              <div className="flex justify-between">
                {READING_LEVELS.map((lv, i) => (
                  <span
                    key={lv.text}
                    className={`font-mono text-[10.5px] ${i === level ? "text-clay font-bold" : "text-faint font-medium"}`}
                  >
                    {lv.text}
                  </span>
                ))}
              </div>
              <div className="mt-1 px-3.5 py-3 rounded-[10px] bg-paper text-[12.5px] leading-[1.6] text-slate">
                {activeLevel.sample}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WINNER LOOP */}
      <div className="px-6 py-24">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.05] tracking-tight text-center max-w-[720px] mx-auto">
            Your launches, <span className="italic">12 months from now</span>
          </h2>
          <p className="text-[17px] text-muted text-center max-w-[560px] mx-auto mt-3">
            Every launch shows you what your buyers respond to. Campeos remembers it, so you never lose a winner and never guess twice.
          </p>

          <div className="flex flex-wrap gap-5 mt-12">
            <div className="flex-1 min-w-[300px] basis-[440px] p-7 sm:p-9 rounded-[28px] bg-ivory">
              <h3 className="font-display text-base font-bold">The Winner Loop</h3>
              <p className="text-[15px] leading-[1.55] text-muted mt-2">
                Write it. Test it. Keep what your buyers responded to. Then build your next launch on top of it.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-8">
                {WINNER_STEPS.map((s, i) => (
                  <div key={s.n} className="relative p-4 rounded-2xl bg-paper border border-line">
                    <span className="font-mono text-[11px] text-faint">{s.n}</span>
                    <div className="font-semibold text-[15px] mt-1">{s.title}</div>
                    <p className="text-[12.5px] text-muted mt-1 leading-[1.4]">{s.body}</p>
                    {i < WINNER_STEPS.length - 1 && (
                      <span className="hidden sm:block absolute top-1/2 -right-2.5 -translate-y-1/2 text-faint" aria-hidden="true">
                        &rarr;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[300px] basis-[440px] rounded-[28px] bg-white border border-line overflow-hidden">
              <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-line">
                <div className="font-bold text-[15px]">Your winners library</div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-agentWash text-clay text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime" />
                  Training your agent
                </span>
              </div>
              <div>
                {WINNERS_LIBRARY.map((w, i) => (
                  <div key={w.cat} className={`flex items-center gap-3.5 px-5 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                    <div className="w-[120px] shrink-0">
                      <div className="text-[13px] font-bold">{w.cat}</div>
                      <div className="text-[11.5px] text-faint">{w.sub}</div>
                    </div>
                    <div className="flex-1 min-w-0 text-[13.5px] font-medium truncate">{w.line}</div>
                    <span className="shrink-0 w-[22px] h-[22px] rounded-md bg-gradient-to-br from-clay to-pink text-white flex items-center justify-center">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" />
                      </svg>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIDEO — placeholder until the real recording exists; see the
          caption below the player. */}
      <div className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.05] tracking-tight text-center">See Campeos in action</h2>
          <p className="text-[17px] text-muted text-center max-w-[500px] mx-auto mt-3">
            Watch me build a whole webinar launch, start to finish. No cuts to the good parts.
          </p>
          <div className="flex gap-6 flex-wrap items-stretch mt-10">
            <div className="flex-1 min-w-[320px] basis-[620px] relative aspect-video rounded-[28px] overflow-hidden bg-[#110C1E]">
              <div
                aria-hidden="true"
                className="absolute left-[7%] top-1/2 -translate-y-1/2 max-w-[62%]"
              >
                <div className="font-display font-extrabold text-[clamp(26px,5vw,56px)] leading-[.95] tracking-tight text-white uppercase">Whole launch.</div>
                <div className="font-display font-extrabold text-[clamp(26px,5vw,56px)] leading-[1.05] tracking-tight uppercase bg-gradient-to-r from-[#8B7BFF] to-[#FF4FD8] bg-clip-text text-transparent">4 minutes.</div>
              </div>
              <div
                aria-label="Demo video — coming soon"
                className="absolute left-1/2 top-1/2 w-[72px] h-[72px] -ml-9 -mt-9 rounded-full bg-white/90 flex items-center justify-center"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 5v14l11-7z" fill="#17131F" />
                </svg>
              </div>
              <div className="absolute left-5 bottom-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-white text-[12.5px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4FD8]" />
                Demo video coming soon
              </div>
            </div>
            <div className="flex-none basis-[320px] min-w-[260px] p-4 rounded-[28px] bg-ivory">
              <div className="font-mono text-[11px] tracking-wide text-faint px-3.5 pb-2.5 pt-1">CHAPTERS</div>
              <div className="grid gap-0.5">
                {VIDEO_CHAPTERS.map((c) => (
                  <div key={c.t} className="flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl">
                    <span className="font-mono text-[13px] font-semibold text-faint w-10 shrink-0">{c.t}</span>
                    <span className="text-[14.5px] font-medium">{c.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PILLARS */}
      <div className="px-6 pb-4">
        <div className="max-w-[1100px] mx-auto text-center">
          <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.1] tracking-tight max-w-[760px] mx-auto">
            Built by a launch marketer.
            <br />
            <span className="italic">Trained by your winners.</span>
          </h2>
          <div className="flex flex-wrap gap-5 mt-12 text-left">
            {PILLARS.map((p) => (
              <div key={p.title} className="flex-1 min-w-[240px] basis-[280px] p-7 rounded-[28px] bg-ivory">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-[14px] bg-gradient-to-br from-clay to-pink text-white">
                  {p.icon}
                </span>
                <div className="text-[19px] font-semibold tracking-tight mt-5">{p.title}</div>
                <p className="text-[15.5px] leading-[1.55] text-muted mt-2">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOUNDER */}
      <div className="px-6 py-24">
        <div className="max-w-[720px] mx-auto">
          <h2 className="font-serif font-medium text-[32px] sm:text-[46px] leading-[1.1] tracking-tight">Why I built Campeos</h2>
          <div className="text-[18px] leading-[1.8] text-slate mt-8 grid gap-5">
            <p>
              Hi, I&apos;m <b>Ajay</b>, and I run sales campaigns for a living.
            </p>
            <p>
              I run a done-for-you marketing business. Every launch I built for a client started from a{" "}
              <b>blank page</b>. Same emails. Same ads. Same long nights. So I built a tool to do the heavy lifting for me.
            </p>
            <p>Other marketers had the same problem. So I turned it into Campeos, for everyone.</p>
            <p>
              I use it for my own launches, and for clients like <b>Attraction Secrets</b>, with <b>over 434,000</b> YouTube subscribers.
            </p>
            <p>So I built Campeos with three things in mind:</p>
          </div>
          <ol className="text-[18px] leading-[1.8] text-slate pl-6 mt-3 grid gap-3 list-decimal">
            <li><b>Never start from zero.</b> Your best campaigns stay saved, so each launch beats the last.</li>
            <li><b>Organized.</b> Every email, ad and post sits on one timeline, so you always know what goes out next.</li>
            <li><b>Works with what you have.</b> Copy and paste into any tool. Nothing to connect.</li>
          </ol>
          <p className="text-[18px] leading-[1.8] text-slate mt-6">
            Oh, and Campeos never takes a cut of your sales. On every plan.
          </p>
          <div className="flex items-center gap-3 pt-8">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-clay to-pink flex items-center justify-center font-bold text-white text-[15px]">A</div>
            <div>
              <div className="text-[13.5px] font-bold">Ajay Sharma</div>
              <div className="font-mono text-[11.5px] text-faint">Founder, Campeos</div>
            </div>
          </div>
        </div>
      </div>

      {/* TESTIMONIAL */}
      <div className="px-6 pb-24">
        <div className="relative max-w-[960px] mx-auto p-7 sm:p-12 rounded-[32px] bg-white border border-line shadow-[0_50px_90px_-60px_rgba(124,58,237,.4)] overflow-hidden">
          <svg width="46" height="36" viewBox="0 0 54 42" aria-hidden="true" className="text-clay">
            <path d="M0 42V24C0 10 7 2 21 0l2 6C15 8 12 13 12 20h10v22H0zm31 0V24C31 10 38 2 52 0l2 6c-8 2-11 7-11 14h10v22H31z" fill="currentColor" />
          </svg>
          <div className="text-[13px] font-bold text-clay tracking-wide uppercase mt-5">What clients say about my launches</div>
          <blockquote className="font-serif font-medium text-[22px] sm:text-[32px] leading-[1.25] tracking-tight mt-3">
            Everything you said that you were going to deliver on, you over-delivered on. I have multiple streams of income, just like you promised me I would.
          </blockquote>
          <div className="flex items-center gap-3.5 mt-7 flex-wrap">
            <span className="w-[52px] h-[52px] shrink-0 rounded-full bg-[#FCE7F3] text-[#9D174D] font-extrabold text-[17px] flex items-center justify-center">OA</span>
            <div className="flex-1 min-w-[180px]">
              <div className="font-extrabold text-[17px]">Olivia Alexa</div>
              <div className="text-[15px] text-muted">Founder, Attraction Secrets</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-full bg-agentWash text-clay text-[13px] font-bold">434K on YouTube</span>
              <span className="px-3 py-1.5 rounded-full bg-ivory text-slate text-[13px] font-bold">Client for 2 years</span>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" className="max-w-[1000px] mx-auto px-6 py-24">
        <div className="text-center flex flex-col gap-3 mb-10">
          <h2 className="font-serif font-medium text-[32px] sm:text-[48px] leading-[1.05] tracking-tight">Every campaign type, on every plan</h2>
          <p className="text-[17px] text-muted">Start small, or go unlimited. Every campaign covers email, SMS, ads and social posts.</p>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ivory">
            <button
              onClick={() => setBilling("monthly")}
              className={`min-h-10 px-4 rounded-full text-[15px] font-semibold ${
                billing === "monthly" ? "bg-white shadow-sm" : "text-muted"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`min-h-10 px-4 rounded-full text-[15px] font-semibold ${
                billing === "yearly" ? "bg-white shadow-sm" : "text-muted"
              }`}
            >
              Yearly <span className="text-[#166534] text-[13px]">2 months free</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10 text-left">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`relative rounded-[24px] p-[30px] flex flex-col ${
                p.featured
                  ? "bg-white shadow-[0_40px_80px_-50px_rgba(124,58,237,.6)]"
                  : "border border-line bg-paper"
              }`}
              style={
                p.featured
                  ? { border: "2px solid transparent", backgroundImage: "linear-gradient(#FFFFFF,#FFFFFF), linear-gradient(135deg,#7C3AED,#EC4899)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box" }
                  : undefined
              }
            >
              {p.featured && (
                <span className="absolute -top-3.5 left-[34px] px-3 py-1 rounded-full bg-gradient-to-r from-clay to-pink text-white text-[13px] font-bold">
                  Most popular
                </span>
              )}
              <div className="flex items-center justify-between gap-2.5">
                <div className="font-bold text-[18px]">{p.name}</div>
                {p.badge && (
                  <span className="px-2.5 py-1 rounded-full bg-agentWash text-clay text-xs font-bold">{p.badge}</span>
                )}
              </div>
              <div className="mt-2.5">
                <span className="font-serif font-medium text-[44px] tracking-tight">
                  {billing === "monthly" ? p.priceMonthly : p.priceYearly}
                </span>
                <span className="text-muted text-[15px]"> /month</span>
                {billing === "yearly" && (
                  <div className="text-[13px] text-[#166534] font-semibold">Billed yearly. 2 months free.</div>
                )}
              </div>
              <div className="text-[15px] text-muted mt-1">{p.tagline}</div>

              <div className="flex-1 flex flex-col gap-5 mt-6">
                {p.groups.map((g) => (
                  <div key={g.label}>
                    <div className="text-[11.5px] font-bold tracking-wide uppercase text-faint">{g.label}</div>
                    <ul className="grid gap-2 mt-2.5">
                      {g.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-[1.45] text-slate">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <Link
                href={`/auth?signup&plan=${p.key}`}
                className={`mt-7 text-center text-[15.5px] font-bold py-3.5 rounded-xl ${
                  p.featured ? "bg-gradient-to-r from-clay to-pink text-white" : "border border-slate text-slate"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-5 p-6 sm:p-7 rounded-[24px] bg-ivory flex flex-wrap gap-5 items-center">
          <div className="flex-1 min-w-[220px]">
            <div className="text-[13px] font-bold tracking-wide uppercase text-clay">Founding members</div>
            <div className="text-[18px] font-semibold mt-1">Join in the first 100 and you also get:</div>
          </div>
          <div className="flex-[2] min-w-[280px] grid gap-2.5">
            <div className="flex items-center gap-3 text-[15px]">
              <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-clay to-pink text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              <span><b>Your price never goes up.</b> Ever.</span>
            </div>
            <div className="flex items-center gap-3 text-[15px]">
              <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-gradient-to-br from-clay to-pink text-white">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              <span><b>16 ready-made sales campaigns,</b> free (the Sales Campaign Vault)</span>
            </div>
          </div>
        </div>
        <p className="text-[15px] text-slate mt-5">
          <b>No credits. No math.</b> Every email, text, ad and post in each campaign is included.{" "}
          <span className="text-muted">No free trial. Cancel anytime.</span>
        </p>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-ivory px-6 py-24">
        <div className="max-w-[720px] mx-auto flex flex-col gap-8">
          <div className="text-center flex flex-col gap-3">
            <h2 className="font-serif font-medium text-[32px] sm:text-[44px] leading-[1.1] tracking-tight">Questions</h2>
          </div>
          <div className="flex flex-col gap-2.5">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="border border-line rounded-2xl bg-paper overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-4 px-5 py-[18px] bg-transparent text-left"
                  >
                    <span className="text-[15px] font-semibold">{item.q}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5B6560"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300"
                    style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-[18px] text-[13.5px] leading-[1.65] text-muted">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="relative px-6 py-28 overflow-hidden bg-slate">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-50 bg-[length:200%_200%] animate-gradient-move"
          style={{ background: "linear-gradient(120deg, rgba(124,58,237,.35), rgba(236,72,153,.28), rgba(124,58,237,.35))" }}
        />
        <div className="max-w-[620px] mx-auto relative text-center flex flex-col items-center gap-[22px]">
          <h2 className="font-serif font-medium text-[34px] sm:text-[48px] leading-[1.1] tracking-tight text-white">
            Stop starting from zero.
            <br />
            <span className="text-[#F0ABFC] italic">Build on what already sold.</span>
          </h2>
          <p className="text-[17px] leading-[1.6] text-[#C9CCCF] max-w-[460px]">
            Every launch you run gets saved, with your winners marked. So the next one starts ahead. From $39 a month.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center pt-1">
            <Link
              href="/auth?signup"
              className="inline-flex items-center gap-2 text-[15px] font-bold text-slate px-[26px] py-4 rounded-xl bg-white"
            >
              Get started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a href="#pricing" className="inline-flex items-center min-h-[52px] px-[22px] rounded-xl border border-white/30 text-white font-semibold text-[15px]">
              See pricing
            </a>
          </div>
          <p className="font-mono text-xs text-[#9A9FA3]">Every launch makes the next one easier.</p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-14 border-t border-line">
        <div className="max-w-[1160px] mx-auto flex flex-wrap gap-10 justify-between">
          <div className="flex-1 min-w-[260px] max-w-[360px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
            <img src="/logo-lockup.png" alt="Campeos" className="h-6 w-auto object-contain" />
            <p className="text-[15px] leading-[1.6] text-muted mt-3.5">
              Build your next launch in one place. Never start from zero again.
            </p>
            <div className="flex items-center gap-2 mt-3.5 text-[14px] text-slate">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-clay to-pink text-white text-[11px] font-bold flex items-center justify-center">AS</span>
              By Ajay Sharma
            </div>
          </div>
          <div className="flex gap-12 flex-wrap text-[15px]">
            <div className="grid gap-2.5 content-start">
              <div className="font-bold">Product</div>
              <a href="#pricing" className="text-muted">Pricing</a>
              <a href="#features" className="text-muted">Campaigns</a>
              <a href="#faq" className="text-muted">Help</a>
            </div>
            <div className="grid gap-2.5 content-start">
              <div className="font-bold">Legal</div>
              <Link href="/terms" className="text-muted">Terms</Link>
              <Link href="/privacy" className="text-muted">Privacy</Link>
            </div>
            <div className="grid gap-2.5 content-start">
              <div className="font-bold">Contact</div>
              <a href="mailto:ajay@ajaysharma.co" className="text-muted">ajay@ajaysharma.co</a>
            </div>
          </div>
        </div>
        <div className="max-w-[1160px] mx-auto mt-9 text-[13px] text-faint">
          &copy; 2026 Campeos Solutions LTD, United Kingdom
        </div>
      </div>
    </div>
  );
}
