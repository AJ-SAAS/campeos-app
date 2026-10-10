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

const requestSchema = z.object({
  history: z.array(messageSchema).max(20),
  message: z.string().min(1, "Say something first."),
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
    const result = await runAgentTurn(parsed.data.history, parsed.data.message);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
