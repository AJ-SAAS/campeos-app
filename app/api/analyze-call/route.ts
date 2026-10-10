import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSalesCall } from "@/lib/ai/analyzeSalesCall";

// Takes a pasted sales call transcript and returns 3-5 short
// buyer-language themes. Called from the "+ Add a sales call" flow in
// the builder's SetupPanel before the transcript + themes are saved to
// Firestore (see lib/firebase/library.ts).

const requestSchema = z.object({
  transcript: z.string().min(1, "Paste in the call transcript first."),
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
    const themes = await analyzeSalesCall(parsed.data.transcript);
    return NextResponse.json({ themes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
