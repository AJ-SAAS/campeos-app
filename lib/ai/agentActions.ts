"use client";

import { buildTimeline } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext, StepContext } from "@/lib/ai/prompts";
import { createCampaign, CampaignStepDoc, saveStepCopy } from "@/lib/firebase/campaigns";
import { checkAndIncrementUsage } from "@/lib/firebase/usage";
import { saveBusinessProfile } from "@/lib/firebase/businessProfile";
import { listWinningCopy, listCallThemes } from "@/lib/firebase/library";
import { CreateCampaignArgs } from "@/lib/ai/agent";

export class UsageLimitError extends Error {}

/**
 * Runs the agent's create_campaign tool call for real: builds the
 * timeline, writes the copy (same /api/generate-step call the builder's
 * "Generate campaign copy" button makes), and saves it to Firestore.
 * This is client-side, not inside the API route, because Firestore
 * writes here go through the signed-in user's own client SDK session —
 * same as every other write in the app (see lib/firebase/campaigns.ts).
 */
export async function executeCreateCampaign(
  uid: string,
  args: CreateCampaignArgs
): Promise<{ campaignId: string; stepCount: number; writtenCount: number; failedCount: number }> {
  const eventDate = new Date(`${args.webinarDate}T19:00:00`);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error(`Couldn't understand the webinar date "${args.webinarDate}".`);
  }

  const scheduledSteps = buildTimeline(webinarTemplate, { event: eventDate });

  // The schedule (dates, titles, channels) always saves in full — it's
  // free, deterministic date math. "stepScope" only controls how many
  // steps actually get COPY written and billed against the usage cap.
  // "first" picks the single earliest-dated step, since that's what
  // "just do the first one" means on a freshly built timeline.
  const stepsToWrite =
    args.stepScope === "first"
      ? [[...scheduledSteps].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0]]
      : scheduledSteps;

  const allowed = await checkAndIncrementUsage(uid, stepsToWrite.length);
  if (!allowed) {
    throw new UsageLimitError(
      "You've hit today's generation limit for your account. Try again tomorrow, or generate fewer steps at a time."
    );
  }

  const offer: OfferContext = {
    name: args.offerName,
    price: args.price,
    audience: args.audience,
    whatTheyGet: args.whatTheyGet,
    tone: args.tone,
  };

  // Same source material the builder's own "Generate campaign copy"
  // button uses (lib/firebase/library.ts) — the agent's path was
  // skipping this and always sending empty arrays, which meant copy it
  // built never used anything the user had already saved.
  const [winningCopy, callThemes] = await Promise.all([
    listWinningCopy(uid),
    listCallThemes(uid),
  ]);

  const res = await fetch("/api/generate-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "generate",
      offer,
      steps: stepsToWrite.map((s) => ({
        templateStepId: s.templateStepId,
        step: { channel: s.channel, title: s.title, purpose: s.purpose, angle: s.angle, fields: s.fields },
      })),
      source: { winningCopy, callThemes },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Generation failed.");

  const copyByStep: Record<string, Record<string, string>> = {};
  for (const r of data.results as { templateStepId: string; copy: Record<string, string> }[]) {
    copyByStep[r.templateStepId] = r.copy;
  }

  const stepDocs: CampaignStepDoc[] = scheduledSteps.map((s) => ({
    templateStepId: s.templateStepId,
    channel: s.channel,
    title: s.title,
    purpose: s.purpose,
    angle: s.angle,
    fields: s.fields,
    scheduledAt: s.scheduledAt.toISOString(),
    copy: copyByStep[s.templateStepId] ?? null,
  }));

  const campaignId = await createCampaign(
    uid,
    args.offerName,
    webinarTemplate.id,
    offer,
    eventDate,
    stepDocs
  );

  // Remember this offer for next time — so a second campaign doesn't
  // start the conversation from zero. Best-effort: a failure here
  // shouldn't undo a campaign that already built successfully.
  try {
    await saveBusinessProfile(uid, offer);
  } catch {
    // Not fatal — the campaign is already saved either way.
  }

  return {
    campaignId,
    stepCount: scheduledSteps.length,
    writtenCount: Object.keys(copyByStep).length,
    failedCount: data.failed?.length ?? 0,
  };
}

/**
 * Runs the agent's edit_step tool call for real: writes or changes one
 * step's copy. If the step already has copy, this behaves like the
 * builder's own "variation" box — one change at a time. If the step has
 * no copy yet (saved by create_campaign's "first"-only scope), there's
 * nothing to vary, so this writes fresh copy instead, folding the user's
 * instruction into the step's own angle.
 */
export async function executeEditStep(
  uid: string,
  campaignId: string,
  templateStepId: string,
  step: StepContext,
  currentCopy: Record<string, string>,
  instruction: string,
  offer: OfferContext
): Promise<{ copy: Record<string, string>; changed?: string }> {
  const allowed = await checkAndIncrementUsage(uid, 1);
  if (!allowed) {
    throw new UsageLimitError(
      "You've hit today's generation limit for your account. Try again tomorrow."
    );
  }

  if (Object.keys(currentCopy).length === 0) {
    const [winningCopy, callThemes] = await Promise.all([
      listWinningCopy(uid),
      listCallThemes(uid),
    ]);
    const res = await fetch("/api/generate-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "generate",
        offer,
        steps: [
          {
            templateStepId,
            step: { ...step, angle: `${step.angle}. ${instruction}` },
          },
        ],
        source: { winningCopy, callThemes },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Generation failed.");
    const result = data.results?.[0] as { templateStepId: string; copy: Record<string, string> } | undefined;
    if (!result) {
      throw new Error(data.failed?.[0]?.error ?? "That step failed to generate.");
    }
    await saveStepCopy(campaignId, templateStepId, result.copy);
    return { copy: result.copy };
  }

  const res = await fetch("/api/generate-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "variation", offer, step, currentCopy, instruction }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Variation failed.");

  const { changed, ...rest } = data.result as { changed?: string; [key: string]: string | undefined };
  const updatedCopy = { ...currentCopy, ...rest } as Record<string, string>;

  await saveStepCopy(campaignId, templateStepId, updatedCopy);

  return { copy: updatedCopy, changed };
}
