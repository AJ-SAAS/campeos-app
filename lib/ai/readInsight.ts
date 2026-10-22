import { z } from "zod";
import { chat, UTILITY_MODEL } from "./client";
import { emptyLearned, InsightKind, Learned } from "../insights/types";

// Reads one thing a user pasted, dropped or recorded on the Buyer insights
// page: works out what it is (a call, a testimonial, a DM...) and pulls out
// what the copy engine can use, in the buyer's own words.
//
// Same never-invent rule as the copy: everything comes from the text (or
// screenshot) itself. A testimonial's name and result are only filled when
// they're actually there.

const KINDS = ["call", "testimonial", "story", "message", "survey", "objection", "mystory", "result", "other"] as const;

const str = z.string().catch("");
const strList = (max: number) =>
  z
    .array(z.string())
    .catch([])
    .transform((a) => a.map((x) => x.trim()).filter(Boolean).slice(0, max));

const readSchema = z.object({
  kind: z.enum(KINDS).catch("other"),
  title: str,
  quotes: strList(8),
  pains: strList(8),
  desires: strList(8),
  objections: z
    .array(z.object({ objection: str, answer: str }))
    .catch([])
    .transform((a) => a.filter((o) => o.objection.trim()).slice(0, 8)),
  results: strList(6),
  words: strList(10),
  tried: strList(6),
  whyBought: strList(6),
  story: z.object({ before: str, turn: str, after: str }).nullable().catch(null),
  testimonial: z
    .object({ quote: str, name: str, role: str, result: str })
    .nullable()
    .catch(null),
});

export interface ReadResult {
  kind: InsightKind;
  title: string;
  learned: Learned;
}

export interface ReadInput {
  text?: string;
  /** Screenshots as data URLs (image/png, image/jpeg, image/webp). */
  images?: string[];
  /** What the user said it is, if they picked one. */
  kindHint?: InsightKind;
  offerName?: string;
}

export function buildReadPrompt({ text, kindHint, offerName, images }: ReadInput): string {
  return `You help a small business learn from its buyers. Below is something they
${images?.length ? "added as screenshots" : "pasted"}${offerName ? ` about their offer "${offerName}"` : ""}.

${text?.trim() ? `THE TEXT:\n"""\n${text.trim().slice(0, 30000)}\n"""` : "(See the screenshots.)"}

1. Work out what it is${kindHint ? ` (the user says it's a "${kindHint}", trust that unless it clearly isn't)` : ""}:
   - "call": a sales call or interview transcript
   - "testimonial": a customer praising the result, a review
   - "story": one customer's before and after, told by the seller
   - "message": a DM, email, comment or reply from a buyer or prospect
   - "survey": many people's answers to the same questions
   - "objection": a reason people give for not buying (often with the seller's answer)
   - "mystory": the seller telling their OWN story (I/me, why they started)
   - "result": a number or achievement the seller can stand behind
   - "other": anything else

2. Pull out ONLY what is actually there. Never invent or improve anything.
   Keep the buyer's own words wherever possible (short, as they said it).

Return ONLY JSON:
{
  "kind": "one of the kinds above",
  "title": "a short label for this item, max 6 words, e.g. 'Call with Dana' or 'Sarah K. review'",
  "quotes": ["short lines worth quoting, word for word"],
  "pains": ["specific problems or frustrations they describe"],
  "desires": ["what they want, the outcome they're after"],
  "objections": [{ "objection": "a reason they hesitated or said no, in their words", "answer": "the seller's answer if one is given, else empty" }],
  "results": ["concrete results or numbers stated, e.g. '11 calls in 3 weeks'"],
  "words": ["2 to 6 word phrases they use that a marketer could reuse"],
  "tried": ["what they tried before that didn't work"],
  "whyBought": ["why they bought or what tipped them over"],
  "story": { "before": "", "turn": "", "after": "" } or null if there's no before and after,
  "testimonial": { "quote": "the best single quote, word for word", "name": "their name if given, else empty", "role": "who they are if given, else empty", "result": "their result if stated, else empty" } or null if it isn't a testimonial
}`;
}

export function parseRead(raw: string): ReadResult {
  const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new Error("Couldn't read the AI's answer.");
  }
  const d = readSchema.parse(json);
  const learned: Learned = {
    ...emptyLearned(),
    quotes: d.quotes,
    pains: d.pains,
    desires: d.desires,
    objections: d.objections.map((o) => ({ objection: o.objection.trim(), answer: o.answer.trim() })),
    results: d.results,
    words: d.words,
    tried: d.tried,
    whyBought: d.whyBought,
    story: d.story && (d.story.before || d.story.after) ? d.story : null,
    testimonial: d.testimonial && d.testimonial.quote.trim() ? d.testimonial : null,
  };
  // A testimonial with nothing to quote is just a message.
  const kind: InsightKind = d.kind === "testimonial" && !learned.testimonial ? "message" : d.kind;
  return { kind, title: d.title.trim().slice(0, 60) || "New insight", learned };
}

export async function readInsight(input: ReadInput): Promise<ReadResult> {
  if (!input.text?.trim() && !input.images?.length) throw new Error("Nothing to read.");
  const prompt = buildReadPrompt(input);
  const content = input.images?.length
    ? [
        { type: "text" as const, text: prompt },
        ...input.images.slice(0, 4).map((url) => ({ type: "image_url" as const, image_url: { url } })),
      ]
    : prompt;
  const res = await chat({
    model: UTILITY_MODEL,
    maxTokens: 1500,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
  });
  return parseRead(res.choices[0]?.message?.content ?? "");
}

/** Plain-words chips for "what we learned", e.g. ["2 objections", "1 quote"]. */
export function learnedChips(l: Learned): string[] {
  const n = (count: number, one: string, many = `${one}s`) => (count ? `${count} ${count === 1 ? one : many}` : "");
  return [
    l.testimonial ? "Testimonial" : "",
    n(l.results.length, "result"),
    n(l.objections.length, "objection"),
    n(l.pains.length, "pain"),
    n(l.desires.length, "want"),
    n(l.quotes.length, "quote"),
    l.story ? "Story" : "",
    n(l.words.length, "phrase"),
  ].filter(Boolean);
}
