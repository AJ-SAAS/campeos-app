import type { Channel } from "../templates/types";

// The answers collected by onboarding (app/onboarding/page.tsx) that are
// NOT part of the offer itself: where the user reaches their customers,
// and how often they run a sale. Both are saved on businessProfiles/{uid}
// next to the offer fields (see lib/firebase/businessProfile.ts) and read
// back by the builder (which steps to write) and the dashboard (which
// plan to suggest).

export const PLATFORMS = [
  { id: "email", label: "Email", icon: "/brand/email.png" },
  { id: "sms", label: "SMS", icon: null },
  { id: "facebook", label: "Facebook", icon: "/brand/facebook.png" },
  { id: "instagram", label: "Instagram", icon: "/brand/instagram.png" },
  { id: "tiktok", label: "TikTok", icon: "/brand/tiktok.png" },
  { id: "linkedin", label: "LinkedIn", icon: "/brand/linkedin.png" },
  { id: "threads", label: "Threads", icon: "/brand/threads.png" },
  { id: "youtube", label: "YouTube", icon: "/brand/youtube.png" },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export const DEFAULT_PLATFORMS: PlatformId[] = ["email", "sms", "facebook", "instagram"];

export const FREQUENCIES = [
  { id: "new", label: "I'm new to this", sub: "This is my first sale or launch" },
  { id: "rarely", label: "Once in a while", sub: "A few times a year" },
  { id: "monthly", label: "Every month", sub: "Something new most months" },
  { id: "weekly", label: "Every week", sub: "Always running something" },
  { id: "agency", label: "For clients", sub: "I do marketing for other businesses" },
] as const;

export type FrequencyId = (typeof FREQUENCIES)[number]["id"];

export type PlanId = "starter" | "pro";

/** "Once in a while" fits Starter (3 campaigns a month). Anyone who
 * launches monthly, weekly or for clients will hit that cap, so Pro. */
export function suggestedPlan(frequency: string | undefined): PlanId {
  return frequency === "rarely" || frequency === "new" ? "starter" : "pro";
}

/** What the user is launching. Only the webinar launch is built today; the
 * rest are on the way, and the screen says so up front (no surprise
 * Webinar after picking Black Friday). Titles come from the campaign
 * catalog so the two lists can't drift. */
export const LAUNCH_TYPE_IDS = ["webinar", "black-friday", "flash-sale-48h", "product-launch", "win-back"] as const;
export const LIVE_LAUNCH_TYPE = "webinar";

/** The date the campaign goes live, as yyyy-mm-dd in the user's time. */
export function launchDateInDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd -> 7 PM that day, local time. Null for anything else. */
export function launchDateToEvent(value: string | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 19, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** Whole days from today until a yyyy-mm-dd date (can be negative). */
export function daysUntil(value: string, from = new Date()): number {
  const d = launchDateToEvent(value);
  if (!d) return 0;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((end - start) / 86400000);
}

export const CURRENCIES = [
  { symbol: "$", label: "$ USD" },
  { symbol: "€", label: "€ EUR" },
  { symbol: "£", label: "£ GBP" },
  { symbol: "CA$", label: "CA$ CAD" },
  { symbol: "A$", label: "A$ AUD" },
  { symbol: "NZ$", label: "NZ$ NZD" },
  { symbol: "₹", label: "₹ INR" },
  { symbol: "R", label: "R ZAR" },
  { symbol: "CHF", label: "CHF" },
  { symbol: "kr", label: "kr" },
] as const;

/** A sensible starting currency from the browser's language. */
export function defaultCurrency(locale = ""): string {
  const l = locale.toLowerCase();
  if (l.endsWith("-gb") || l.endsWith("-ie")) return "£";
  if (l.endsWith("-ca")) return "CA$";
  if (l.endsWith("-au")) return "A$";
  if (l.endsWith("-nz")) return "NZ$";
  if (l.endsWith("-in")) return "₹";
  if (l.endsWith("-za")) return "R";
  if (l.endsWith("-ch")) return "CHF";
  if (/^(de|fr|es|it|nl|pt|fi|et|lv|lt|el|sk|sl)\b/.test(l) || /-(de|fr|es|it|nl|pt|fi|ee|lv|lt|gr|sk|si|at|be)$/.test(l)) return "€";
  if (/^(sv|da|nb|no)\b/.test(l)) return "kr";
  return "$";
}

/** "$997" -> { currency: "$", amount: "997" }. Anything else stays as typed. */
export function splitPrice(raw: string): { currency: string | null; amount: string } {
  const t = raw.trim();
  const sorted = [...CURRENCIES].map((c) => c.symbol).sort((a, b) => b.length - a.length);
  for (const sym of sorted) {
    if (t.startsWith(sym)) {
      const rest = t.slice(sym.length).trim();
      if (rest && /^[\d.,\s]/.test(rest)) return { currency: sym, amount: rest };
    }
  }
  return { currency: null, amount: t };
}

/** Puts the picked currency in front of a plain number. "97/mo", "$97" and
 * "Free" are left exactly as typed. */
export function joinPrice(currency: string, amount: string): string {
  const t = amount.trim();
  if (!t) return "";
  if (/^[\d.,\s]+(\/\s?\w+)?$/.test(t)) return `${currency}${t.replace(/\s+/g, "")}`;
  return t;
}

const SOCIAL: PlatformId[] = ["facebook", "instagram", "tiktok", "linkedin", "threads", "youtube"];
// Platforms people actually buy ads on. Threads has no ad product most
// of our users can use, so picking only Threads gives posts, not ads.
const AD_PLATFORMS: PlatformId[] = ["facebook", "instagram", "tiktok", "linkedin", "youtube"];

/**
 * Maps the platforms a user picked onto the template channels
 * (lib/templates/types.ts) so the builder only writes steps they'll use.
 * Returns null for "no preference saved" (older accounts) so callers
 * keep every step, the way the builder always worked before.
 */
export function templateChannelsFor(platforms: string[] | undefined): Set<Channel> | null {
  if (!platforms || platforms.length === 0) return null;
  const set = new Set<Channel>();
  if (platforms.includes("email")) set.add("email");
  if (platforms.includes("sms")) set.add("sms");
  if (platforms.some((p) => SOCIAL.includes(p as PlatformId))) set.add("social");
  if (platforms.some((p) => AD_PLATFORMS.includes(p as PlatformId))) set.add("ad");
  return set.size > 0 ? set : null;
}

/** Plain-English names for the template channels, for the builder's
 * "Writing for" line. */
export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  social: "Social posts",
  ad: "Ads",
};
