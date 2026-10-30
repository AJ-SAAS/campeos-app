"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readConsent, readCountry, setConsent } from "@/lib/meta/browser";
import { isOptOutRegion } from "@/lib/meta/consent";

// A small notice at the bottom of the page. In the US it says ads are
// measured and lets people opt out. Elsewhere it asks first.
// Any link with data-privacy-choices (the footer's "Your privacy choices")
// opens it again.
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [optOut, setOptOut] = useState(true);

  useEffect(() => {
    setOptOut(isOptOutRegion(readCountry()));
    setOpen(readConsent() === null);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-privacy-choices]");
      if (!el) return;
      e.preventDefault();
      setOptOut(isOptOutRegion(readCountry()));
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!open) return null;

  const choose = (v: "granted" | "denied") => {
    setConsent(v);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Privacy choices"
      className="fixed z-[60] left-3 right-3 bottom-3 sm:left-5 sm:right-auto sm:bottom-5 sm:max-w-[420px] rounded-[22px] border border-[#ECEAF0] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(23,19,31,.35)]"
    >
      <p className="text-[13.5px] leading-relaxed text-slate">
        {optOut
          ? "We use cookies to measure how our ads perform. You can opt out any time."
          : "Can we use cookies to measure how our ads perform? It stays off unless you say yes."}{" "}
        <Link href="/privacy" className="font-semibold underline">
          Privacy
        </Link>
      </p>
      <div className="mt-3 flex items-center gap-2">
        {optOut ? (
          <>
            <button onClick={() => choose("granted")} className="h-9 px-4 rounded-full bg-[#0D0A1A] text-white text-[13px] font-semibold">
              Got it
            </button>
            <button onClick={() => choose("denied")} className="h-9 px-4 rounded-full bg-[#F6F4FA] text-[13px] font-semibold text-muted hover:bg-[#EEEAF6]">
              Opt out
            </button>
          </>
        ) : (
          <>
            <button onClick={() => choose("granted")} className="h-9 px-4 rounded-full bg-[#0D0A1A] text-white text-[13px] font-semibold">
              Accept
            </button>
            <button onClick={() => choose("denied")} className="h-9 px-4 rounded-full bg-[#F6F4FA] text-[13px] font-semibold text-muted hover:bg-[#EEEAF6]">
              Decline
            </button>
          </>
        )}
      </div>
    </div>
  );
}
