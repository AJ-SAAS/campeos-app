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
  return frequency === "rarely" ? "starter" : "pro";
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
