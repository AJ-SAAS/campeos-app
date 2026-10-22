"use client";

import { FirstTour } from "@/components/FirstTour";
import { MergeText } from "@/components/MergeText";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { PlanModal } from "@/components/PlanModal";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import {
  Campaign,
  CampaignStepDoc,
  deleteCampaign,
  getCampaignWithSteps,
  listCampaigns,
} from "@/lib/firebase/campaigns";
import { getBusinessProfile } from "@/lib/firebase/businessProfile";
import { getTemplate } from "@/lib/templates";
import { channelInfo, LogoStack, PlatformKey } from "@/components/builder/channels";
import {
  buildDays,
  CampaignSummary,
  formatWhen,
  greeting,
  campaignsForSalesDates,
  nextSalesDate,
  SalesDate,
  summarize,
  upcomingSalesDates,
  WeekDay,
  WeekItem,
} from "@/lib/dashboard";

// The dashboard (approved "Campeos dashboard" design, two views):
//
// - Paying users: "Good morning", the next big sales dates (Black Friday
//   and Cyber Monday together when they're close), today's messages as a
//   short list (the same rows as the campaign schedule), the rest of the
//   week folded into one row per day, their campaigns, and the
//   agent beside it all. Only the newest version of each campaign counts.
// - No plan yet (new users out of onboarding): "Welcome", their first
//   launch with the free steps written and the rest locked behind
//   "Unlock my launch". The Get started list floats bottom-right (it
//   comes with the Sidebar).

// Reading every step of every campaign is one Firestore read per
// campaign; the newest this many are plenty for "this week".
const MAX_CAMPAIGNS_FOR_WEEK = 15;

const CHANNEL_NAME: Record<string, string> = { ad: "Facebook ad", email: "Email", sms: "Text", social: "Post" };

export default function Dashboard() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [stepsById, setStepsById] = useState<Record<string, CampaignStepDoc[]>>({});
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [firstId, setFirstId] = useState<string | null>(null);
  const [userPlatforms, setUserPlatforms] = useState<string[]>([]);
  const [planOpen, setPlanOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!user) return;
    listCampaigns(user.uid)
      .then(async (list) => {
        setCampaigns(list);
        const withSteps = await Promise.all(
          list.slice(0, MAX_CAMPAIGNS_FOR_WEEK).map((c) => getCampaignWithSteps(c.id).catch(() => null))
        );
        const map: Record<string, CampaignStepDoc[]> = {};
        withSteps.forEach((r) => {
          if (r) map[r.campaign.id] = r.steps;
        });
        setStepsById(map);
        setStepsLoaded(true);
      })
      .catch(() => {
        setCampaigns([]);
        setStepsLoaded(true);
      });
    getBusinessProfile(user.uid)
      .then((p) => {
        setFirstId(p?.firstCampaignId ?? null);
        setUserPlatforms(p?.channels ?? []);
      })
      .catch(() => {});
  }, [user]);

  async function handleDelete(c: Campaign) {
    if (!window.confirm(`Delete "${c.title}" from ${new Date(c.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}? This can't be undone.`)) return;
    setDeletingId(c.id);
    try {
      await deleteCampaign(c.id, c.uid);
      setCampaigns((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    } catch {
      window.alert("Couldn't delete that campaign. Try again in a moment.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) return <LoadingScreen />;

  const showWelcome = !subLoading && !active;
  const firstName = (user?.displayName ?? "").split(" ")[0];

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {showWelcome && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="dashboard" />
        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-7 sm:px-8 lg:px-14 lg:py-10 pb-28 md:pb-12">
          {showWelcome ? (
            <WelcomeView
              now={now}
              firstName={firstName}
              campaigns={campaigns}
              stepsById={stepsById}
              firstId={firstId}
              onUnlock={() => setPlanOpen(true)}
            />
          ) : (
            <PaidView
              now={now}
              firstName={firstName}
              campaigns={campaigns}
              stepsById={stepsById}
              stepsLoaded={stepsLoaded}
              userPlatforms={userPlatforms}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          )}
        </main>
      </div>
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paying users                                                        */
/* ------------------------------------------------------------------ */

function PaidView({
  now,
  firstName,
  campaigns,
  stepsById,
  stepsLoaded,
  userPlatforms,
  deletingId,
  onDelete,
}: {
  now: Date;
  firstName: string;
  campaigns: Campaign[] | null;
  stepsById: Record<string, CampaignStepDoc[]>;
  stepsLoaded: boolean;
  userPlatforms: string[];
  deletingId: string | null;
  onDelete: (c: Campaign) => void;
}) {
  const loaded = stepsLoaded;
  const days = useMemo(
    () =>
      buildDays(
        now,
        (campaigns ?? []).filter((c) => stepsById[c.id]).map((c) => ({ campaign: c, steps: stepsById[c.id] }))
      ),
    [now, campaigns, stepsById]
  );
  const [today, ...later] = days;
  const todayLeft = today.items.filter((i) => i.status !== "Sent");
  const needs = todayLeft.filter((i) => i.status === "Add details" || i.status === "Not written").length;
  const laterDays = later.filter((d) => d.items.length > 0);
  const salesDates = useMemo(() => upcomingSalesDates(now), [now]);
  const builtFor = useMemo(
    () => campaignsForSalesDates(salesDates, campaigns ?? []),
    [salesDates, campaigns]
  );

  const summary = !loaded
    ? " "
    : today.items.length === 0
      ? laterDays.length
        ? `Nothing goes out today. Next up is ${laterDays[0].label} ${laterDays[0].num}.`
        : "Nothing goes out today."
      : todayLeft.length === 0
        ? "Everything for today has gone out."
        : `${todayLeft.length} ${todayLeft.length === 1 ? "message goes" : "messages go"} out today.${
            needs > 0 ? ` ${needs} ${needs === 1 ? "needs" : "need"} something from you.` : ""
          }`;

  return (
    <div className="max-w-[1180px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8 items-start">
      <div className="flex flex-col gap-6 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </div>
            <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.05] font-medium tracking-tight mt-1.5">
              {greeting(now)}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="text-[16px] text-muted mt-2 min-h-[24px]">{summary}</p>
          </div>
          <Link href="/campaigns" className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-slate text-white text-[15px] font-semibold">
            <PlusIcon /> New campaign
          </Link>
        </div>

        {salesDates.length > 0 && campaigns !== null && (
          <section
            aria-label="Big sales dates"
            className={`grid grid-cols-1 gap-3 ${salesDates.length > 1 ? "sm:grid-cols-2" : ""}`}
          >
            {salesDates.map((d) => (
              <SalesDateCard key={d.id} sale={d} campaign={builtFor[d.id]} />
            ))}
          </section>
        )}

        {/* Today: one row per message, the same rows as the campaign schedule */}
        <section aria-label="Today" className="border border-[#ECEAF0] rounded-[22px] overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-4 border-b border-[#F0F0F0]">
            <h2 className="text-[18px] font-semibold">Today</h2>
            <span className="font-mono text-xs text-muted">
              {today.label} {today.num}
            </span>
          </div>
          {!loaded ? (
            <div className="p-5 flex flex-col gap-2.5">
              <span className="h-12 rounded-xl bg-[#F5F5F7] animate-pulse" />
              <span className="h-12 rounded-xl bg-[#F5F5F7] animate-pulse" />
            </div>
          ) : today.items.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-[15px] font-semibold">Nothing goes out today</div>
              <div className="text-sm text-muted mt-1">
                {laterDays.length ? "Your next messages are below." : "Start a campaign, or ask the agent to build one."}
              </div>
            </div>
          ) : (
            <MessageList items={today.items} userPlatforms={userPlatforms} limit={6} />
          )}
        </section>

        {/* Coming up: one folded row per day */}
        {loaded && laterDays.length > 0 && (
          <section aria-label="Coming up">
            <h2 className="text-[15px] font-semibold text-muted mb-2.5">Coming up this week</h2>
            <div className="flex flex-col gap-2">
              {laterDays.map((d) => (
                <DayRow key={d.date.toISOString()} day={d} userPlatforms={userPlatforms} />
              ))}
            </div>
          </section>
        )}

        <CampaignList now={now} campaigns={campaigns} stepsById={stepsById} deletingId={deletingId} onDelete={onDelete} />
      </div>

      {/* The agent sits beside the day, always in reach */}
      <div className="min-w-0 lg:sticky lg:top-0 lg:h-[calc(100dvh-80px)] flex flex-col">
        <AgentPanel fill />
      </div>
    </div>
  );
}

/** A big sales date. "Plan it" opens the builder with that day as the
 * go-live date; once a campaign exists for it, "Continue" opens that. */
function SalesDateCard({ sale, campaign }: { sale: SalesDate; campaign?: Campaign }) {
  const ymd = `${sale.date.getFullYear()}-${String(sale.date.getMonth() + 1).padStart(2, "0")}-${String(sale.date.getDate()).padStart(2, "0")}`;
  const href = campaign ? `/builder?id=${campaign.id}` : `/builder?date=${ymd}`;
  const when = sale.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 rounded-[18px] bg-[#F8F8F8] border border-[#F0F0F0] hover:border-[#E3E1E8]"
    >
      <span className="w-12 h-12 shrink-0 rounded-[12px] bg-paper border border-[#ECEAF0] flex flex-col items-center justify-center">
        <span className="font-serif text-[20px] font-medium leading-none">{sale.days}</span>
        <span className="font-mono text-[8px] tracking-[.1em] text-muted mt-0.5">{sale.days === 1 ? "DAY" : "DAYS"}</span>
      </span>
      <span className="flex-grow min-w-0">
        <span className="block text-[15px] font-semibold truncate">{sale.name}</span>
        <span className="block text-[13px] text-muted mt-0.5 truncate">
          {when}
          {campaign ? " · Started" : ""}
        </span>
      </span>
      <span
        className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-sm font-semibold ${
          campaign ? "bg-paper border border-[#E3E1E8] text-slate" : "bg-slate text-white"
        }`}
      >
        {campaign ? "Continue" : "Plan it"} <ArrowIcon />
      </span>
    </Link>
  );
}

const ITEM_STATUS: Record<WeekItem["status"], { label: string; pill: string }> = {
  Sent: { label: "Sent", pill: "bg-[#F2F1F5] text-muted" },
  Ready: { label: "Ready", pill: "bg-[#DCFCE7] text-[#166534]" },
  "Add details": { label: "Needs input", pill: "bg-[#FFEDD5] text-[#9A3412]" },
  "Not written": { label: "Not written", pill: "bg-[#F2F1F5] text-muted" },
};

function MessageList({ items, userPlatforms, limit }: { items: WeekItem[]; userPlatforms: string[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = limit && !all ? items.slice(0, limit) : items;
  return (
    <div>
      {shown.map((it) => (
        <MessageRow key={`${it.campaignId}-${it.templateStepId}`} item={it} userPlatforms={userPlatforms} />
      ))}
      {limit && items.length > limit && (
        <button
          onClick={() => setAll(!all)}
          className="w-full px-5 py-3 text-sm font-semibold text-muted hover:text-slate border-t border-[#F5F4F7]"
        >
          {all ? "Show less" : `Show ${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}

function MessageRow({ item, userPlatforms }: { item: WeekItem; userPlatforms: string[] }) {
  const info = channelInfo(item.channel, userPlatforms);
  const st = ITEM_STATUS[item.status];
  return (
    <Link
      href={`/builder?id=${item.campaignId}`}
      title={`${item.title} · ${item.campaignTitle}`}
      className={`flex items-center gap-2.5 sm:gap-3.5 px-4 sm:px-5 py-3.5 border-t border-[#F5F4F7] first:border-t-0 hover:bg-[#FCFCFD] ${
        item.status === "Sent" ? "opacity-55" : ""
      }`}
    >
      <span className="w-[54px] sm:w-[62px] shrink-0 font-mono text-[11px] sm:text-[12px] text-muted">
        {item.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </span>
      <Logos platforms={info.platforms} />
      <span className="flex-grow min-w-0">
        <span className="block text-[15px] font-semibold truncate">{item.title}</span>
        <span className="block text-[13px] text-muted truncate">
          {info.name} · {item.campaignTitle}
        </span>
      </span>
      <span className={`shrink-0 text-[11px] font-bold px-[7px] py-px rounded-full ${st.pill}`}>{st.label}</span>
    </Link>
  );
}

/** Fixed-width logo cell so titles line up. Phones show one logo. */
function Logos({ platforms }: { platforms: PlatformKey[] }) {
  return (
    <>
      <span className="sm:hidden shrink-0 w-[30px] flex">
        <LogoStack platforms={platforms.slice(0, 1)} size={16} />
      </span>
      <span className="hidden sm:flex shrink-0 w-[74px]">
        <LogoStack platforms={platforms.slice(0, 3)} size={16} />
      </span>
    </>
  );
}

function DayRow({ day, userPlatforms }: { day: WeekDay; userPlatforms: string[] }) {
  const [open, setOpen] = useState(false);
  const platforms = Array.from(
    new Set(day.items.flatMap((i) => channelInfo(i.channel, userPlatforms).platforms))
  ) as PlatformKey[];
  const needs = day.items.filter((i) => i.status === "Add details" || i.status === "Not written").length;
  return (
    <div className="border border-[#ECEAF0] rounded-[16px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 sm:gap-3.5 px-4 sm:px-5 py-3.5 text-left hover:bg-[#FCFCFD]"
      >
        <span className="w-[54px] sm:w-[62px] shrink-0 text-[14px] font-semibold">
          {day.label} {day.num}
        </span>
        <Logos platforms={platforms} />
        <span className="flex-grow min-w-0 text-[14px] text-muted truncate">
          {day.items.length} {day.items.length === 1 ? "message" : "messages"}
          {needs > 0 && <span className="text-[#9A3412] font-semibold"> · {needs} need input</span>}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A39DAD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#F0F0F0]">
          <MessageList items={day.items} userPlatforms={userPlatforms} />
        </div>
      )}
    </div>
  );
}

function CampaignList({
  now,
  campaigns,
  stepsById,
  deletingId,
  onDelete,
}: {
  now: Date;
  campaigns: Campaign[] | null;
  stepsById: Record<string, CampaignStepDoc[]>;
  deletingId: string | null;
  onDelete: (c: Campaign) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Campaigns with the same name collapse into one row ("6 versions"),
  // newest first. Nothing is deleted for you; open the group to tidy up.
  const groups = useMemo(() => {
    const map = new Map<string, Campaign[]>();
    for (const c of campaigns ?? []) {
      const key = c.title.trim().toLowerCase();
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return Array.from(map.values());
  }, [campaigns]);
  const [showAll, setShowAll] = useState(false);
  const shownGroups = showAll ? groups : groups.slice(0, 4);

  return (
    <section aria-label="Your campaigns" className="min-w-0 border border-[#ECEAF0] rounded-[22px] overflow-hidden">
      <div className="flex items-center justify-between px-[22px] py-[18px] border-b border-[#F0F0F0]">
        <h2 className="text-[18px] font-semibold">Your campaigns</h2>
        <Link href="/campaigns" className="text-sm font-semibold text-[#5B21B6]">
          Browse templates
        </Link>
      </div>

      {campaigns === null ? (
        <div className="px-[22px] py-8 text-sm text-faint text-center">Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="px-[22px] py-8 text-sm text-muted text-center">
          No campaigns yet.{" "}
          <Link href="/campaigns" className="font-semibold text-slate underline underline-offset-2">
            Pick a template
          </Link>{" "}
          or ask the agent.
        </div>
      ) : (
        shownGroups.map((group) => {
          const main = group[0];
          const s = summarize(now, main, stepsById[main.id]);
          const key = main.title.trim().toLowerCase();
          return (
            <div key={main.id} className="border-b border-[#F5F4F7] last:border-b-0">
              <CampaignRow summary={s} now={now} loaded={!!stepsById[main.id]} />
              {group.length > 1 && (
                <>
                  <button
                    onClick={() => setOpenGroup(openGroup === key ? null : key)}
                    aria-expanded={openGroup === key}
                    className="w-full flex items-center gap-3 px-[22px] py-3 bg-[#FAFAFA] text-left text-sm text-muted hover:text-slate"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="4" width="16" height="16" rx="3" />
                      <path d="M9 12h6" />
                    </svg>
                    <span className="flex-grow">
                      {group.length - 1} older {group.length - 1 === 1 ? "version" : "versions"} of {main.title}
                    </span>
                    <span className="font-semibold text-slate">{openGroup === key ? "Hide" : "Tidy up"}</span>
                  </button>
                  {openGroup === key &&
                    group.slice(1).map((c) => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-3 pl-[50px] pr-[22px] py-2.5 bg-[#FAFAFA] text-sm ${deletingId === c.id ? "opacity-50" : ""}`}
                      >
                        <Link href={`/builder?id=${c.id}`} className="flex-grow min-w-0 truncate hover:underline">
                          {c.title}
                          <span className="text-muted">
                            {" "}
                            · {c.createdAt ? c.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "older"}
                          </span>
                        </Link>
                        <button
                          onClick={() => onDelete(c)}
                          disabled={deletingId === c.id}
                          className="shrink-0 h-8 px-3 rounded-lg border border-[#ECEAF0] bg-paper text-xs font-semibold text-dangerFg hover:border-dangerFg"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                </>
              )}
            </div>
          );
        })
      )}
      {groups.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-[22px] py-3 text-sm font-semibold text-muted hover:text-slate border-t border-[#F5F4F7]"
        >
          {showAll ? "Show less" : `Show all ${groups.length}`}
        </button>
      )}
    </section>
  );
}

function CampaignRow({ summary, now, loaded }: { summary: CampaignSummary; now: Date; loaded: boolean }) {
  const { campaign, total, written, status, next } = summary;
  let template = "Campaign";
  try {
    template = getTemplate(campaign.templateId).name;
  } catch {}
  const pill =
    status === "Live"
      ? "bg-[#DCFCE7] text-[#166534]"
      : status === "Done"
        ? "bg-[#EEF2FF] text-[#3730A3]"
        : "bg-[#F2F1F5] text-muted";
  const pct = total ? Math.round((written / total) * 100) : 0;
  return (
    <Link href={`/builder?id=${campaign.id}`} className="flex items-center gap-4 px-[22px] py-4 hover:bg-[#FCFCFD]">
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold truncate">{campaign.title}</span>
          {loaded && <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${pill}`}>{status}</span>}
        </div>
        <div className="text-[13px] text-muted mt-0.5 truncate">
          {template}
          {loaded && (next ? ` · Next: ${formatWhen(next.at, now)}, ${next.title}` : status === "Done" ? " · All sent" : " · No date set")}
        </div>
        {loaded && total > 0 && (
          <div className="flex items-center gap-2.5 mt-2.5">
            <span className="flex-1 max-w-[220px] h-[5px] rounded-full bg-[#F0EEF4] overflow-hidden">
              <span className="block h-full rounded-full bg-slate" style={{ width: `${pct}%` }} />
            </span>
            <span className="font-mono text-[11px] text-muted">
              {written} of {total} written
            </span>
          </div>
        )}
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A39DAD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* New users, no plan                                                  */
/* ------------------------------------------------------------------ */

function WelcomeView({
  now,
  firstName,
  campaigns,
  stepsById,
  firstId,
  onUnlock,
}: {
  now: Date;
  firstName: string;
  campaigns: Campaign[] | null;
  stepsById: Record<string, CampaignStepDoc[]>;
  firstId: string | null;
  onUnlock: () => void;
}) {
  const first = campaigns?.find((c) => c.id === firstId) ?? campaigns?.[campaigns.length - 1] ?? null;
  const steps = first ? stepsById[first.id] : undefined;
  const written = (steps ?? []).filter((s) => s.copy).length;
  const total = steps?.length ?? 0;
  const sales = nextSalesDate(now);

  return (
    <div className="max-w-[900px] flex flex-col gap-7">
      <div>
        <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">
          {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
        </div>
        <h1 className="font-serif text-[38px] sm:text-[48px] leading-[1.05] font-medium tracking-tight mt-1.5">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-[16px] text-muted mt-2">
          {first
            ? `${written} of ${total} messages written. Here's what goes out first.`
            : "Let's write your first launch. It takes about a minute."}
        </p>
      </div>

      <FirstLaunch campaign={first} steps={steps} loading={campaigns === null || (!!first && !steps)} onUnlock={onUnlock} />
      <FirstTour enabled={campaigns !== null && !(!!first && !steps)} />

      {sales && (
        <section aria-label="Next launch idea" className="flex flex-wrap items-center gap-4 px-[22px] py-5 rounded-[20px] border border-[#ECEAF0]">
          <div className="flex-[1_1_300px] min-w-0">
            <div className="text-[16px] font-semibold">
              {sales.name} is in {sales.days} {sales.days === 1 ? "day" : "days"}
            </div>
            <div className="text-sm text-muted mt-0.5">With a plan, your next launch takes about a minute. Same offer, new campaign.</div>
          </div>
          <Link href="/campaigns" className="inline-flex items-center h-11 px-4 rounded-xl border border-[#E3E1E8] text-[15px] font-semibold hover:bg-[#FAFAFA]">
            See all campaign types
          </Link>
        </section>
      )}
    </div>
  );
}

function FirstLaunch({
  campaign,
  steps,
  loading,
  onUnlock,
}: {
  campaign: Campaign | null;
  steps: CampaignStepDoc[] | undefined;
  loading: boolean;
  onUnlock: () => void;
}) {
  if (loading) return <section className="h-[360px] rounded-[26px] bg-[#F8F8F8] border border-[#F0F0F0] animate-pulse" />;

  if (!campaign) {
    return (
      <section data-tour="first-launch" className="flex flex-col gap-3 p-7 rounded-[26px] bg-[#F8F8F8] border border-[#F0F0F0]">
        <div className="text-sm text-muted">Your first launch</div>
        <div className="font-serif text-[32px] leading-tight font-medium tracking-tight">Ready to write</div>
        <p className="text-[15px] text-muted">
          Campeos writes your emails, texts, ads and posts from what you told it, and plans when each one goes out. You'll see the first ones appear in about a minute.
        </p>
        <Link
          data-tour="open-campaign"
          href="/builder?first=1"
          className="self-start mt-1 inline-flex items-center h-12 px-6 rounded-xl bg-slate text-white text-[15px] font-semibold"
        >
          Open your first campaign
        </Link>
      </section>
    );
  }

  const sorted = [...(steps ?? [])].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const written = sorted.filter((s) => s.copy);
  const locked = sorted.length - written.length;
  const channels = Array.from(new Set(sorted.map((s) => s.channel)));
  let template = "Campaign";
  try {
    template = getTemplate(campaign.templateId).name;
  } catch {}

  return (
    <section data-tour="first-launch" aria-label="Your first launch" className="flex flex-col gap-4 p-5 sm:p-[26px] rounded-[26px] bg-[#F8F8F8] border border-[#F0F0F0] animate-step-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">Your first launch</div>
          <div className="font-serif text-[32px] leading-tight font-medium tracking-tight">{template}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-muted">
            {campaign.offer.name} · {written.length} of {sorted.length} written ·
            {channels.map((c) => (
              <ChannelIcon key={c} channel={c} />
            ))}
          </div>
        </div>
        <Link
          data-tour="open-campaign"
          href={`/builder?id=${campaign.id}`}
          className="shrink-0 inline-flex items-center h-12 px-6 rounded-xl bg-slate text-white text-[15px] font-semibold"
        >
          Open your first campaign
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {written.length === 0 ? (
          <div className="bg-paper border border-[#ECEAF0] rounded-2xl px-[18px] py-5 text-sm text-muted">
            Nothing written yet.{" "}
            <Link href={`/builder?id=${campaign.id}`} className="font-semibold text-slate underline underline-offset-2">
              Open it to write your first steps.
            </Link>
          </div>
        ) : (
          written.slice(0, 3).map((s) => {
            const key = s.fields[0]?.key;
            const preview = (key && s.copy?.[key]) || Object.values(s.copy ?? {})[0] || "";
            const day = new Date(s.scheduledAt).toLocaleDateString(undefined, { weekday: "short" });
            return (
              <Link
                key={s.templateStepId}
                href={`/builder?id=${campaign.id}`}
                className="flex items-start gap-[18px] px-[18px] py-4 rounded-2xl bg-paper border border-[#ECEAF0] hover:border-[#CDB8F5]"
              >
                <span className="shrink-0 w-[132px] pt-0.5 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-[.06em] text-[#6D28D9]">
                  {CHANNEL_NAME[s.channel] ?? s.channel} · {day}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">{s.title}</span>
                  <span className="block text-sm text-muted mt-0.5 truncate"><MergeText text={preview} /></span>
                </span>
              </Link>
            );
          })
        )}

        {locked > 0 && written.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden">
            <div aria-hidden="true" className="flex flex-col gap-2 blur-[3px] opacity-55 select-none">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-[18px] p-[18px] rounded-2xl bg-paper border border-[#ECEAF0]">
                  <span className="w-[132px] h-2.5 rounded bg-[#E7E4EE]" />
                  <span className="flex-1 grid gap-2">
                    <span className="h-2.5 w-1/3 rounded bg-[#E7E4EE]" />
                    <span className="h-2.5 w-3/4 rounded bg-[#F0EEF4]" />
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div className="flex flex-wrap items-center justify-center gap-3 pl-3 pr-3.5 py-3 rounded-2xl bg-paper border border-[#ECEAF0] shadow-[0_20px_40px_-22px_rgba(23,19,31,.35)]">
                <span className="w-[34px] h-[34px] rounded-[10px] bg-[#F5F5F5] flex items-center justify-center">
                  <LockIcon />
                </span>
                <span className="text-[15px]">
                  <b>{locked} more messages</b> are written once you pick a plan.
                </span>
                <button onClick={onUnlock} className="text-[15px] font-semibold text-[#5B21B6] underline underline-offset-4">
                  See plans
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ChannelIcon({ channel }: { channel: string }) {
  const src = channel === "email" ? "/brand/email.png" : channel === "ad" ? "/brand/facebook.png" : channel === "social" ? "/brand/instagram.png" : null;
  if (!src) return <span title="Text" className="inline-block w-4 h-4 rounded-[4px] bg-[#34C759]" />;
  // eslint-disable-next-line @next/next/no-img-element -- local /public asset
  return <img src={src} alt={CHANNEL_NAME[channel] ?? channel} className="w-4 h-4 object-contain" />;
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#17131F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
