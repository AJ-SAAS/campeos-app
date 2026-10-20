import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStepCopy, generateStepVariation } from "@/lib/ai/generateStepCopy";
import { canGenerate, claimFreeSteps, refundFreeSteps, FREE_STEP_LIMIT } from "@/lib/access";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";

// This route does two jobs, picked by the "mode" field:
//   "generate"  — write fresh copy for one or more steps (called in
//                 parallel from the client, one request per step, or
//                 pass an array to do them all in one request).
//   "variation" — change one thing about a single step's existing copy,
//                 from the AskCampeosBar in the step editor.

const offerSchema = z.object({
  name: z.string(),
  price: z.string(),
  audience: z.string(),
  whatTheyGet: z.string(),
  tone: z.string(),
  readingLevel: z.string().default("5th grade"),
  fromName: z.string().optional(),
});

const stepSchema = z.object({
  channel: z.string(),
  title: z.string(),
  purpose: z.string(),
  angle: z.string(),
  goals: z.array(z.string()).default([]),
  persuasionElements: z.array(z.string()).default([]),
  phaseName: z.string().default(""),
  phaseObjective: z.string().default(""),
  scheduledAt: z.string().optional(),
  eventAt: z.string().optional(),
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      kind: z.enum(["short", "long"]),
    })
  ),
});

const sourceSchema = z.object({
  winningCopy: z.array(z.string()).default([]),
  callThemes: z.array(z.string()).default([]),
});

const generateRequestSchema = z.object({
  mode: z.literal("generate"),
  // Ignored: who's calling comes from the verified ID token. Kept
  // optional so older clients that still send it don't fail validation.
  uid: z.string().optional(),
  offer: offerSchema,
  steps: z.array(z.object({ templateStepId: z.string(), step: stepSchema })),
  source: sourceSchema,
});

const variationRequestSchema = z.object({
  mode: z.literal("variation"),
  // Ignored: who's calling comes from the verified ID token. Kept
  // optional so older clients that still send it don't fail validation.
  uid: z.string().optional(),
  offer: offerSchema,
  step: stepSchema,
  currentCopy: z.record(z.string()),
  instruction: z.string(),
});

const requestSchema = z.union([generateRequestSchema, variationRequestSchema]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Something in that request was missing. Refresh the page and try again." },
      { status: 400 }
    );
  }

  const caller = await getVerifiedUser(req);
  if (!caller) {
    return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });
  }
  const uid = caller.uid;

  // The paywall. A plan (or admin) writes without limit. No plan gets
  // the free taste: the first FREE_STEP_LIMIT steps of one campaign,
  // reserved up front and handed back if they fail. See lib/access.ts.
  //
  // canGenerate() reaches Firestore through the Admin SDK; a throw here
  // (missing FIREBASE_SERVICE_ACCOUNT_KEY, most likely) is returned as
  // JSON rather than falling through to Next's HTML error page.
  let freeClaimed = 0;
  try {
    const paid = await canGenerate(uid);
    if (!paid) {
      const count = parsed.data.mode === "generate" ? parsed.data.steps.length : 0;
      const ok = count > 0 && count <= FREE_STEP_LIMIT && (await claimFreeSteps(uid, count));
      if (!ok) {
        return NextResponse.json(
          { error: "Pick a plan to write the rest of your campaign.", code: "plan_required" },
          { status: 402 }
        );
      }
      freeClaimed = count;
    }
  } catch (err) {
    console.error("generate-step plan check failed", err);
    return NextResponse.json(
      { error: "We couldn't check your plan just now. Try again in a minute." },
      { status: 500 }
    );
  }

  try {
    if (parsed.data.mode === "generate") {
      const { offer, steps, source } = parsed.data;

      // One Claude call per step, run in parallel. If one step fails, the
      // others still come back — the client can retry just the failed one.
      const results = await Promise.allSettled(
        steps.map(({ templateStepId, step }) =>
          generateStepCopy(offer, step, source).then((copy) => ({
            templateStepId,
            copy,
          }))
        )
      );

      const succeeded: { templateStepId: string; copy: Awaited<ReturnType<typeof generateStepCopy>> }[] = [];
      const failed: { templateStepId: string; error: string }[] = [];

      results.forEach((result, i) => {
        if (result.status === "fulfilled") {
          succeeded.push(result.value);
        } else {
          failed.push({
            templateStepId: steps[i].templateStepId,
            error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          });
        }
      });

      if (freeClaimed > 0 && failed.length > 0) {
        await refundFreeSteps(uid, failed.length).catch(() => {});
      }
      return NextResponse.json({ results: succeeded, failed, free: freeClaimed > 0 });
    }

    // mode === "variation"
    const { offer, step, currentCopy, instruction } = parsed.data;
    const result = await generateStepVariation(offer, step, currentCopy, instruction);
    return NextResponse.json({ result });
  } catch (err) {
    if (freeClaimed > 0) await refundFreeSteps(uid, freeClaimed).catch(() => {});
    console.error("generate-step failed", err);
    return NextResponse.json(
      { error: "Writing that didn't work. Try again in a minute." },
      { status: 500 }
    );
  }
}
