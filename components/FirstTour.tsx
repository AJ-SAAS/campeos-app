"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// A short, one-time walk-through for brand-new accounts: three steps, each
// pointing at a real part of the Home screen (elements marked with
// data-tour="..."). Seen once, then remembered in this browser. Skipping
// counts as seen. Replaces "What is this?" with a plain answer.

const SEEN_KEY = "campeos.tourSeen";

const STEPS = [
  {
    target: "first-launch",
    title: "This is your first launch",
    body: "It's a full campaign for what you sell: emails, texts, ads and posts, each with the day and time it should go out.",
  },
  {
    target: "open-campaign",
    title: "Start here",
    body: "Open your campaign to watch the posts write themselves. Tap any post to read it, change it, or copy it.",
  },
  {
    target: "side-nav",
    title: "Everything else is in this menu",
    body: "Come back to Home any time. Add copy that already sold, sales-call notes, or start another campaign from here.",
  },
] as const;

export function FirstTour({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (seen) return;
    // Give the page a beat to lay out so the first spotlight lands right.
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [enabled]);

  function finish() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      // Hidden on this screen size (the side menu on phones): skip the spotlight.
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 350);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const pad = 8;

  // Card sits under the spotlight when there's room, above it otherwise.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(340, vw - 32);
  let cardStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + pad + 16 + 200 < vh;
    const left = Math.max(16, Math.min(rect.left, vw - cardW - 16));
    cardStyle = below
      ? { top: rect.bottom + pad + 14, left }
      : { top: Math.max(16, rect.top - pad - 14 - 190), left: Math.max(16, Math.min(rect.left, vw - cardW - 16)) };
    // Spotlight on the left menu: put the card to its right.
    if (s.target === "side-nav") cardStyle = { top: Math.max(16, rect.top + 24), left: Math.min(rect.right + 18, vw - cardW - 16) };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="A quick tour">
      {/* dim everything except the spotlight */}
      {rect ? (
        <div
          aria-hidden="true"
          className="absolute rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(23,19,31,.55), 0 0 0 3px #9B1FD6",
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[rgba(23,19,31,.55)]" />
      )}
      <div className="absolute inset-0" onClick={finish} aria-hidden="true" />

      <div
        className="absolute bg-paper rounded-2xl p-5 shadow-[0_30px_60px_-20px_rgba(23,19,31,.55)] animate-step-in"
        style={{ width: cardW, ...cardStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-[#6D28D9]">
          {step + 1} of {STEPS.length}
        </div>
        <div className="font-serif text-[24px] leading-tight font-medium tracking-tight mt-1">{s.title}</div>
        <p className="text-[15px] leading-relaxed text-muted mt-2">{s.body}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={finish} className="text-sm text-muted font-semibold min-h-10 px-1">
            Skip
          </button>
          <button
            onClick={() => (last ? finish() : setStep((n) => n + 1))}
            className="h-11 px-5 rounded-xl bg-slate text-white text-[15px] font-semibold"
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
