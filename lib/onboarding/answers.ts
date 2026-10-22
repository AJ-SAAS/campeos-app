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

/** What the user is launching. The eight most common campaigns, plus an
 * "I'm not sure" choice. Every campaign is built, so all of them start the
 * real thing; the full list lives on the Campaigns page. Titles come from
 * the campaign catalog so the two lists can't drift. */
export const LAUNCH_TYPE_IDS = [
  "webinar",
  "product-launch",
  "black-friday",
  "flash-sale-48h",
  "mini-launch",
  "lead-magnet",
  "book-a-call",
  "win-back",
] as const;
/** Someone who does not know yet. They start with the webinar launch,
 * which fits most offers, and can pick any other campaign later. */
export const NOT_SURE_LAUNCH_TYPE = "not-sure";
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

/**
 * The currencies on the price picker. `symbol` is what goes in front of the
 * number ("$997") and is also what's saved on the profile, so it has to be
 * different for every row: where a currency has no symbol of its own (or
 * shares one, like the three "kr"), the code stands in ("SEK 997").
 * `cc` is the country flag file in /public/flags.
 */
export interface Currency {
  symbol: string;
  code: string;
  name: string;
  cc: string;
}

export const CURRENCIES: readonly Currency[] = [
  { symbol: "$", code: "USD", name: "US dollar", cc: "us" },
  { symbol: "€", code: "EUR", name: "Euro", cc: "eu" },
  { symbol: "£", code: "GBP", name: "British pound", cc: "gb" },
  { symbol: "CA$", code: "CAD", name: "Canadian dollar", cc: "ca" },
  { symbol: "A$", code: "AUD", name: "Australian dollar", cc: "au" },
  { symbol: "NZ$", code: "NZD", name: "New Zealand dollar", cc: "nz" },
  { symbol: "₹", code: "INR", name: "Indian rupee", cc: "in" },
  { symbol: "R", code: "ZAR", name: "South African rand", cc: "za" },
  { symbol: "CHF", code: "CHF", name: "Swiss franc", cc: "ch" },
  { symbol: "SEK", code: "SEK", name: "Swedish krona", cc: "se" },
  { symbol: "NOK", code: "NOK", name: "Norwegian krone", cc: "no" },
  { symbol: "DKK", code: "DKK", name: "Danish krone", cc: "dk" },
  { symbol: "PLN", code: "PLN", name: "Polish zloty", cc: "pl" },
  { symbol: "CZK", code: "CZK", name: "Czech koruna", cc: "cz" },
  { symbol: "HUF", code: "HUF", name: "Hungarian forint", cc: "hu" },
  { symbol: "RON", code: "RON", name: "Romanian leu", cc: "ro" },
  { symbol: "BGN", code: "BGN", name: "Bulgarian lev", cc: "bg" },
  { symbol: "₺", code: "TRY", name: "Turkish lira", cc: "tr" },
  { symbol: "AED", code: "AED", name: "UAE dirham", cc: "ae" },
  { symbol: "SAR", code: "SAR", name: "Saudi riyal", cc: "sa" },
  { symbol: "₪", code: "ILS", name: "Israeli shekel", cc: "il" },
  { symbol: "S$", code: "SGD", name: "Singapore dollar", cc: "sg" },
  { symbol: "HK$", code: "HKD", name: "Hong Kong dollar", cc: "hk" },
  { symbol: "¥", code: "JPY", name: "Japanese yen", cc: "jp" },
  { symbol: "₩", code: "KRW", name: "South Korean won", cc: "kr" },
  { symbol: "CN¥", code: "CNY", name: "Chinese yuan", cc: "cn" },
  { symbol: "฿", code: "THB", name: "Thai baht", cc: "th" },
  { symbol: "RM", code: "MYR", name: "Malaysian ringgit", cc: "my" },
  { symbol: "₱", code: "PHP", name: "Philippine peso", cc: "ph" },
  { symbol: "Rp", code: "IDR", name: "Indonesian rupiah", cc: "id" },
  { symbol: "₫", code: "VND", name: "Vietnamese dong", cc: "vn" },
  { symbol: "MX$", code: "MXN", name: "Mexican peso", cc: "mx" },
  { symbol: "R$", code: "BRL", name: "Brazilian real", cc: "br" },
  { symbol: "ARS", code: "ARS", name: "Argentine peso", cc: "ar" },
  { symbol: "CLP", code: "CLP", name: "Chilean peso", cc: "cl" },
  { symbol: "COP", code: "COP", name: "Colombian peso", cc: "co" },
  { symbol: "₦", code: "NGN", name: "Nigerian naira", cc: "ng" },
  { symbol: "KSh", code: "KES", name: "Kenyan shilling", cc: "ke" },
  { symbol: "EGP", code: "EGP", name: "Egyptian pound", cc: "eg" },
];

/** The five most people use, shown first in the picker. */
export const POPULAR_CURRENCIES = ["$", "€", "£", "CA$", "A$"];

/** Finds a currency from what's saved: its symbol, or (for anything saved
 * before the bigger list) the old bare "kr", which meant Swedish krona. */
export function findCurrency(symbolOrCode: string | undefined): Currency | undefined {
  if (!symbolOrCode) return undefined;
  if (symbolOrCode === "kr") return CURRENCIES.find((c) => c.code === "SEK");
  return CURRENCIES.find((c) => c.symbol === symbolOrCode) ?? CURRENCIES.find((c) => c.code === symbolOrCode.toUpperCase());
}

/** A sensible starting currency from the browser's language. */
export function defaultCurrency(locale = ""): string {
  const l = locale.toLowerCase();
  const region = l.split("-")[1] ?? "";
  const byRegion: Record<string, string> = {
    gb: "£", ie: "€", ca: "CA$", au: "A$", nz: "NZ$", in: "₹", za: "R", ch: "CHF", se: "SEK", no: "NOK", dk: "DKK",
    pl: "PLN", cz: "CZK", hu: "HUF", ro: "RON", bg: "BGN", tr: "₺", ae: "AED", sa: "SAR", il: "₪", sg: "S$", hk: "HK$",
    jp: "¥", kr: "₩", cn: "CN¥", th: "฿", my: "RM", ph: "₱", id: "Rp", vn: "₫", mx: "MX$", br: "R$", ar: "ARS", cl: "CLP",
    co: "COP", ng: "₦", ke: "KSh", eg: "EGP",
    de: "€", fr: "€", es: "€", it: "€", nl: "€", pt: "€", fi: "€", ee: "€", lv: "€", lt: "€", gr: "€", sk: "€", si: "€", at: "€", be: "€",
  };
  if (byRegion[region]) return byRegion[region];
  if (/^(de|fr|es|it|nl|pt|fi|et|lv|lt|el|sk|sl)\b/.test(l)) return "€";
  if (/^(sv)\b/.test(l)) return "SEK";
  if (/^(da)\b/.test(l)) return "DKK";
  if (/^(nb|no)\b/.test(l)) return "NOK";
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
 * "Free" are left exactly as typed. Currencies written as letters get a
 * space ("SEK 997"). */
export function joinPrice(currency: string, amount: string): string {
  const t = amount.trim();
  if (!t) return "";
  if (/^[\d.,\s]+(\/\s?\w+)?$/.test(t)) {
    const num = t.replace(/\s+/g, "");
    const gap = currency.length > 1 && /[A-Za-z]$/.test(currency) ? " " : "";
    return `${currency}${gap}${num}`;
  }
  return t;
}

/** How an offer is paid for. Asked in onboarding, because "$97" could mean
 * once, every month or every year, and the copy changes with it. */
export const BILLING_OPTIONS = [
  { id: "once", label: "One-time", sub: "They pay once" },
  { id: "monthly", label: "Monthly", sub: "Every month" },
  { id: "yearly", label: "Yearly", sub: "Every year" },
] as const;

export type BillingId = (typeof BILLING_OPTIONS)[number]["id"];

/** A price with how it's paid, for showing to people: "$97 a month". */
export function priceLabel(price: string, billing: string | undefined): string {
  const t = (price ?? "").trim();
  if (!t || !/\d/.test(t)) return t;
  if (billing === "monthly") return `${t} a month`;
  if (billing === "yearly") return `${t} a year`;
  if (billing === "once") return `${t} one-time`;
  return t;
}

/** Reads "how they pay" out of a price someone typed or a page showed:
 * "$97/mo" is monthly, "$997/year" is yearly. Null when it doesn't say. */
export function billingFromPrice(price: string | undefined): BillingId | null {
  const t = (price ?? "").toLowerCase();
  if (/\/\s?(mo|month)|per month|monthly|a month/.test(t)) return "monthly";
  if (/\/\s?(yr|year)|per year|yearly|annual|a year/.test(t)) return "yearly";
  return null;
}

/** The ideal-customer one-liner: "[who] who want [result] but [what's in the way]". */
export const WHO_FORMULA = "Who they are + what they want + what's in the way";
export const WHO_EXAMPLES = [
  "Coaches who want more clients but hate cold DMs",
  "New moms who want to get fit but have no time",
  "Local shops who want more foot traffic but can't afford ads",
];

/** True when the line is too thin to write from: one or two words, like
 * "marketers". Used to nudge, never to block. */
export function whoIsThin(who: string): boolean {
  const words = who.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length < 4;
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
  if (platforms.some((p) => SOCIAL.includes(p as PlatformId))) set.add("video");
  if (platforms.some((p) => AD_PLATFORMS.includes(p as PlatformId))) set.add("ad");
  if (set.size > 0) set.add("store"); // a listing is a deliverable, not a platform
  return set.size > 0 ? set : null;
}

/** Plain-English names for the template channels, for the builder's
 * "Writing for" line. */
export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  social: "Social posts",
  video: "Videos",
  store: "App Store listing",
  ad: "Ads",
};
