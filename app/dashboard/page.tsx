"use client";

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
import {
  buildWeek,
  CampaignSummary,
  formatWhen,
  greeting,
  nextSalesDate,
  summarize,
  WeekDay,
  WeekItem,
} from "@/lib/dashboard";

// The dashboard (approved "Campeos dashboard" design, two views):
//
// - Paying users: "Good morning", what's going out this week (a 7-day
//   strip of every email, ad and text), the next big sales date, their
//   campaigns with progress, and the agent.
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
      .then((p) => setFirstId(p?.firstCampaignId ?? null))
      .catch(() => {});
  }, [user]);

  async function handleDelete(c: Campaign) {
    if (!window.confirm(`Delete "${c.title}" from ${new Date(c.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}? This can't be undone.`)) return;
    setDeletingId(c.id);
    try {
      await deleteCampaign(c.id);
      setCampaigns((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    } catch {
      window.alert("Couldn't delete that campaign. Try again in a moment.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) return <div className="min-h-screen bg-paper" />;

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
  deletingId,
  onDelete,
}: {
  now: Date;
  firstName: string;
  campaigns: Campaign[] | null;
  stepsById: Record<string, CampaignStepDoc[]>;
  stepsLoaded: boolean;
  deletingId: string | null;
  onDelete: (c: Campaign) => void;
}) {
  const loaded = stepsLoaded;
  const week = useMemo(
    () =>
      buildWeek(
        now,
        (campaigns ?? []).filter((c) => stepsById[c.id]).map((c) => ({ campaign: c, steps: stepsById[c.id] }))
      ),
    [now, campaigns, stepsById]
  );
  const upcoming = week.flatMap((d) => d.items).filter((i) => i.status !== "Sent");
  const needs = upcoming.filter((i) => i.status === "Add details" || i.status === "Not written").length;
  const campaignCount = new Set(upcoming.map((i) => i.campaignId)).size;
  const sales = nextSalesDate(now);

  const summary =
    !loaded
      ? " "
      : upcoming.length === 0
        ? "Nothing is going out the rest of this week."
        : `${upcoming.length} ${upcoming.length === 1 ? "message" : "messages"} still go out this week, across ${campaignCount} ${campaignCount === 1 ? "campaign" : "campaigns"}.${
            needs > 0 ? ` ${needs} ${needs === 1 ? "needs" : "need"} something from you.` : ""
          }`;

  return (
    <div className="max-w-[1120px] flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-[.08em] text-muted">
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
          </div>
          <h1 className="font-serif text-[36px] sm:text-[44px] leading-[1.05] font-medium tracking-tight mt-1.5">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[16px] text-muted mt-2 min-h-[24px]">{summary}</p>
        </div>
        <div className="flex gap-2.5">
          <a href="#agent" className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-[#E3E1E8] text-[15px] font-semibold hover:bg-[#FAFAFA]">
            <SparkIcon /> Ask the agent
          </a>
          <Link href="/campaigns" className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl bg-slate text-white text-[15px] font-semibold">
            <PlusIcon /> New campaign
          </Link>
        </div>
      </div>

      {sales && sales.days <= 60 && (
        <section aria-label="Coming up" className="flex flex-wrap items-center gap-5 px-6 py-5 rounded-[22px] bg-[#F8F8F8] border border-[#F0F0F0]">
          <div className="w-[84px] h-[84px] rounded-[18px] bg-paper border border-[#ECEAF0] flex flex-col items-center justify-center">
            <div className="font-serif text-[36px] font-medium leading-none tracking-tight">{sales.days}</div>
            <div className="font-mono text-[10px] tracking-[.1em] text-muted mt-1">{sales.days === 1 ? "DAY" : "DAYS"}</div>
          </div>
          <div className="flex-[1_1_320px] min-w-0">
            <div className="text-[18px] font-semibold">
              {sales.name} is in {sales.days} {sales.days === 1 ? "day" : "days"}
            </div>
            <div className="text-[15px] text-muted mt-1 leading-relaxed">
              Most launches start 3 weeks out. Build yours now and every email, text and ad is ready before the rush.
            </div>
          </div>
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl text-white text-[15px] font-bold"
            style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
          >
            Plan my {sales.name} launch <ArrowIcon />
          </Link>
        </section>
      )}

      <section aria-label="Going out this week">
        <div className="flex items-baseline justify-between gap-3 mb-3.5">
          <h2 className="text-[20px] font-semibold tracking-tight">Going out this week</h2>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-7 gap-2.5 min-w-[920px]">
            {week.map((d) => (
              <DayColumn key={d.date.toISOString()} day={d} loaded={loaded} />
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-6 items-start">
        <CampaignList
          now={now}
          campaigns={campaigns}
          stepsById={stepsById}
          deletingId={deletingId}
          onDelete={onDelete}
        />
        <div className="flex-[1_1_340px] min-w-0">
          <AgentPanel />
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, loaded }: { day: WeekDay; loaded: boolean }) {
  return (
    <div
      className={`flex flex-col gap-2 p-3 rounded-[18px] min-h-[220px] ${
        day.isToday ? "bg-paper border-[1.5px] border-slate" : "bg-[#F8F8F8] border border-[#F0F0F0]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className={`text-[13px] font-semibold ${day.isToday ? "text-slate" : "text-muted"}`}>
          {day.isToday ? "Today" : day.label}
        </span>
        <span className="font-mono text-xs text-muted">{day.num}</span>
      </div>
      {day.items.map((it) => (
        <WeekCard key={`${it.campaignId}-${it.templateStepId}`} item={it} />
      ))}
      {loaded && day.items.length === 0 && <span className="text-xs text-[#A39DAD] mt-1">Nothing planned</span>}
      {!loaded && <span className="h-16 rounded-xl bg-paper/70 animate-pulse" />}
    </div>
  );
}

function WeekCard({ item }: { item: WeekItem }) {
  const color =
    item.status === "Sent" ? "text-muted" : item.status === "Ready" ? "text-[#15803D]" : "text-[#B45309]";
  return (
    <Link
      href={`/builder?id=${item.campaignId}`}
      title={`${item.title} · ${item.campaignTitle}`}
      className={`flex flex-col gap-1 p-2.5 rounded-xl bg-paper border border-[#ECEAF0] hover:border-[#CDB8F5] ${
        item.status === "Sent" ? "opacity-60" : ""
      }`}
    >
      <span className="flex items-center gap-1.5">
        <ChannelIcon channel={item.channel} />
        <span className="font-mono text-[11px] text-muted">
          {item.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
      </span>
      <span className="text-[13px] font-semibold leading-snug">{item.title}</span>
      <span className={`text-xs font-medium ${color}`}>{item.status}</span>
    </Link>
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

  return (
    <section aria-label="Your campaigns" className="flex-[1.35_1_480px] min-w-0 border border-[#ECEAF0] rounded-[22px] overflow-hidden">
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
        groups.map((group) => {
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
          {first ? "Your first launch is written. Here's a look at what goes out first." : "Let's build your first launch."}
        </p>
      </div>

      <FirstLaunch campaign={first} steps={steps} loading={campaigns === null || (!!first && !steps)} onUnlock={onUnlock} />

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
      <section className="flex flex-col gap-3 p-7 rounded-[26px] bg-[#F8F8F8] border border-[#F0F0F0]">
        <div className="text-sm text-muted">Your first launch</div>
        <div className="font-serif text-[32px] leading-tight font-medium tracking-tight">Nothing built yet</div>
        <p className="text-[15px] text-muted">Pick a campaign and Campeos writes it from your offer.</p>
        <Link href="/campaigns" className="self-start mt-1 inline-flex items-center h-11 px-5 rounded-xl bg-slate text-white text-sm font-semibold">
          Build my first launch
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
    <section aria-label="Your first launch" className="flex flex-col gap-4 p-5 sm:p-[26px] rounded-[26px] bg-[#F8F8F8] border border-[#F0F0F0] animate-step-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">Your first launch</div>
          <div className="font-serif text-[32px] leading-tight font-medium tracking-tight">{template}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[13px] text-muted">
            {campaign.offer.name} · {sorted.length} steps ·
            {channels.map((c) => (
              <ChannelIcon key={c} channel={c} />
            ))}
          </div>
        </div>
        <Link href={`/builder?id=${campaign.id}`} className="shrink-0 inline-flex items-center h-11 px-4 rounded-xl border border-[#E3E1E8] bg-paper text-[15px] font-semibold">
          Open timeline
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
                  <span className="block text-sm text-muted mt-0.5 truncate">{preview}</span>
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
                  <b>{locked} more steps.</b> Pick a plan to write and copy them all.
                </span>
                <button
                  onClick={onUnlock}
                  className="h-10 px-4 rounded-[10px] text-white text-sm font-bold"
                  style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                >
                  Unlock my launch
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
