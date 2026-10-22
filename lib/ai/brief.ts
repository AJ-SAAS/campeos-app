import { z } from "zod";
import { chat, COPY_MODEL } from "./client";
import { OfferContext, SourceMaterial } from "./prompts";

// The buyer brief: the research a great copywriter does before writing a
// single line, done once per campaign and handed to every message.
//
// Why it exists: copy written straight from five short offer fields comes
// out generic, because the model fills every gap with safe filler. The
// brief fills those gaps with specifics first (the reader's real moment,
// their words, the belief to flip, the objections), built on the master
// persuasion checklist: audience, pain, desire, stakes, solution, proof,
// objections, story, offer, risk, urgency (the 12 categories studied
// across Schwartz, Hopkins, Ogilvy, Halbert, Caples and Sugarman).
//
// The never-invent-facts rule holds here too. Psychology (what the reader
// feels, fears and wants) is inferred, and that's the point. Facts (proof,
// numbers, testimonials, guarantees, the founder's story) only come from
// what the user gave us; anything missing is listed as a placeholder.

export const briefSchema = z.object({
  reader: z.object({
    who: z.string(),
    moment: z.string(),
    alreadyBelieves: z.string(),
    awareness: z.string(),
  }),
  words: z.array(z.string()).max(12),
  pains: z.array(z.string()).max(8),
  consequences: z.array(z.string()).max(5),
  desires: z.array(z.string()).max(8),
  identity: z.string(),
  stakes: z.string(),
  enemy: z.string(),
  mechanism: z.string(),
  bigIdea: z.string(),
  proof: z.object({
    facts: z.array(z.string()).max(12),
    missing: z.array(z.string()).max(8),
  }),
  objections: z
    .array(z.object({ objection: z.string(), answer: z.string() }))
    .max(8),
  story: z.object({
    before: z.string(),
    turn: z.string(),
    after: z.string(),
  }),
  offer: z.object({
    stack: z.array(z.string()).max(10),
    risk: z.string(),
    urgency: z.string(),
  }),
  hooks: z.array(z.string()).max(10),
  avoid: z.array(z.string()).max(10),
});

export type CampaignBrief = z.infer<typeof briefSchema>;

export interface BriefInput {
  offer: OfferContext;
  source: SourceMaterial & { salesPage?: string };
  /** The campaign type, e.g. "Webinar launch", and what it's for. */
  campaignType?: string;
  /** When the event or sale happens / ends, human formatted. */
  eventAt?: string;
}

export function buildBriefPrompt({ offer, source, campaignType, eventAt }: BriefInput): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "(none given)");
  return `You are a senior direct-response copywriter doing research before writing a
campaign. You have studied Schwartz (awareness, desire), Hopkins (reason why,
proof), Ogilvy (research, specificity), Halbert (one reader, conversational),
Caples (headlines) and Sugarman (curiosity, story). Build the brief every
message in this campaign will be written from.

THE OFFER
Name: ${offer.name || "(not given)"}
Price: ${offer.price || "(not given)"}
Who it's for: ${offer.audience || "(not given)"}
What they get: ${offer.whatTheyGet || "(not given)"}
Tone: ${offer.tone || "(not given)"}
Campaign type: ${campaignType || "(not given)"}
${eventAt ? `Event / key date: ${eventAt}` : ""}

FROM THEIR SALES PAGE (their own words, may be partial):
${source.salesPage?.trim() ? source.salesPage.trim().slice(0, 3000) : "(none given)"}

LINES THAT ALREADY WORKED, OR TESTIMONIALS THEY SAVED:
${list(source.winningCopy)}

WHAT BUYERS SAID ON SALES CALLS:
${list(source.callThemes)}

HOW TO THINK
Enter the conversation already happening in the reader's head. Be concrete
and specific to THIS offer and THIS reader. If a line would still work after
swapping in a different business, it's too generic: rewrite it.

TWO KINDS OF CONTENT, TWO RULES
1. Psychology (who they are, their moment, pains, desires, fears,
   objections, the belief to flip, the words they'd use): INFER this
   boldly from the offer and audience, like an expert who has talked to
   hundreds of these buyers. This is the point of the brief.
2. Facts (results, numbers, testimonials, customer names, guarantees,
   credentials, the founder's personal story, deadlines, bonuses): ONLY
   from what is given above. Never invent one. List what's missing so
   the writer uses a [PLACEHOLDER] instead.

WRITE MATERIAL, NOT NOTES
Every field is something a copywriter will build lines from, so write it as
usable material. Never put notes or warnings inside a field ("not provided",
"not stated", "do not claim", "needs to be confirmed"). If something is
unknown, leave that field short or empty. Warnings belong ONLY in "avoid",
and missing proof ONLY in "proof.missing" (at most 5, short, like [TESTIMONIAL]).

Return ONLY a JSON object with exactly these keys:
{
  "reader": {
    "who": "one sentence: the specific person, their situation and stage",
    "moment": "one small, lived-in scene where the problem shows up in their day, written so they'd think 'that's exactly my week'",
    "alreadyBelieves": "what they already believe about this problem and the usual fixes",
    "awareness": "one of: unaware, problem aware, solution aware, product aware, most aware. Plus 3 words on what that means for the copy"
  },
  "words": ["6-12 short phrases in the reader's own words: how they'd describe the problem and what they want, as they'd say it to a friend"],
  "pains": ["4-8 specific pains: surface problems, daily frustrations, emotional costs. Concrete, never abstract"],
  "consequences": ["2-5 practical or future costs if nothing changes: time, money, energy, missed chances"],
  "desires": ["4-8 specific outcomes and emotional payoffs they want, the after-state, made tangible"],
  "identity": "who they want to become and how they want others to see them",
  "stakes": "why solving it matters now, the cost of waiting, in one or two sentences",
  "enemy": "the common belief or usual approach that keeps them stuck (the sacred cow to flip), and why it fails",
  "mechanism": "how this offer gets the result, in plain words, from what's given. If not given, describe it only in general terms the offer supports",
  "bigIdea": "the one central idea the whole campaign is organized around, one sentence",
  "proof": {
    "facts": ["every real proof point given above: results, testimonials (quote them), numbers, credentials. Empty if none"],
    "missing": ["proof the writer will need as placeholders, e.g. [TESTIMONIAL], [NUMBER OF STUDENTS], [GUARANTEE]"]
  },
  "objections": [{ "objection": "a real reason they'd say no, in their words", "answer": "an honest answer using only given facts or reasoning" }],
  "story": {
    "before": "the before-state a customer story or founder story would open on (psychology, not invented events)",
    "turn": "the realization or discovery that changes things",
    "after": "the after-state"
  },
  "offer": {
    "stack": ["what's included, from what's given"],
    "risk": "the guarantee or risk reversal in plain words if one is given, otherwise exactly an empty string",
    "urgency": "the real reason to act now in plain words (the event date, a real deadline) if there is one, otherwise exactly an empty string"
  },
  "hooks": ["6-10 distinct opening lines or angles, each a different entry point: a moment, a contrarian claim, a question they'd nod at, a specific number from the facts, a confession, a future scene"],
  "avoid": ["clichés and claims this market is tired of hearing, specific to this niche"]
}`;
}

export async function buildBrief(input: BriefInput): Promise<CampaignBrief> {
  const response = await chat({
    model: COPY_MODEL,
    maxTokens: 2400,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildBriefPrompt(input) }],
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("The AI returned no brief.");
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Could not read the brief.");
  }
  const result = briefSchema.safeParse(trimArrays(parsed));
  if (!result.success) throw new Error(`The brief didn't match the expected shape: ${result.error.message}`);
  return result.data;
}

/** Models sometimes return a few more items than asked; keep the first ones. */
function trimArrays(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const limits: Record<string, number> = { words: 12, pains: 8, consequences: 5, desires: 8, objections: 8, hooks: 10, avoid: 10, facts: 12, missing: 8, stack: 10 };
  const walk = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v) && limits[k]) obj[k] = v.slice(0, limits[k]);
      else if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Record<string, unknown>);
    }
  };
  walk(value as Record<string, unknown>);
  return value;
}

/** The brief as compact text for a single message's prompt. */
export function briefForPrompt(b: CampaignBrief): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return `THE BUYER BRIEF (your research for this campaign; write from it)
Reader: ${b.reader.who}
Their moment: ${b.reader.moment}
They already believe: ${b.reader.alreadyBelieves}
Awareness: ${b.reader.awareness}
Identity they want: ${b.identity}
Stakes: ${b.stakes}
The enemy (belief to flip): ${b.enemy}
How it works (mechanism): ${b.mechanism}
Big idea: ${b.bigIdea}

Their words (use these phrases, not marketing words):
${list(b.words)}

Pains:
${list(b.pains)}

If nothing changes:
${list(b.consequences)}

Desires:
${list(b.desires)}

Objections and honest answers:
${b.objections.map((o) => `- "${o.objection}" -> ${o.answer}`).join("\n")}

Story arc: before: ${b.story.before} | turn: ${b.story.turn} | after: ${b.story.after}

Offer stack:
${list(b.offer.stack)}
Risk reversal: ${b.offer.risk || "(none given: use [GUARANTEE] if needed)"}
Real urgency: ${b.offer.urgency || "(none given: never invent scarcity)"}

PROOF YOU MAY USE (real, given by the user):
${b.proof.facts.length ? list(b.proof.facts) : "(none: every result, number and testimonial must be a [PLACEHOLDER])"}
Proof that's missing (use as placeholders): ${b.proof.missing.join(", ") || "(none)"}

Clichés this market is tired of (never use): ${b.avoid.join("; ")}`;
}

/** What a message opens on, so messages in one campaign don't repeat. */
export function focusFor(b: CampaignBrief, kind: string, index: number): string {
  const pick = (items: string[]) => (items.length ? items[index % items.length] : "");
  switch (kind) {
    case "pain":
      return pick(b.pains);
    case "desire":
      return pick(b.desires);
    case "objection":
      return b.objections.length ? b.objections[index % b.objections.length].objection : "";
    case "proof":
      return pick(b.proof.facts) || "a result (as a placeholder unless real)";
    case "story":
      return `${b.story.before} -> ${b.story.turn}`;
    case "enemy":
      return b.enemy;
    case "urgency":
      return b.offer.urgency || pick(b.consequences);
    case "offer":
      return pick(b.offer.stack) || b.mechanism;
    case "curiosity":
    default:
      return pick(b.hooks);
  }
}
