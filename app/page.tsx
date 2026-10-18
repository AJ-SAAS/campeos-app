"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { PlanKey } from "@/lib/stripe/client";

// The marketing/sales page at campeos.com — the first-touch page for
// everyone who isn't signed in yet. Previously "/" just redirected
// straight to /dashboard (see git history); now the dashboard is the
// *signed-in* home and this is the public one. A signed-in user who
// lands here (bookmark, back button, etc.) is bounced to /dashboard
// in the effect below instead of seeing the pitch again.
//
// Built from the approved "Campeos sales page" Design mockup. A few
// sections still carry bracketed placeholders ([Add your real version
// here], the Starter/Pro feature split, a refund policy) — those are
// facts only Ajay has, not content to invent. Replace them before this
// goes live for real traffic.

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

const STEPS = [
  { n: "1", title: "Tell Campeos your offer", body: "Price, audience, what they get. Paste your winning headlines or a sales call if you have them." },
  { n: "2", title: "Pick a campaign type", body: "Webinar launch, flash sale, product launch and more, each with its own proven structure." },
  { n: "3", title: "Get the full campaign", body: "Every ad, email and text, written, sequenced, and laid out on a timeline with real send times." },
];

const FEATURES = [
  {
    title: "Named copywriting techniques",
    body: 'Every step runs an actual technique, "curiosity-driven cold ad," "takeaway selling," "vulnerability and identification," not a vague prompt hoping for the best.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20l9-9-5-5-9 9-2 7z" />
        <path d="M14 6l4 4" />
      </svg>
    ),
  },
  {
    title: "A real persuasion checklist",
    body: "Each step leans on two or three levers pulled from a checklist built on Schwartz, Hopkins, Ogilvy and Halbert, never crammed with everything at once.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    title: "Your reading level, every time",
    body: "5th grade, 7th grade, 9th grade, or professional. Set it once and every piece of copy matches it.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    title: "Real send times, not just copy",
    body: "Every piece lands on a timeline with a real date and time, built off your actual launch or event date.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    title: "An agent that builds it for you",
    body: "Tell the Campeos agent what you need in plain English. It plans the timeline and writes the whole thing while you watch.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M12 8V4M9 4h6" />
        <circle cx="9" cy="14" r="1" />
        <circle cx="15" cy="14" r="1" />
      </svg>
    ),
  },
  {
    title: "Built from what already works",
    body: "Add your own winning headlines or a sales call transcript, and new copy is built on the language your buyers actually use.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
        <path d="M12 6v6l4 2" />
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

const PLANS: {
  key: PlanKey;
  name: string;
  price: string;
  cta: string;
  dark: boolean;
  items: string[];
}[] = [
  {
    key: "starter",
    name: "STARTER",
    price: "$39",
    cta: "Choose Starter",
    dark: false,
    items: [
      "Every campaign type",
      "The full persuasion and technique system",
      "Reading-level control",
      "Winning copy and sales-call library",
      "[Add campaigns-per-month limit]",
    ],
  },
  {
    key: "pro",
    name: "PRO",
    price: "$99",
    cta: "Choose Pro",
    dark: true,
    items: [
      "Everything in Starter",
      "The Campeos agent, full access",
      "[Add what makes Pro worth the upgrade]",
      "[Add campaigns-per-month limit]",
      "Priority support",
    ],
  },
];

const FAQS = [
  { q: "Is this just ChatGPT with extra steps?", a: "No. Every step in a campaign runs a named copywriting technique and a set structure, not a single open-ended prompt. That structure is the whole reason the copy sounds like it was planned, not generated." },
  { q: "Do I need my own OpenAI or Claude account?", a: "No. Generation is included in your plan. You never see or manage an API key." },
  { q: "Can I edit the copy after it is written?", a: "Yes. Edit any field by hand, or ask Campeos to change one thing at a time, like the angle or the length, right from the step." },
  { q: "Is there a free trial?", a: "No trial needed. Sign up free and look around the dashboard and the builder. You only subscribe once you generate your first full campaign." },
  { q: "Can I use my own winning headlines or past sales calls?", a: "Yes. Add winning copy or a sales-call transcript to your library, and new campaigns draw on the language that already worked for you." },
  { q: "[Add a refund or guarantee policy here]", a: "[Draft the answer once you decide on a guarantee.]" },
];

const MOCK_ROWS = [
  { lane: "AD", fg: "#1B6B4F", bg: "#DFF0E8", title: "Registration ad", delay: "0s", w: "150px" },
  { lane: "EMAIL", fg: "#1F5FA6", bg: "#E4EDF8", title: "You're invited", delay: ".3s", w: "110px" },
  { lane: "SMS", fg: "#6B4FA3", bg: "#ECE7F5", title: "Save your seat", delay: ".6s", w: "90px" },
  { lane: "EMAIL", fg: "#1F5FA6", bg: "#E4EDF8", title: "A confession", delay: ".9s", w: "130px" },
];

export default function MarketingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [level, setLevel] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Signed-in users who land on "/" (bookmark, back button) belong on
  // the dashboard — soft gate, so no subscription check gates it.
  // useRequireAccess (run from the dashboard itself) is what sends an
  // onboarding-incomplete user on to /onboarding instead.
  useEffect(() => {
    if (authLoading || !user) return;
    router.replace("/dashboard");
  }, [authLoading, user, router]);

  // Signed-in users get an empty shell for the instant it takes the
  // effect above to redirect, rather than a flash of the sales pitch.
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
            <a href="#how" className="text-[13px] text-muted font-medium">How it works</a>
            <a href="#features" className="text-[13px] text-muted font-medium">Features</a>
            <a href="#pricing" className="text-[13px] text-muted font-medium">Pricing</a>
            <a href="#faq" className="text-[13px] text-muted font-medium">FAQ</a>
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
      <div className="relative px-6 pt-[88px] pb-16 overflow-hidden">
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
            <div className="inline-flex self-start items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-agentWash border border-[#E6D9FB]">
              <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
              <span className="font-mono text-[11.5px] font-semibold text-clay tracking-wide">AI CAMPAIGN COPYWRITER</span>
            </div>
            <h1 className="font-display text-[42px] sm:text-[54px] leading-[1.04] font-extrabold max-w-[620px] tracking-tight">
              Stop starting every campaign from{" "}
              <span className="bg-gradient-to-r from-clay to-pink bg-clip-text text-transparent">zero.</span>
            </h1>
            <p className="text-lg leading-[1.55] text-muted max-w-[520px]">
              Give Campeos your offer. Pick a campaign type. Get every ad, email and text written, sequenced and timed, laid out on one timeline.
            </p>
            <div className="flex items-center gap-3.5 flex-wrap pt-1.5">
              <Link
                href="/auth?signup"
                className="inline-flex items-center gap-2 text-[15px] font-bold text-white px-[22px] py-3.5 rounded-xl bg-gradient-to-r from-clay to-pink shadow-[0_10px_30px_-10px_rgba(124,58,237,.55)]"
              >
                Get started
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <a href="#pricing" className="text-sm font-semibold text-slate px-2.5 py-3.5">See pricing &rarr;</a>
            </div>
            <p className="font-mono text-xs text-faint pt-0.5">Two plans. No free trial.</p>
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

      {/* WHO IT'S FOR */}
      <div className="max-w-[1200px] mx-auto px-6 pt-10 pb-[88px]">
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

      {/* HOW IT WORKS */}
      <div id="how" className="bg-ivory px-6 py-[88px]">
        <div className="max-w-[1000px] mx-auto flex flex-col gap-12">
          <div className="text-center flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-clay tracking-wider">HOW IT WORKS</span>
            <h2 className="font-display text-[34px] font-extrabold">From offer to full campaign in three steps</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-7">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col gap-3.5">
                <div className="font-mono w-10 h-10 rounded-xl bg-paper border border-line flex items-center justify-center font-bold text-[15px] text-clay">
                  {s.n}
                </div>
                <h3 className="font-display text-[17px] font-bold">{s.title}</h3>
                <p className="text-sm leading-[1.6] text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div id="features" className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="text-center flex flex-col gap-3 mb-14">
          <span className="font-mono text-xs font-bold text-clay tracking-wider">WHAT YOU GET</span>
          <h2 className="font-display text-[34px] font-extrabold">Not another blank prompt box</h2>
          <p className="text-base text-muted max-w-[560px] mx-auto">
            Every step in a Campeos campaign is built on a real structure, not a hope that the AI figures it out.
          </p>
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

        {/* Real, working reading-level demo — not a static mockup */}
        <div className="mt-7 border border-line rounded-[18px] p-8 bg-ivory flex flex-wrap gap-8 items-center">
          <div className="flex-1 min-w-[280px] flex flex-col gap-2.5">
            <h3 className="font-display text-[17px] font-bold">Try the reading-level slider</h3>
            <p className="text-[13.5px] leading-[1.6] text-muted">
              Every campaign gets written at the level your audience actually reads at. Drag it.
            </p>
          </div>
          <div className="flex-1 min-w-[260px] basis-[320px] flex flex-col gap-3.5 bg-paper border border-line rounded-2xl px-[22px] py-5">
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
            <div className="mt-1 px-3.5 py-3 rounded-[10px] bg-ivory text-[12.5px] leading-[1.6] text-slate">
              {activeLevel.sample}
            </div>
          </div>
        </div>
      </div>

      {/* WHY I BUILT THIS */}
      <div className="bg-slate text-white px-6 py-24">
        <div className="max-w-[760px] mx-auto flex flex-col gap-[22px]">
          <span className="font-mono text-xs font-bold text-pink tracking-wider">WHY I BUILT THIS</span>
          <h2 className="font-display text-[30px] font-extrabold">[Draft — Ajay, swap this for your own words]</h2>
          <p className="text-base leading-[1.75] text-[#C9CCCF]">
            Hi, I&apos;m Ajay. I run Facebook ad campaigns and webinars for my own products and for the brands I do marketing for. Every new launch meant the same thing: a blank doc, a new set of ads, emails and texts to write from scratch, again.
          </p>
          <p className="text-base leading-[1.75] text-[#C9CCCF]">
            [Add your real version here: what you were paying in time or money to get a campaign written, what you tried before this, the moment you decided to build it yourself.]
          </p>
          <p className="text-base leading-[1.75] text-[#C9CCCF]">
            So I built Campeos. Not a blank chat box, a system that writes a full campaign the way a real copywriter would plan one: named techniques, a reason for every send, real timing.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-clay to-pink flex items-center justify-center font-bold text-[15px]">A</div>
            <div>
              <div className="text-[13.5px] font-bold">Ajay Sharma</div>
              <div className="font-mono text-[11.5px] text-[#9A9FA3]">Founder, Campeos</div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" className="max-w-[1000px] mx-auto px-6 py-24">
        <div className="text-center flex flex-col gap-3 mb-12">
          <span className="font-mono text-xs font-bold text-clay tracking-wider">PRICING</span>
          <h2 className="font-display text-[34px] font-extrabold">Two plans. No free trial.</h2>
          <p className="text-[15px] text-muted">Pick one, create your account, and you&apos;re straight into the builder.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-[18px] p-[30px] flex flex-col gap-[18px] ${
                p.dark
                  ? "text-white shadow-[0_18px_40px_-16px_rgba(124,58,237,.55)] bg-gradient-to-br from-clay to-pink"
                  : "border border-line bg-paper"
              }`}
            >
              <div>
                <div className={`font-mono text-xs font-bold tracking-wide ${p.dark ? "text-white" : "text-muted"}`}>{p.name}</div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-[40px] font-extrabold">{p.price}</span>
                  <span className={`text-sm ${p.dark ? "text-white/75" : "text-faint"}`}>/month</span>
                </div>
              </div>
              <div className={`h-px ${p.dark ? "bg-white/20" : "bg-line"}`} />
              <ul className="flex flex-col gap-2.5">
                {p.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13.5px]">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={p.dark ? "#fff" : "#7C3AED"}
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 mt-0.5"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth?signup"
                className={`mt-1 text-center text-sm font-bold py-3 rounded-[11px] ${
                  p.dark ? "bg-white text-slate" : "bg-ivory text-slate border border-line"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="font-mono text-center text-[11.5px] text-faint mt-[18px]">
          [Add what&apos;s different between Starter and Pro — campaigns per month, included campaign types, anything else]
        </p>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-ivory px-6 py-24">
        <div className="max-w-[720px] mx-auto flex flex-col gap-8">
          <div className="text-center flex flex-col gap-3">
            <span className="font-mono text-xs font-bold text-clay tracking-wider">QUESTIONS</span>
            <h2 className="font-display text-[32px] font-extrabold">Before you sign up</h2>
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
          <h2 className="font-display text-4xl font-extrabold text-white leading-[1.15]">
            Write your next campaign in minutes, not days.
          </h2>
          <Link
            href="/auth?signup"
            className="inline-flex items-center gap-2 text-[15px] font-bold text-slate px-[26px] py-4 rounded-xl bg-white"
          >
            Get started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <p className="font-mono text-xs text-[#9A9FA3]">Two plans. No free trial.</p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-6 py-12 border-t border-line">
        <div className="max-w-[1200px] mx-auto flex flex-wrap gap-5 items-center justify-between">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
            <img src="/logo-lockup.png" alt="Campeos" className="h-5 w-auto object-contain" />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="font-mono text-[11.5px] text-faint">&copy; 2026 Campeos. Built for marketers who never start from zero.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="font-mono text-[11.5px] text-faint hover:text-muted">
                Privacy
              </Link>
              <Link href="/terms" className="font-mono text-[11.5px] text-faint hover:text-muted">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
