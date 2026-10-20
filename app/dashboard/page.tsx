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
import { listCallThemes, listWinningCopy } from "@/lib/firebase/library";
import { getTemplate } from "@/lib/templates";

// The dashboard has two jobs, depending on who's looking:
//
// - No plan yet (new users, straight out of onboarding): the approved
//   "Welcome" layout. Their first launch with the free steps written and
//   the rest locked, a short "Get started" checklist, and the plan
//   picker one tap away.
// - Paying users: the working dashboard they already know. The agent and
//   their campaigns list stay front and center, nothing else in the way.

const CHANNEL_NAME: Record<string, string> = {
  ad: "Facebook ad",
  email: "Email",
  sms: "Text",
  social: "Post",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  // Only needed for the no-plan view.
  const [firstId, setFirstId] = useState<string | null>(null);
  const [first, setFirst] = useState<{ campaign: Campaign; steps: CampaignStepDoc[] } | null>(null);
  const [winnerCount, setWinnerCount] = useState(0);
  const [callCount, setCallCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCampaigns(null);
      return;
    }
    listCampaigns(user.uid).then(setCampaigns).catch(() => setCampaigns([]));
  }, [user]);

  const showWelcome = !subLoading && !active;

  useEffect(() => {
    if (!user || !showWelcome) return;
    getBusinessProfile(user.uid)
      .then((p) => setFirstId(p?.firstCampaignId ?? null))
      .catch(() => {});
    listWinningCopy(user.uid).then((w) => setWinnerCount(w.length)).catch(() => {});
    listCallThemes(user.uid).then((c) => setCallCount(c.length)).catch(() => {});
  }, [user, showWelcome]);

  // The first launch: the campaign onboarding built, or else their newest.
  const firstCampaignId = firstId ?? campaigns?.[campaigns.length - 1]?.id ?? null;
  useEffect(() => {
    if (!showWelcome || !firstCampaignId) return;
    getCampaignWithSteps(firstCampaignId).then(setFirst).catch(() => {});
  }, [showWelcome, firstCampaignId]);

  async function handleDelete(campaign: Campaign) {
    const ok = window.confirm(
      `Delete "${campaign.title}"? This can't be undone. Every step and its copy will be deleted.`
    );
    if (!ok) return;
    setDeletingId(campaign.id);
    try {
      await deleteCampaign(campaign.id);
      setCampaigns((prev) => prev?.filter((c) => c.id !== campaign.id) ?? prev);
      if (campaign.id === firstCampaignId) setFirst(null);
    } catch {
      window.alert("Couldn't delete that campaign. Try again in a moment.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  const firstName = (user?.displayName ?? "").split(" ")[0];
  const hasCampaigns = (campaigns?.length ?? 0) > 0;

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      {showWelcome && <SubscribeBanner />}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="dashboard" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-6 lg:gap-8 pb-24 md:pb-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="font-mono text-xs uppercase tracking-wider text-faint">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </div>
              {showWelcome ? (
                <>
                  <h1 className="font-serif text-[34px] sm:text-[44px] leading-[1.05] font-medium tracking-tight">
                    {firstName ? `Welcome, ${firstName}` : "Welcome"}
                  </h1>
                  <p className="text-[15px] text-muted">
                    {hasCampaigns
                      ? "Your first launch is written. Here's what's next."
                      : "Let's build your first launch."}
                  </p>
                </>
              ) : (
                <h1 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] leading-tight font-semibold tracking-tight">
                  Your campaigns
                </h1>
              )}
            </div>
            <Link
              href="/campaigns"
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-line bg-paper text-slate text-sm font-semibold"
            >
              <PlusIcon /> New campaign
            </Link>
          </div>

          {showWelcome && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 items-start">
              <FirstLaunchCard
                data={first}
                hasCampaigns={hasCampaigns}
                onUnlock={() => setPlanOpen(true)}
              />
              <GetStarted
                built={hasCampaigns}
                winners={winnerCount > 0}
                calls={callCount > 0}
                onPickPlan={() => setPlanOpen(true)}
              />
            </div>
          )}

          <div
            className={`grid grid-cols-1 gap-6 items-start ${
              showWelcome ? "" : "lg:grid-cols-[1.25fr_1fr]"
            }`}
          >
            {/* Free accounts can't have the agent build anything yet, so
                it only shows for paying users. */}
            {!showWelcome && <AgentPanel />}

            <section aria-label="Campaigns" className="bg-paper border border-line rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <h2 className="font-display text-sm font-semibold">
                  {showWelcome ? "All your campaigns" : "Your campaigns"}
                </h2>
                <Link href="/campaigns" className="text-xs font-semibold text-clay">
                  Browse templates
                </Link>
              </div>

              {campaigns === null ? (
                <div className="px-4 py-6 text-sm text-faint text-center">Loading...</div>
              ) : campaigns.length === 0 ? (
                <div className="px-4 py-6 text-sm text-faint text-center">
                  No campaigns yet. Pick a template to start one.
                </div>
              ) : (
                campaigns.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/builder?id=${c.id}`}
                    className={`group flex items-center gap-3 px-4 py-3 ${
                      i < campaigns.length - 1 ? "border-b border-line" : ""
                    } ${deletingId === c.id ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="flex-grow min-w-0">
                      <div className="text-[13.5px] font-semibold truncate">{c.title}</div>
                      <div className="text-xs text-faint truncate">{c.offer.audience}</div>
                    </div>
                    <div className="font-mono text-xs text-muted shrink-0">
                      {new Date(c.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${c.title}`}
                      disabled={deletingId === c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(c);
                      }}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-faint opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-ivory hover:text-dangerFg transition-opacity"
                    >
                      <TrashIcon />
                    </button>
                  </Link>
                ))
              )}
            </section>
          </div>
        </main>
      </div>
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}

function FirstLaunchCard({
  data,
  hasCampaigns,
  onUnlock,
}: {
  data: { campaign: Campaign; steps: CampaignStepDoc[] } | null;
  hasCampaigns: boolean;
  onUnlock: () => void;
}) {
  const sorted = useMemo(
    () =>
      data
        ? [...data.steps].sort(
            (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
          )
        : [],
    [data]
  );

  if (!hasCampaigns) {
    return (
      <section className="bg-[#F8F8F8] border border-[#F0F0F0] rounded-3xl p-6 sm:p-8 flex flex-col gap-3 animate-step-in">
        <div className="text-sm text-muted">Your first launch</div>
        <div className="font-serif text-[30px] leading-tight font-medium tracking-tight">
          Nothing built yet
        </div>
        <p className="text-[15px] text-muted">Pick a template and Campeos writes it from your offer.</p>
        <Link
          href="/campaigns"
          className="self-start mt-1 inline-flex items-center h-11 px-5 rounded-xl bg-slate text-white text-sm font-semibold"
        >
          Build my first launch
        </Link>
      </section>
    );
  }

  if (!data) {
    return <section className="h-[320px] rounded-3xl bg-[#F8F8F8] border border-[#F0F0F0] animate-pulse" />;
  }

  const written = sorted.filter((s) => s.copy);
  const lockedCount = sorted.length - written.length;
  const channels = Array.from(new Set(sorted.map((s) => CHANNEL_NAME[s.channel] ?? s.channel)));
  let templateName = "Campaign";
  try {
    templateName = getTemplate(data.campaign.templateId).name;
  } catch {}

  return (
    <section
      aria-label="Your first launch"
      className="bg-[#F8F8F8] border border-[#F0F0F0] rounded-3xl p-5 sm:p-7 flex flex-col gap-4 animate-step-in"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">Your first launch</div>
          <div className="font-serif text-[30px] leading-tight font-medium tracking-tight">{templateName}</div>
          <div className="text-[13px] text-muted mt-0.5">
            {data.campaign.offer.name} · {sorted.length} steps · {channels.join(", ")}
          </div>
        </div>
        <Link
          href={`/builder?id=${data.campaign.id}`}
          className="shrink-0 inline-flex items-center h-10 px-4 rounded-xl border border-line bg-paper text-sm font-semibold"
        >
          Open timeline
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {written.length === 0 ? (
          <div className="bg-paper border border-line rounded-2xl px-4 py-5 text-sm text-muted">
            No steps written yet.{" "}
            <Link href={`/builder?id=${data.campaign.id}`} className="font-semibold text-slate underline underline-offset-2">
              Open it to write your first steps.
            </Link>
          </div>
        ) : (
          written.slice(0, 3).map((s) => {
            const firstField = s.fields[0]?.key;
            const preview = (firstField && s.copy?.[firstField]) || Object.values(s.copy ?? {})[0] || "";
            const day = new Date(s.scheduledAt).toLocaleDateString(undefined, { weekday: "short" });
            return (
              <Link
                key={s.templateStepId}
                href={`/builder?id=${data.campaign.id}`}
                className="flex items-start gap-4 bg-paper border border-line rounded-2xl px-4 py-3.5 hover:border-[#CDB8F5]"
              >
                <span className="shrink-0 w-[150px] pt-0.5 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-wider text-clay">
                  {CHANNEL_NAME[s.channel] ?? s.channel} · {day}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{s.title}</span>
                  <span className="block text-[13px] text-muted truncate">{preview}</span>
                </span>
              </Link>
            );
          })
        )}

        {lockedCount > 0 && written.length > 0 && (
          <div className="relative rounded-2xl overflow-hidden">
            <div aria-hidden="true" className="flex flex-col gap-2 blur-[3px] opacity-60 select-none">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-4 bg-paper border border-line rounded-2xl px-4 py-4">
                  <span className="w-[150px] h-2.5 rounded bg-[#ECEAF0]" />
                  <span className="flex-1 flex flex-col gap-2">
                    <span className="h-2.5 w-1/3 rounded bg-[#ECEAF0]" />
                    <span className="h-2.5 w-3/4 rounded bg-[#F2F1F5]" />
                  </span>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div className="flex flex-wrap items-center justify-center gap-3 bg-paper border border-line rounded-2xl px-4 py-3 shadow-[0_20px_40px_-24px_rgba(23,19,31,.35)]">
                <span className="w-8 h-8 rounded-lg bg-ivory flex items-center justify-center">
                  <LockIcon />
                </span>
                <span className="text-sm">
                  <b>{lockedCount} more steps.</b> Pick a plan to write and copy them all.
                </span>
                <button
                  onClick={onUnlock}
                  className="h-9 px-4 rounded-lg text-white text-sm font-bold"
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

function GetStarted({
  built,
  winners,
  calls,
  onPickPlan,
}: {
  built: boolean;
  winners: boolean;
  calls: boolean;
  onPickPlan: () => void;
}) {
  const items = [
    { done: built, title: "Build your first launch", href: "/campaigns" },
    {
      done: false,
      title: "Pick a plan",
      sub: "Write every step, copy them, and build more launches.",
      action: onPickPlan,
    },
    { done: winners, title: "Save a line that already sold", href: "/winning-copy" },
    { done: calls, title: "Add a sales call", href: "/buyer-insights" },
  ];
  const doneCount = items.filter((i) => i.done).length;
  // The first not-done item gets the expanded, highlighted row.
  const nextIndex = items.findIndex((i) => !i.done);

  return (
    <section aria-label="Get started" className="bg-paper border border-line rounded-3xl p-5 sm:p-6 flex flex-col gap-4 animate-step-in">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Get started</div>
        <span className="font-mono text-xs text-muted">
          {doneCount} of {items.length}
        </span>
      </div>
      <div className="flex gap-1.5">
        {items.map((it, i) => (
          <span key={i} className={`flex-1 h-1 rounded-full ${it.done ? "bg-slate" : "bg-[#ECEAF0]"}`} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => {
          const badge = it.done ? (
            <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)" }}>
              <CheckIcon />
            </span>
          ) : (
            <span className="shrink-0 w-6 h-6 rounded-full border border-line flex items-center justify-center font-mono text-[11px] text-muted">
              {i + 1}
            </span>
          );

          if (i === nextIndex && it.action) {
            return (
              <div key={it.title} className="flex gap-3 rounded-2xl bg-[#FAF9FC] border border-[#ECEAF0] px-3.5 py-3.5">
                {badge}
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{it.title}</div>
                  {it.sub && <div className="text-[13px] text-muted mt-0.5">{it.sub}</div>}
                  <button onClick={it.action} className="mt-2.5 h-9 px-4 rounded-lg bg-slate text-white text-[13px] font-semibold">
                    See plans
                  </button>
                </div>
              </div>
            );
          }

          const row = (
            <>
              {badge}
              <span className={`flex-1 text-[14px] ${it.done ? "text-muted line-through decoration-[#C9C4D2]" : "font-medium"}`}>
                {it.title}
              </span>
              {!it.done && <ChevronIcon />}
            </>
          );
          if (it.done) {
            return (
              <div key={it.title} className="flex items-center gap-3 px-3.5 py-2.5">
                {row}
              </div>
            );
          }
          return it.action ? (
            <button key={it.title} onClick={it.action} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-ivory text-left">
              {row}
            </button>
          ) : (
            <Link key={it.title} href={it.href!} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-ivory">
              {row}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
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

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
