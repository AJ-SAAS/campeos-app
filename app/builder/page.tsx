"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconRail } from "@/components/builder/IconRail";
import { SetupPanel } from "@/components/builder/SetupPanel";
import { Timeline, UIStep } from "@/components/builder/Timeline";
import { StepEditor } from "@/components/builder/StepEditor";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { AgentPanelCampaignStep } from "@/components/agent/AgentPanel";
import { buildTimeline, ScheduledStep } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext, formatForPrompt } from "@/lib/ai/prompts";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  createCampaign,
  getCampaignWithSteps,
  saveStepCopy,
  CampaignStepDoc,
} from "@/lib/firebase/campaigns";
import {
  addWinningCopy,
  addSalesCall,
  listWinningCopy,
  listCallThemes,
} from "@/lib/firebase/library";
import { checkAndIncrementUsage } from "@/lib/firebase/usage";

// The Campaign Builder — Builder.dc.html, wired to the real engine, the
// real /api/generate-step route, and real Firestore persistence.
// New campaign: /builder — starts from the webinar template, nothing
// saved until you click "Generate campaign copy."
// Existing campaign: /builder?id=<campaignId> — loads saved steps and
// copy instead of starting fresh.
const DEFAULT_EVENT_DATE = new Date("2026-10-15T19:00:00");

const DEFAULT_OFFER: OfferContext = {
  name: "Fall Reset Program",
  price: "$3,000",
  audience: "People who want a fresh start this fall",
  whatTheyGet: "A guided 3-step plan and weekly coaching calls",
  tone: "Friendly",
  readingLevel: "5th grade",
};

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-paper text-muted">
          Loading...
        </div>
      }
    >
      <BuilderInner />
    </Suspense>
  );
}

type MobilePanel = "setup" | "timeline" | "step";

function BuilderInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingId = searchParams.get("id");

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferContext>(DEFAULT_OFFER);
  const [eventDate, setEventDate] = useState<Date>(DEFAULT_EVENT_DATE);
  const [loadedSteps, setLoadedSteps] = useState<CampaignStepDoc[] | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(!!existingId);

  // Load an existing campaign's saved steps and copy when ?id= is present.
  useEffect(() => {
    if (!existingId) return;
    setLoadingCampaign(true);
    getCampaignWithSteps(existingId)
      .then((result) => {
        if (!result) return;
        setCampaignId(result.campaign.id);
        setOffer(result.campaign.offer);
        setEventDate(new Date(result.campaign.eventDate));
        setLoadedSteps(result.steps);
      })
      .finally(() => setLoadingCampaign(false));
  }, [existingId]);

  // A brand-new campaign's schedule comes from the engine; a loaded one
  // uses the dates already saved on each step.
  const freshSteps = useMemo(
    () => buildTimeline(webinarTemplate, { event: eventDate }),
    [eventDate]
  );

  const scheduledSteps: ScheduledStep[] = loadedSteps
    ? loadedSteps.map((s) => ({ ...s, scheduledAt: new Date(s.scheduledAt) }))
    : freshSteps;

  const [copyByStep, setCopyByStep] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (!loadedSteps) return;
    const copy: Record<string, Record<string, string>> = {};
    for (const s of loadedSteps) {
      if (s.copy) copy[s.templateStepId] = s.copy;
    }
    setCopyByStep(copy);
  }, [loadedSteps]);

  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && scheduledSteps[0]) setSelectedId(scheduledSteps[0].templateStepId);
  }, [scheduledSteps, selectedId]);

  // Below lg, the 3-panel desktop layout (Setup / Timeline / Step) doesn't
  // fit side by side — shown one at a time instead, picked with the tab
  // row in the mobile header. Starts on "timeline" since that's the main
  // view; tapping a step on mobile jumps straight to "step" (see
  // Timeline's onSelect below), matching how tapping a card should feel.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("timeline");

  const [generating, setGenerating] = useState(false);
  const [variationPending, setVariationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The user's own library of proven copy and sales-call themes — scoped
  // to their account, reused across every campaign they build. See
  // lib/firebase/library.ts.
  const [winningCopy, setWinningCopy] = useState<string[]>([]);
  const [callThemes, setCallThemes] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setWinningCopy([]);
      setCallThemes([]);
      return;
    }
    listWinningCopy(user.uid).then(setWinningCopy);
    listCallThemes(user.uid).then(setCallThemes);
  }, [user]);

  async function handleAddWinningCopy(text: string) {
    if (!user) throw new Error("Sign in first to save winning copy.");
    await addWinningCopy(user.uid, text);
    setWinningCopy(await listWinningCopy(user.uid));
  }

  async function handleAddSalesCall(transcript: string) {
    if (!user) throw new Error("Sign in first to save a sales call.");
    const res = await fetch("/api/analyze-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Couldn't analyze that call.");
    await addSalesCall(user.uid, transcript, data.themes);
    setCallThemes(await listCallThemes(user.uid));
  }

  const steps: UIStep[] = scheduledSteps.map((s) => ({
    ...s,
    copy: copyByStep[s.templateStepId],
  }));
  const selected = steps.find((s) => s.templateStepId === selectedId);
  const selectedIndex = steps.findIndex((s) => s.templateStepId === selectedId);

  async function generateCampaign() {
    if (!user) {
      setError("Sign in first — campaigns are saved to your account.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      // Same daily cap the agent's build path already enforces (see
      // lib/firebase/usage.ts) — this was the one way to burn through
      // the OpenAI budget with no limit at all, since it's a manual
      // click a user can hit repeatedly.
      const allowed = await checkAndIncrementUsage(user.uid, scheduledSteps.length);
      if (!allowed) {
        setError(
          "You've hit today's generation limit for your account. Try again tomorrow, or generate fewer steps at a time."
        );
        setGenerating(false);
        return;
      }

      const eventAt = formatForPrompt(eventDate);
      const res = await fetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          uid: user.uid,
          offer: { ...offer, fromName: user.displayName ?? undefined },
          steps: scheduledSteps.map((s) => ({
            templateStepId: s.templateStepId,
            step: {
              channel: s.channel,
              title: s.title,
              purpose: s.purpose,
              angle: s.angle,
              goals: s.goals,
              persuasionElements: s.persuasionElements,
              phaseName: s.phaseName,
              phaseObjective: s.phaseObjective,
              scheduledAt: formatForPrompt(s.scheduledAt),
              eventAt,
              fields: s.fields,
            },
          })),
          source: { winningCopy, callThemes },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");

      const next: Record<string, Record<string, string>> = { ...copyByStep };
      for (const r of data.results as { templateStepId: string; copy: Record<string, string> }[]) {
        next[r.templateStepId] = r.copy;
      }
      setCopyByStep(next);

      // Save to Firestore: create the campaign the first time, or update
      // each step's copy if it already exists.
      if (!campaignId) {
        const stepDocs: CampaignStepDoc[] = scheduledSteps.map((s) => ({
          templateStepId: s.templateStepId,
          channel: s.channel,
          title: s.title,
          purpose: s.purpose,
          angle: s.angle,
          goals: s.goals,
          persuasionElements: s.persuasionElements,
          phaseName: s.phaseName,
          phaseObjective: s.phaseObjective,
          fields: s.fields,
          scheduledAt: s.scheduledAt.toISOString(),
          copy: next[s.templateStepId] ?? null,
        }));
        const newId = await createCampaign(
          user.uid,
          offer.name || "Untitled campaign",
          webinarTemplate.id,
          offer,
          eventDate,
          stepDocs
        );
        setCampaignId(newId);
        // Bake the new campaign into the URL so browser back/forward and
        // refresh don't lose it — without this, forward-navigating here
        // reloads a blank /builder with nothing to load (the page only
        // knows to load an existing campaign from ?id= on mount).
        router.replace(`/builder?id=${newId}`);
      } else {
        await Promise.all(
          Object.entries(next).map(([templateStepId, copy]) =>
            saveStepCopy(campaignId, templateStepId, copy)
          )
        );
      }

      if (data.failed?.length) {
        const failedList = (data.failed as { templateStepId: string; error: string }[])
          .map((f) => {
            const title = scheduledSteps.find((s) => s.templateStepId === f.templateStepId)?.title;
            return title ? `"${title}" (${f.error})` : f.error;
          })
          .join(", ");
        setError(`${data.failed.length} step(s) failed to generate: ${failedList}. Try again.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function requestVariation(instruction: string) {
    if (!selected) return;
    if (!user) {
      setError("Sign in first — campaigns are saved to your account.");
      return;
    }
    setVariationPending(true);
    setError(null);
    try {
      const allowed = await checkAndIncrementUsage(user.uid, 1);
      if (!allowed) {
        setError(
          "You've hit today's generation limit for your account. Try again tomorrow."
        );
        setVariationPending(false);
        return;
      }

      const res = await fetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "variation",
          uid: user.uid,
          offer: { ...offer, fromName: user.displayName ?? undefined },
          step: {
            channel: selected.channel,
            title: selected.title,
            purpose: selected.purpose,
            angle: selected.angle,
            goals: selected.goals,
            persuasionElements: selected.persuasionElements,
            phaseName: selected.phaseName,
            phaseObjective: selected.phaseObjective,
            scheduledAt: formatForPrompt(selected.scheduledAt),
            eventAt: formatForPrompt(eventDate),
            fields: selected.fields,
          },
          currentCopy: selected.copy ?? {},
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Variation failed.");

      const { changed, ...rest } = data.result;
      const updatedCopy = { ...copyByStep[selected.templateStepId], ...rest };
      setCopyByStep((prev) => ({ ...prev, [selected.templateStepId]: updatedCopy }));

      if (campaignId) {
        await saveStepCopy(campaignId, selected.templateStepId, updatedCopy);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setVariationPending(false);
    }
  }

  if (loadingCampaign) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper text-muted">
        Loading campaign...
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-violet-50 via-white to-pink-50 text-slate font-body">
      <IconRail />

      <div className="flex-grow min-w-0 flex flex-col">
        <header className="shrink-0 bg-paper border-b border-line flex flex-col gap-3 px-4 py-3 sm:px-6 sm:h-16 sm:flex-row sm:items-center sm:gap-4 sm:py-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              aria-label="Back to dashboard"
              className="lg:hidden shrink-0 w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted"
            >
              <BackIcon />
            </Link>
            <div className="font-display text-base sm:text-lg font-semibold tracking-tight truncate">
              {offer.name || "Untitled campaign"}
            </div>
            <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full bg-ivory text-muted text-xs font-semibold">
              {campaignId ? "Saved" : "Draft"}
            </span>
          </div>
          {error && <span className="text-xs text-dangerFg sm:ml-0">{error}</span>}
          <div className="hidden sm:flex flex-grow" />
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] border border-line bg-paper text-sm font-semibold">
              Preview
            </button>
            <button className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold">
              Copy campaign
            </button>
          </div>
        </header>

        {/* Mobile-only: pick which single panel is showing. The desktop
            3-column layout below renders all three at once (lg:flex),
            so this row — and the panel visibility it controls — only
            matters below that breakpoint. */}
        <div className="lg:hidden shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-line overflow-x-auto">
          {(
            [
              ["setup", "Setup"],
              ["timeline", "Timeline"],
              ["step", "Step"],
            ] as [MobilePanel, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMobilePanel(key)}
              aria-pressed={mobilePanel === key}
              className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-semibold ${
                mobilePanel === key ? "bg-slate text-white" : "bg-ivory text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-grow min-h-0 flex flex-col lg:flex-row gap-3 p-3 lg:gap-4 lg:p-4 overflow-y-auto lg:overflow-hidden">
          <div className={`${mobilePanel === "setup" ? "flex" : "hidden"} lg:flex min-h-0 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(124,58,237,0.06),0_12px_32px_-16px_rgba(124,58,237,0.18)]`}>
            <SetupPanel
              offer={offer}
              onOfferChange={setOffer}
              winningCopy={winningCopy}
              callThemes={callThemes}
              onAddWinningCopy={handleAddWinningCopy}
              onAddSalesCall={handleAddSalesCall}
              onGenerate={generateCampaign}
              generating={generating}
            />
          </div>
          <div className={`${mobilePanel === "timeline" ? "flex" : "hidden"} lg:flex min-h-0 flex-1 min-w-0 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(124,58,237,0.06),0_12px_32px_-16px_rgba(124,58,237,0.18)]`}>
            <Timeline
              steps={steps}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setMobilePanel("step");
              }}
              eventDate={eventDate}
              phases={webinarTemplate.phases}
              generating={generating}
            />
          </div>
          <div className={`${mobilePanel === "step" ? "flex" : "hidden"} lg:flex min-h-0 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(124,58,237,0.06),0_12px_32px_-16px_rgba(124,58,237,0.18)]`}>
            <StepEditor
              step={selected}
              stepNumber={selectedIndex + 1}
              totalSteps={steps.length}
              onRequestVariation={requestVariation}
              variationPending={variationPending}
            />
          </div>
        </div>
      </div>

      <AgentLauncher
        // Only wired up for edit_step once this draft is actually saved —
        // a brand-new unsaved campaign has no campaignId to write edits
        // to yet. The agent can still build an unrelated new campaign
        // from here either way (create_campaign doesn't need this).
        campaign={
          campaignId
            ? {
                campaignId,
                offer: { ...offer, fromName: user?.displayName ?? undefined },
                steps: steps.map(
                  (s): AgentPanelCampaignStep => ({
                    templateStepId: s.templateStepId,
                    channel: s.channel,
                    title: s.title,
                    purpose: s.purpose,
                    angle: s.angle,
                    goals: s.goals,
                    persuasionElements: s.persuasionElements,
                    phaseName: s.phaseName,
                    phaseObjective: s.phaseObjective,
                    scheduledAt: formatForPrompt(s.scheduledAt),
                    eventAt: formatForPrompt(eventDate),
                    fields: s.fields,
                    copy: s.copy ?? null,
                  })
                ),
                onStepUpdated: (templateStepId, copy) =>
                  setCopyByStep((prev) => ({ ...prev, [templateStepId]: copy })),
              }
            : undefined
        }
      />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
