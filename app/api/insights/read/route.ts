import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { canGenerate, claimInsightRead, isAdminUid } from "@/lib/access";
import { readInsight, learnedChips } from "@/lib/ai/readInsight";
import { asUrl, fetchPageText } from "@/lib/web";

// Buyer insights: read one thing the user pasted, dropped (screenshots) or
// linked, and return what it is and what was learned. Saving it is the
// page's job (client SDK, the user's own data); this route only reads.

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const schema = z
  .object({
    text: z.string().max(60000).optional(),
    images: z.array(z.string().startsWith("data:image/")).max(4).optional(),
    link: z.string().max(2000).optional(),
    kindHint: z
      .enum(["call", "testimonial", "story", "message", "survey", "objection", "mystory", "result", "other"])
      .optional(),
    offerName: z.string().max(200).optional(),
  })
  .refine((b) => (b.text ?? "").trim() || b.images?.length || (b.link ?? "").trim(), {
    message: "Paste something, add a screenshot, or give a link.",
  });

export async function POST(req: NextRequest) {
  const gate = await requireVerifiedUser(req, isAdminUid);
  if (gate.error) return gate.error;
  const caller = gate.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { images, kindHint, offerName } = parsed.data;
  if (images?.some((d) => d.length * 0.75 > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Each screenshot needs to be under 5 MB." }, { status: 400 });
  }

  try {
    const paid = await canGenerate(caller.uid);
    if (!(await claimInsightRead(caller.uid, paid))) {
      return NextResponse.json(
        { error: paid ? "That's a lot of reading for one day. Try again tomorrow." : "You've hit today's limit. Pick a plan to add more." },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("insights/read limit check failed", err);
    return NextResponse.json({ error: "Couldn't check your account just now. Try again in a minute." }, { status: 500 });
  }

  let text = parsed.data.text ?? "";
  let source: "paste" | "file" | "link" = images?.length ? "file" : "paste";
  const link = (parsed.data.link ?? "").trim();
  if (link) {
    const url = asUrl(link);
    if (!url) return NextResponse.json({ error: "That doesn't look like a link we can open." }, { status: 400 });
    const page = await fetchPageText(url, 20000);
    if (!page || page.length < 80) {
      return NextResponse.json(
        { error: "We couldn't read that page. Copy the words from it and paste them instead." },
        { status: 422 }
      );
    }
    text = `${text}\n\n(From ${url})\n${page}`.trim();
    source = "link";
  }

  try {
    const result = await readInsight({ text, images, kindHint, offerName });
    return NextResponse.json({ ...result, chips: learnedChips(result.learned), source, text: text.slice(0, 60000) });
  } catch (err) {
    console.error("insights/read failed", err);
    return NextResponse.json({ error: "Couldn't read that. Try again, or paste it as text." }, { status: 500 });
  }
}
