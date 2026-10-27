import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStepCopy, generateStepVariation } from "@/lib/ai/generateStepCopy";
import { canGenerate, claimFreeSteps, refundFreeSteps, FREE_STEP_LIMIT, isAdminUid } from "@/lib/access";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { briefSchema, buildBrief, focusFor, type CampaignBrief } from "@/lib/ai/brief";
import { getPlay, guessPlay } from "@/lib/frameworks/plays";
import { templates } from "@/lib/templates";
import type { StepContext } from "@/lib/ai/prompts";

// A whole campaign is a brief plus up to ~30 messages, each written,
// checked and sometimes rewritten. Give it room.
export const maxDuration = 300;

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
  /** Their sales page link or pasted text, from onboarding. */
  salesPage: z.string().max(6000).optional(),
});

const generateRequestSchema = z.object({
  mode: z.literal("generate"),
  // Ignored: who's calling comes from the verified ID token. Kept
  // optional so older clients that still send it don't fail validation.
  uid: z.string().optional(),
  offer: offerSchema,
  steps: z.array(z.object({ templateStepId: z.string(), step: stepSchema })),
  source: sourceSchema,
  /** Which template this campaign uses, so each step gets its play and
   * its place in the sequence. Optional for older clients. */
  templateId: z.string().optional(),
  /** The campaign's saved buyer brief, if the client has one for this
   * exact offer. Built fresh (and returned) when missing. */
  brief: z.unknown().optional(),
  /** Send each step back the moment it is written (one JSON line each),
   * so the page can show real progress. Without it, everything comes
   * back together at the end. */
  stream: z.boolean().optional(),
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

  const gate = await requireVerifiedUser(req, isAdminUid);
  if (gate.error) return gate.error;
  const caller = gate.user;
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
      const { offer, steps, source, templateId, stream, brief: savedBrief } = parsed.data;
      const encoder = new TextEncoder();
      let emit: (line: object) => void = () => {};
      const run = async () => {
      const template = templateId ? templates[templateId] : undefined;

      // 1. The buyer brief: reuse the client's saved one, or research it
      //    now. If research fails, the copy is still written (just from
      //    less), so a hiccup never blocks a campaign.
      let brief: CampaignBrief | undefined;
      let briefIsNew = false;
      const saved = briefSchema.safeParse(savedBrief);
      if (saved.success) {
        brief = saved.data;
      } else {
        try {
          brief = await buildBrief({
            offer,
            source,
            campaignType: template ? `${template.name}: ${template.description}` : undefined,
            eventAt: steps[0]?.step.eventAt,
          });
          briefIsNew = true;
        } catch (err) {
          console.warn("[brief] failed, writing without it", err instanceof Error ? err.message : err);
        }
      }

      // 2. Each step's play, what it leads with, and where it sits.
      const ordered = template
        ? [...template.steps].sort((a, b) => a.offsetHours - b.offsetHours)
        : null;
      const counters: Record<string, number> = {};
      const enriched: StepContext[] = steps.map(({ templateStepId, step }, i) => {
        // Older clients don't say which template: step ids are unique
        // across templates, so look it up in all of them.
        const tStep =
          template?.steps.find((t) => t.id === templateStepId) ??
          Object.values(templates).flatMap((t) => t.steps).find((t) => t.id === templateStepId);
        const play = getPlay(tStep?.playId) ?? guessPlay(step.channel, step.angle, step.title);
        let focus: string | undefined;
        if (brief && play) {
          const n = counters[play.focus] ?? 0;
          counters[play.focus] = n + 1;
          focus = focusFor(brief, play.focus, n) || undefined;
        }
        const label = (t: { title: string; angle: string; channel: string }) => `${t.title} (${t.channel}, ${t.angle})`;
        let sequence: StepContext["sequence"];
        if (ordered) {
          const pos = ordered.findIndex((t) => t.id === templateStepId);
          if (pos >= 0) {
            sequence = {
              position: pos + 1,
              total: ordered.length,
              before: ordered.slice(Math.max(0, pos - 2), pos).map(label),
              after: ordered.slice(pos + 1, pos + 3).map(label),
            };
          }
        }
        if (!sequence) {
          sequence = {
            position: i + 1,
            total: steps.length,
            before: steps.slice(Math.max(0, i - 2), i).map((x) => label(x.step)),
            after: steps.slice(i + 1, i + 3).map((x) => label(x.step)),
          };
        }
        return { ...step, play, brief, focus, sequence };
      });

      // 3. Write every step in parallel. If one fails, the others still
      //    come back, and the client can retry just the failed one.
      //    The first one goes alone, so OpenAI has the shared start of the
      //    prompt (offer, brief, rules) cached before the rest start, and
      //    bills it at a 90% discount for all of them.
      const writeOne = (i: number) =>
        generateStepCopy(offer, enriched[i], source).then((copy) => {
          emit({ type: "step", templateStepId: steps[i].templateStepId, copy });
          return { templateStepId: steps[i].templateStepId, copy };
        });
      const head = steps.length > 2 ? await Promise.allSettled([writeOne(0)]) : [];
      const tail = await Promise.allSettled(steps.slice(head.length).map((_, k) => writeOne(head.length + k)));
      const results = [...head, ...tail];

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
      return {
        results: succeeded,
        failed,
        free: freeClaimed > 0,
        // Sent back so the client can save it on the campaign and reuse it.
        brief: briefIsNew ? brief : undefined,
      };
      };

      if (!stream) return NextResponse.json(await run());

      // Streamed: one JSON line per finished step, then a last "done" line
      // with the failures and the brief. Errors travel in the stream too,
      // since the response has already started by then.
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          emit = (line) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
          try {
            const out = await run();
            emit({ type: "done", failed: out.failed, free: out.free, brief: out.brief });
          } catch (err) {
            if (freeClaimed > 0) await refundFreeSteps(uid, freeClaimed).catch(() => {});
            console.error("generate-step failed", err);
            emit({ type: "error", error: "Writing that didn't work. Try again in a minute." });
          }
          controller.close();
        },
      });
      return new Response(body, {
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
      });
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
