import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStepCopy, generateStepVariation } from "@/lib/ai/generateStepCopy";

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
});

const stepSchema = z.object({
  channel: z.string(),
  title: z.string(),
  purpose: z.string(),
  angle: z.string(),
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
  offer: offerSchema,
  steps: z.array(z.object({ templateStepId: z.string(), step: stepSchema })),
  source: sourceSchema,
});

const variationRequestSchema = z.object({
  mode: z.literal("variation"),
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

      const succeeded = results
        .filter((r): r is PromiseFulfilledResult<{ templateStepId: string; copy: unknown }> => r.status === "fulfilled")
        .map((r) => r.value);

      const failed = steps
        .map((s, i) => ({ templateStepId: s.templateStepId, result: results[i] }))
        .filter((r) => r.result.status === "rejected")
        .map((r) => ({
          templateStepId: r.templateStepId,
          error: (r.result as PromiseRejectedResult).reason?.message ?? "Unknown error",
        }));

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
