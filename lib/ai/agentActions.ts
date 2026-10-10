"use client";

import { buildTimeline } from "@/lib/engine/buildTimeline";
import { webinarTemplate } from "@/lib/templates/webinar";
import { OfferContext } from "@/lib/ai/prompts";
import { createCampaign, CampaignStepDoc } from "@/lib/firebase/campaigns";
import { checkAndIncrementUsage } from "@/lib/firebase/usage";
import { saveBusinessProfile } from "@/lib/firebase/businessProfile";

// NOTE: this does not yet pull in the user's winning copy / call themes
// library (lib/firebase/library.ts) — that feature hasn't shipped to
// this repo yet. When it does, pass real values in `source` below
// instead of empty arrays, same as the builder's generateCampaign does.
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
): Promise<{ campaignId: string; stepCount: number; failedCount: number }> {
  const eventDate = new Date(`${args.webinarDate}T19:00:00`);
  if (Number.isNaN(eventDate.getTime())) {
    throw new Error(`Couldn't understand the webinar date "${args.webinarDate}".`);
  }

  const scheduledSteps = buildTimeline(webinarTemplate, { event: eventDate });

  const allowed = await checkAndIncrementUsage(uid, scheduledSteps.length);
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

  const res = await fetch("/api/generate-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "generate",
      offer,
      steps: scheduledSteps.map((s) => ({
        templateStepId: s.templateStepId,
        step: { channel: s.channel, title: s.title, purpose: s.purpose, angle: s.angle, fields: s.fields },
      })),
      source: { winningCopy: [], callThemes: [] },
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
    failedCount: data.failed?.length ?? 0,
  };
}
