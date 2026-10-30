"use client";

// Browser-side helpers for the Meta Pixel. Everything is wrapped so a
// blocked cookie or blocked script can never break the page.

import { META_PIXEL_ID } from "./config";
import { CONSENT_CHANGED_EVENT, CONSENT_COOKIE, COUNTRY_COOKIE, Consent, parseConsent, readCookie, trackingAllowed } from "./consent";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function readConsent(): Consent {
  try {
    return parseConsent(readCookie(CONSENT_COOKIE, document.cookie));
  } catch {
    return null;
  }
}

export function readCountry(): string | null {
  try {
    return readCookie(COUNTRY_COOKIE, document.cookie);
  } catch {
    return null;
  }
}

export function setConsent(value: "granted" | "denied") {
  try {
    document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function canTrack(): boolean {
  // A browser's Global Privacy Control signal counts as an opt-out.
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
  } catch {
    /* ignore */
  }
  return trackingAllowed(readConsent(), readCountry());
}

/** Loads Meta's script once. Safe to call again. */
export function loadPixel(): void {
  if (typeof window === "undefined" || window.fbq) return;
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else (n.queue as unknown[]).push(args);
  } as Fbq;
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  // Keep the data clean: no automatic button-click or form events. The only
  // events Meta ever sees are PageView and the one Purchase.
  n("set", "autoConfig", false, META_PIXEL_ID);
  n("init", META_PIXEL_ID);
}

export function trackPageView(): void {
  try {
    window.fbq?.("track", "PageView");
  } catch {
    /* ignore */
  }
}

/** The one conversion. eventID is the Stripe session id, same as the server copy. */
export function trackPurchase(args: { eventId: string; value: number; currency: string }): void {
  try {
    window.fbq?.("track", "Purchase", { value: args.value, currency: args.currency }, { eventID: args.eventId });
  } catch {
    /* ignore */
  }
}

/** What the server needs, at checkout time, to send a good Purchase later. */
export function readAttribution(): { fbp?: string; fbc?: string; consent: boolean; sourceUrl: string } {
  let fbp: string | undefined;
  let fbc: string | undefined;
  try {
    fbp = readCookie("_fbp", document.cookie) ?? undefined;
    fbc = readCookie("_fbc", document.cookie) ?? undefined;
  } catch {
    /* ignore */
  }
  return { fbp, fbc, consent: canTrack(), sourceUrl: typeof location !== "undefined" ? location.origin + "/welcome" : "" };
}
