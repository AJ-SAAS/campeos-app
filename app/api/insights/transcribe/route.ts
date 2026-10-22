import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { canGenerate, claimInsightRead, isAdminUid } from "@/lib/access";
import { getOpenAIClient } from "@/lib/ai/client";

// Buyer insights: a voice note or a sales call recording becomes text,
// which the page then reads like anything pasted. Talking is easier than
// typing for most people, especially for "your story".
//
// OpenAI takes files up to 25 MB (about 20 minutes of a voice note).

export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

export async function POST(req: NextRequest) {
  const gate = await requireVerifiedUser(req, isAdminUid);
  if (gate.error) return gate.error;
  const caller = gate.user;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "Send the recording as a file." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "The recording was empty." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That recording is over 25 MB. Try a shorter one." }, { status: 400 });
  }
  if (!/^(audio|video)\//.test(file.type)) {
    return NextResponse.json({ error: "That isn't an audio file." }, { status: 400 });
  }

  try {
    const paid = await canGenerate(caller.uid);
    if (!(await claimInsightRead(caller.uid, paid))) {
      return NextResponse.json({ error: "You've hit today's limit. Try again tomorrow." }, { status: 429 });
    }
  } catch (err) {
    console.error("insights/transcribe limit check failed", err);
    return NextResponse.json({ error: "Couldn't check your account just now." }, { status: 500 });
  }

  try {
    const result = await getOpenAIClient().audio.transcriptions.create({ file, model: TRANSCRIBE_MODEL });
    const text = (result.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "We couldn't hear anything in that recording." }, { status: 422 });
    return NextResponse.json({ text });
  } catch (err) {
    console.error("insights/transcribe failed", err);
    return NextResponse.json({ error: "Couldn't turn that into text. Try again." }, { status: 500 });
  }
}
