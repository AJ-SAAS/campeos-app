import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStepCopy, generateStepVariation } from "@/lib/ai/generateStepCopy";
import { canGenerate } from "@/lib/access";

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
  uid: z.string(),
  offer: offerSchema,
  steps: z.array(z.object({ templateStepId: z.string(), step: stepSchema })),
  source: sourceSchema,
});

const variationRequestSchema = z.object({
  mode: z.literal("variation"),
  uid: z.string(),
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
      { error: "Request didn't match the expected shape.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Paid only, no free tier — this is the one route that actually spends
  // OpenAI money, so it's the real paywall. See lib/access.ts.
  //
  // Wrapped in its own try/catch: canGenerate() reaches Firestore through
  // the Admin SDK, and an unhandled throw here (a missing/stale
  // FIREBASE_SERVICE_ACCOUNT_KEY, most likely) used to fall through to
  // Next's default HTML error page instead of JSON — which breaks the
  // client with "Unexpected token '<' ... is not valid JSON" instead of
  // a message that says what's actually wrong.
  let allowed: boolean;
  try {
    allowed = await canGenerate(parsed.data.uid);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Couldn't check your plan: ${err instanceof Error ? err.message : "unknown error"}. This usually means FIREBASE_SERVICE_ACCOUNT_KEY is missing or wrong in the deploy environment.`,
      },
      { status: 500 }
    );
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Subscribe to generate campaign copy — see /billing." },
      { status: 402 }
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

      return NextResponse.json({ results: succeeded, failed });
    }

    // mode === "variation"
    const { offer, step, currentCopy, instruction } = parsed.data;
    const result = await generateStepVariation(offer, step, currentCopy, instruction);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
