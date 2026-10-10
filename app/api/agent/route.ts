import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgentTurn } from "@/lib/ai/agent";

// One turn of the agent conversation. Stateless — the client sends the
// whole history back each time (same pattern as /api/generate-step's
// "variation" mode). This route only ever decides what to SAY or which
// tool to call; it never touches Firestore or runs generation itself —
// see lib/ai/agentActions.ts for what happens after a tool call comes
// back here.

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const profileSchema = z.object({
  name: z.string(),
  price: z.string(),
  audience: z.string(),
  whatTheyGet: z.string(),
  tone: z.string(),
});

const campaignStepSummarySchema = z.object({
  templateStepId: z.string(),
  channel: z.string(),
  title: z.string(),
  purpose: z.string(),
  angle: z.string(),
});

const campaignContextSchema = z.object({
  steps: z.array(campaignStepSummarySchema),
});

const requestSchema = z.object({
  history: z.array(messageSchema).max(20),
  message: z.string().min(1, "Say something first."),
  // What the agent already knows about this user's business, from a
  // previous campaign — see lib/firebase/businessProfile.ts. Optional:
  // a brand-new user has none yet.
  profile: profileSchema.nullable().optional(),
  // Present only when the agent is being used from inside an already-open
  // campaign (the builder page's floating launcher) — lets it offer the
  // edit_step tool. Absent from the dashboard's "build something new"
  // panel. See lib/ai/agent.ts.
  campaignContext: campaignContextSchema.nullable().optional(),
});

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
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  try {
    const result = await runAgentTurn(
      parsed.data.history,
      parsed.data.message,
      parsed.data.profile ?? null,
      parsed.data.campaignContext ?? null
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
