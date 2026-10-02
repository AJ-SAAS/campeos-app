"use client";

import { useMemo, useState } from "react";
import { IconRail } from "@/components/builder/IconRail";
import { SetupPanel } from "@/components/builder/SetupPanel";
import { Timeline, UIStep } from "@/components/builder/Timeline";
import { StepEditor } from "@/components/builder/StepEditor";
import { buildTimeline } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext } from "@/lib/ai/prompts";

// The Campaign Builder — Builder.dc.html, wired to the real engine and
// the real /api/generate-step route instead of hardcoded mockup copy.
// Steps start empty ("Not written yet"); "Generate campaign copy" calls
// Claude once per step, in parallel, and fills them in.
const EVENT_DATE = new Date("2026-10-15T19:00:00");

const SAMPLE_WINNING_COPY = [
  "The 3-step reset for busy people",
  "Stop guessing. Start with a plan.",
  "Free live workshop: Thursday at 7 PM",
];

const SAMPLE_CALL_THEMES = [
  "Tired of doing it alone",
  "Wants a plan to follow",
  "Burned by a past program",
];

export default function BuilderPage() {
  const [offer, setOffer] = useState<OfferContext>({
    name: "Fall Reset Program",
    price: "$3,000",
    audience: "People who want a fresh start this fall",
    whatTheyGet: "A guided 3-step plan and weekly coaching calls",
    tone: "Friendly",
  });

  const scheduledSteps = useMemo(
    () => buildTimeline(webinarTemplate, { event: EVENT_DATE }),
    []
  );

  const [copyByStep, setCopyByStep] = useState<Record<string, Record<string, string>>>({});
  const [selectedId, setSelectedId] = useState(scheduledSteps[0]?.templateStepId ?? "");
  const [generating, setGenerating] = useState(false);
  const [variationPending, setVariationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: UIStep[] = scheduledSteps.map((s) => ({
    ...s,
    copy: copyByStep[s.templateStepId],
  }));
  const selected = steps.find((s) => s.templateStepId === selectedId);
  const selectedIndex = steps.findIndex((s) => s.templateStepId === selectedId);

  async function generateCampaign() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          offer,
          steps: scheduledSteps.map((s) => ({
            templateStepId: s.templateStepId,
            step: {
              channel: s.channel,
              title: s.title,
              purpose: s.purpose,
              angle: s.angle,
              fields: s.fields,
            },
          })),
          source: { winningCopy: SAMPLE_WINNING_COPY, callThemes: SAMPLE_CALL_THEMES },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");

      const next: Record<string, Record<string, string>> = { ...copyByStep };
      for (const r of data.results as { templateStepId: string; copy: Record<string, string> }[]) {
        next[r.templateStepId] = r.copy;
      }
      setCopyByStep(next);

      if (data.failed?.length) {
        setError(`${data.failed.length} step(s) failed to generate. Try again.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function requestVariation(instruction: string) {
    if (!selected) return;
    setVariationPending(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "variation",
          offer,
          step: {
            channel: selected.channel,
            title: selected.title,
            purpose: selected.purpose,
            angle: selected.angle,
            fields: selected.fields,
          },
          currentCopy: selected.copy ?? {},
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Variation failed.");

      const { changed, ...rest } = data.result;
      setCopyByStep((prev) => ({
        ...prev,
        [selected.templateStepId]: { ...prev[selected.templateStepId], ...rest },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setVariationPending(false);
    }
  }

  return (
    <div className="h-screen flex bg-ivory text-slate font-body">
      <IconRail />

      <div className="flex-grow min-w-0 flex flex-col">
        <header className="h-16 shrink-0 bg-white border-b border-[#DDD6C5] flex items-center gap-4 px-6">
          <div className="font-display text-lg font-semibold tracking-tight">
            {offer.name || "Untitled campaign"}
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ECE8DC] text-muted text-xs font-semibold">
            Draft
          </span>
          {error && <span className="text-xs text-[#B42318]">{error}</span>}
          <div className="flex-grow" />
          <button className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] border border-faint bg-white text-sm font-semibold">
            Preview
          </button>
          <button className="inline-flex items-center gap-2 h-11 px-4 rounded-[10px] border border-slate bg-slate text-white text-sm font-semibold">
            Copy campaign
          </button>
        </header>

        <div className="flex-grow min-h-0 flex">
          <SetupPanel
            offer={offer}
            onOfferChange={setOffer}
            winningCopy={SAMPLE_WINNING_COPY}
            callThemes={SAMPLE_CALL_THEMES}
            onGenerate={generateCampaign}
            generating={generating}
          />
          <Timeline
            steps={steps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            eventDate={EVENT_DATE}
          />
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
  );
}
