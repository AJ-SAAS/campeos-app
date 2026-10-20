import { Campaign, CampaignStepDoc } from "@/lib/firebase/campaigns";

// Pure helpers behind the dashboard (app/dashboard/page.tsx): the week
// strip, each campaign's progress line, and the next big sales date.
// No Firestore here, so it's easy to reason about.

export interface WeekItem {
  campaignId: string;
  campaignTitle: string;
  templateStepId: string;
  channel: string;
  title: string;
  at: Date;
  status: "Sent" | "Ready" | "Add details" | "Not written";
}

export interface WeekDay {
  date: Date;
  label: string;
  num: string;
  isToday: boolean;
  items: WeekItem[];
}

/** Matches CLAUDE.md's [ALL CAPS] placeholders, the same test the builder's
 * Timeline uses for its "Add details" tag. */
const PLACEHOLDER = /\[[A-Z][A-Z0-9 _'&/-]{1,}\]/;

export function needsInput(copy: Record<string, string> | null | undefined): boolean {
  if (!copy) return false;
  return PLACEHOLDER.test(Object.values(copy).join(" "));
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function buildWeek(
  now: Date,
  campaigns: { campaign: Campaign; steps: CampaignStepDoc[] }[]
): WeekDay[] {
  const start = startOfWeek(now);
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      num: String(date.getDate()),
      isToday: date.toDateString() === now.toDateString(),
      items: [],
    });
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  for (const { campaign, steps } of campaigns) {
    for (const s of steps) {
      const at = new Date(s.scheduledAt);
      if (at < start || at >= end) continue;
      const day = days[(((at.getDay() + 6) % 7) + 7) % 7];
      const status: WeekItem["status"] =
        at < now ? "Sent" : !s.copy ? "Not written" : needsInput(s.copy) ? "Add details" : "Ready";
      day.items.push({
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        templateStepId: s.templateStepId,
        channel: s.channel,
        title: s.title,
        at,
        status,
      });
    }
  }
  for (const d of days) d.items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return days;
}

/**
 * One campaign per name: the newest. listCampaigns() returns newest
 * first, so older copies of "Fall Reset Program" drop out here and stop
 * filling the dashboard with the same email five times.
 */
export function latestVersions(campaigns: Campaign[]): Campaign[] {
  const seen = new Set<string>();
  return campaigns.filter((c) => {
    const key = c.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Today plus the next (count - 1) days, for the dashboard's "Today" list
 * and the folded "Coming up" rows. Only the newest version of each
 * campaign counts, and messages switched off in the builder
 * (skippedSteps / skippedChannels) are left out.
 */
export function buildDays(
  now: Date,
  campaigns: { campaign: Campaign; steps: CampaignStepDoc[] }[],
  count = 7
): WeekDay[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: WeekDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      num: String(date.getDate()),
      isToday: i === 0,
      items: [],
    });
  }
  const end = new Date(start);
  end.setDate(start.getDate() + count);

  const latest = new Set(latestVersions(campaigns.map((c) => c.campaign)).map((c) => c.id));
  for (const { campaign, steps } of campaigns) {
    if (!latest.has(campaign.id)) continue;
    const offSteps = new Set(campaign.skippedSteps ?? []);
    const offChannels = new Set(campaign.skippedChannels ?? []);
    for (const s of steps) {
      if (offSteps.has(s.templateStepId) || offChannels.has(s.channel)) continue;
      const at = new Date(s.scheduledAt);
      if (at < start || at >= end) continue;
      const idx = Math.round(
        (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - start.getTime()) / 86400000
      );
      const day = days[idx];
      if (!day) continue;
      const status: WeekItem["status"] =
        at < now ? "Sent" : !s.copy ? "Not written" : needsInput(s.copy) ? "Add details" : "Ready";
      day.items.push({
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        templateStepId: s.templateStepId,
        channel: s.channel,
        title: s.title,
        at,
        status,
      });
    }
  }
  for (const d of days) d.items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return days;
}

export interface CampaignSummary {
  campaign: Campaign;
  total: number;
  written: number;
  status: "Live" | "Draft" | "Done";
  next: { title: string; at: Date } | null;
}

export function summarize(
  now: Date,
  campaign: Campaign,
  steps: CampaignStepDoc[] | undefined
): CampaignSummary {
  const list = steps ?? [];
  const written = list.filter((s) => s.copy).length;
  const upcoming = list
    .map((s) => ({ title: s.title, at: new Date(s.scheduledAt) }))
    .filter((s) => s.at >= now)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const status: CampaignSummary["status"] =
    written === 0 ? "Draft" : upcoming.length === 0 && list.length > 0 ? "Done" : "Live";
  return { campaign, total: list.length, written, status, next: upcoming[0] ?? null };
}

export function formatWhen(at: Date, now: Date): string {
  const time = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (at.toDateString() === now.toDateString()) return `today ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (at.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  const inWeek = at.getTime() - now.getTime() < 6 * 86400000;
  return inWeek
    ? `${at.toLocaleDateString(undefined, { weekday: "short" })} ${time}`
    : `${at.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

import { SalesDate, salesCalendar } from "./salesCalendar";
export { salesCalendar, upcomingSalesDates } from "./salesCalendar";
export type { SalesDate } from "./salesCalendar";

/**
 * Which campaign (if any) is already built for each sales date: one
 * made from that date's template, or one that goes live within 2 days
 * of it (the closest date wins, so a Black Friday launch never counts
 * for Cyber Monday too). campaigns should be newest first.
 */
export function campaignsForSalesDates(
  dates: SalesDate[],
  campaigns: Campaign[]
): Record<string, Campaign | undefined> {
  const calendar = dates;
  const out: Record<string, Campaign | undefined> = {};
  for (const c of campaigns) {
    let match = calendar.find((d) => d.id === c.templateId);
    if (!match) {
      const at = new Date(c.eventDate).getTime();
      if (isNaN(at)) continue;
      let best: { d: SalesDate; gap: number } | null = null;
      for (const d of calendar) {
        const gap = Math.abs(at - d.date.getTime()) / 86400000;
        if (gap <= 2 && (!best || gap < best.gap)) best = { d, gap };
      }
      match = best?.d;
    }
    if (match && !out[match.id]) out[match.id] = c;
  }
  return out;
}

/** The next big sales date, the same list as the sales page countdown. */
export function nextSalesDate(now: Date): { name: string; days: number } | undefined {
  const next = salesCalendar(now)[0];
  return next ? { name: next.name, days: next.days } : undefined;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
