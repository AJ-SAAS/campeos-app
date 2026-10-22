import { z } from "zod";
import { chat, UTILITY_MODEL } from "./client";
import type { OfferContext, StepContext } from "./prompts";

// The quality gate between the model and the user. Generic copy is the
// one thing Campeos can't ship, so every message is checked twice before
// anyone sees it:
//
// 1. lintCopy: free, instant rules. AI-sounding words, filler openers,
//    hype, too many blanks, texts that are too long, subject lines that
//    run on.
// 2. critiqueCopy: a cheap, fast model grades it like an editor would,
//    against the brief: is it specific to this reader, does it run the
//    play, does it sound like a person, did it invent any facts.
//
// Anything that fails gets one rewrite with the editor's notes (see
// generateStepCopy). One rewrite, not a loop: it keeps the cost and the
// wait predictable.

/** Words and phrases that make copy read as AI or as generic marketing. */
const BANNED: { re: RegExp; say: string }[] = [
  ["unlock", "unlock"],
  ["game[- ]?chang(er|ing)", "game-changer"],
  ["revolutionary", "revolutionary"],
  ["supercharge", "supercharge"],
  ["skyrocket", "skyrocket"],
  ["elevate", "elevate"],
  ["next level", "next level"],
  ["in today'?s (fast[- ]paced|digital|busy|world)", "in today's world"],
  ["fast[- ]paced", "fast-paced"],
  ["look no further", "look no further"],
  ["dive (in|into|deep)", "dive in"],
  ["embark", "embark"],
  ["journey", "journey"],
  ["unleash", "unleash"],
  ["harness", "harness"],
  ["seamless(ly)?", "seamless"],
  ["cutting[- ]edge", "cutting-edge"],
  ["empower(ing|ment)?", "empower"],
  ["delve", "delve"],
  ["tapestry", "tapestry"],
  ["realm", "realm"],
  ["landscape", "landscape"],
  ["imagine a world", "imagine a world"],
  ["are you tired of", "are you tired of"],
  ["don'?t miss out", "don't miss out"],
  ["spots are filling (up )?fast", "spots are filling fast"],
  ["hope this (email )?finds you", "hope this finds you"],
  ["without further ado", "without further ado"],
  ["transform your (life|business)", "transform your life"],
  ["secret sauce", "secret sauce"],
  ["buckle up", "buckle up"],
  ["the wait is over", "the wait is over"],
  ["(excited|thrilled) to (announce|share)", "excited to announce"],
  ["testament to", "a testament to"],
  ["it'?s (no secret|important to note)", "it's no secret"],
  ["whether you'?re a", "whether you're a..."],
].map(([pattern, say]) => ({ re: new RegExp(`\\b${pattern}\\b`, "i"), say }));

/** Openers that describe a category of people instead of one moment. */
const WEAK_OPENERS = /^(are you|do you ever|have you ever|imagine|as a|if you'?re like most|we all know|let'?s face it|in today)/i;

/** Words too common to prove an ad is about THIS offer. */
const GENERIC_WORDS = new Set([
  "that", "this", "with", "your", "from", "have", "will", "they", "them", "their", "what", "when", "were", "been",
  "into", "more", "most", "some", "just", "like", "make", "take", "good", "free", "work", "works", "done", "also",
  "only", "every", "about", "other", "people", "business", "owners", "owner", "online", "service", "services",
]);

const ALLOWED_TAGS = /\[(LINK|FIRST NAME)\]|\[IMAGE:[^\]]*\]/g;

export function lintCopy(
  copy: Record<string, string>,
  step: Pick<StepContext, "channel" | "play">,
  /** The offer's own words: a banned word that's part of the offer
   * (a landscaping business, a "Journey" program) is allowed. */
  allow = ""
): string[] {
  const problems: string[] = [];
  const fields = Object.entries(copy).filter(([k]) => k !== "source" && k !== "visual");
  const all = fields.map(([, v]) => v).join("\n");

  const found = BANNED.filter((b) => b.re.test(all) && !b.re.test(allow)).map((b) => `"${b.say}"`);
  if (found.length) problems.push(`Uses words that sound like AI or generic marketing: ${found.join(", ")}. Say it the way a person would.`);

  const body = copy.body ?? copy.primaryText ?? copy.caption ?? "";
  const firstReal = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => !/^(hey|hi|hello|yo)\b.{0,25}[,!]?$/i.test(l) && !/^\[?first name\]?,?$/i.test(l) && !/here\.?$/i.test(l));
  if (firstReal && WEAK_OPENERS.test(firstReal) && !step.play?.beats[0]?.toLowerCase().includes("question")) {
    problems.push(`The opening line ("${firstReal.slice(0, 60)}") is a generic opener. Open on a specific moment, fact or claim instead.`);
  }

  // An ad has to say what it sells. The Oct 2026 walkthrough produced an ad
  // about "a text about promo results" for a $99 ads service that never
  // named the service or who it was for.
  if (step.channel === "ad" && allow.trim()) {
    const opening = `${copy.headline ?? ""} ${body.slice(0, 280)}`.toLowerCase();
    const words = allow
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
    if (words.length > 0 && !words.some((w) => opening.includes(w.slice(0, Math.max(4, w.length - 2))))) {
      problems.push("The ad never says what you're selling or who it's for. Name the offer or the reader's exact situation in the headline or first line.");
    }
  }

  const bangs = (body.match(/!/g) ?? []).length;
  if (bangs > 2) problems.push(`${bangs} exclamation marks. Use one at most; let the words do the work.`);

  const blanks = (all.replace(ALLOWED_TAGS, "").match(/\[[A-Z][^\]]*\]/g) ?? []).length;
  if (blanks > 5) problems.push(`${blanks} [PLACEHOLDERS]. Too many blanks for the user to fill. Keep only the facts that truly must come from them.`);

  if (step.channel === "sms" && body.length > 320) problems.push(`The text is ${body.length} characters. Keep it under 300.`);
  if (step.channel === "social" && (body.match(/#\w+/g) ?? []).length > 3) problems.push("More than 3 hashtags. Keep it to 3 at most.");
  if (step.channel === "email" && (copy.headline ?? "").length > 65) problems.push("The subject line is too long. Keep it under 50 characters.");
  if (/—| – /.test(all)) problems.push("Contains a dash used as punctuation. Use a period or comma.");

  return problems;
}

const critiqueSchema = z.object({
  score: z.number(),
  problems: z.array(z.string()).max(6),
});

/** Everything the writer was told is true. A checker that only sees part
 * of this calls real details "invented" and the rewrite then replaces
 * them with blanks, making the copy worse (found in the Oct 2026 test). */
export function knownFacts(offer: OfferContext, step: StepContext): string[] {
  const b = step.brief;
  return [
    offer.name && `Offer name: ${offer.name}`,
    offer.price && `Price: ${offer.price}`,
    offer.audience && `Who it's for: ${offer.audience}`,
    offer.whatTheyGet && `What they get (includes any guarantee stated here): ${offer.whatTheyGet}`,
    offer.fromName && `The sender signs as: ${offer.fromName}`,
    step.eventAt && `The event / key date: ${step.eventAt}`,
    step.scheduledAt && `This message sends: ${step.scheduledAt}`,
    ...(b?.offer.stack ?? []).map((x) => `Included: ${x}`),
    b?.offer.risk && `Risk reversal: ${b.offer.risk}`,
    b?.offer.urgency && `Urgency: ${b.offer.urgency}`,
    ...(b?.proof.facts ?? []).map((x) => `Proof: ${x}`),
  ].filter(Boolean) as string[];
}

/** What "good" means for each channel, so a 2-line text isn't graded like
 * a long email (short formats scored lowest in the Oct 2026 eval). */
const CHANNEL_BAR: Record<string, string> = {
  sms: "This is a text message. Judge it as a text from a person they know: one clear point, one reason to act, under 300 characters. Short is right; don't ask for story or proof.",
  ad: "This is a paid ad. Judge the first line as a scroll-stopper for THIS reader, one promise, one call to action. The headline must name their situation or the result, not the product.",
  social: "This is an organic social post. Judge the first line (it's all most people see), short lines, and one call to action. It should read like the seller posting, not a brand.",
  email: "This is an email. Judge the subject line and first two lines hardest: they decide if it's read at all.",
};

export async function critiqueCopy(
  copy: Record<string, string>,
  step: StepContext,
  offer: OfferContext
): Promise<{ score: number; problems: string[] }> {
  const shown = Object.entries(copy)
    .filter(([k]) => k !== "source")
    .map(([k, v]) => `${k}:\n${v}`)
    .join("\n\n");
  const facts = knownFacts(offer, step);
  const prompt = `You are a tough direct-response copy chief reviewing one ${step.channel} message
for "${offer.name}". Message: "${step.title}"${step.play ? `, built from the "${step.play.name}" play (job: ${step.play.job})` : ""}.
${step.brief ? `Reader: ${step.brief.reader.who}\nTheir moment: ${step.brief.reader.moment}` : ""}
${step.focus ? `Its angle: ${step.focus}` : ""}

THE COPY:
${shown}

EVERYTHING BELOW IS TRUE, given by the seller. Using any of it is correct, never "invented":
${facts.map((f) => `- ${f}`).join("\n")}

${CHANNEL_BAR[step.channel] ?? ""}
Score it 1 to 10 where 7 means "a good copywriter would send this" and 9 means "excellent".
Judge the WRITING. Mark it down for:
- Generic: lines that would still work for a different business or audience.
- Not running the play: you can't tell which play or technique this is.
- Sounding like AI or a template: hype, filler, canned stock lines ("this email will make some people mad", "sorry for the long email", "I look forward to seeing your result"), "whether you're X or Y".
- Doesn't say what's being sold: within the first two lines the reader can't tell what the offer is or who it's for.
- Weak subject line or hook: vague, or clickbait the body doesn't pay off.
- Hard to skim: dense paragraphs.
- Invented facts: ONLY a result, number, testimonial, customer name, credential or guarantee that is NOT in the true list above and NOT written as a [PLACEHOLDER].
Do NOT mark down for:
- [PLACEHOLDERS] where real proof or the seller's story is missing. They are expected. Never suggest replacing a true fact with a placeholder.
- [FIRST NAME], [LINK] or [IMAGE: ...] tags.

Return ONLY JSON: { "score": <1-10>, "problems": ["specific, fixable notes about the writing, quoting the weak line, max 5. Empty if 8 or above"] }`;

  const res = await chat({
    model: UTILITY_MODEL,
    maxTokens: 500,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const parsed = critiqueSchema.safeParse(JSON.parse(text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim()));
  if (!parsed.success) throw new Error("critic returned an unexpected shape");
  return parsed.data;
}

/** Counts [BLANKS] the user would have to fill, ignoring merge tags. */
export function blankCount(copy: Record<string, string>): number {
  return Object.entries(copy)
    .filter(([k]) => k !== "source")
    .map(([, v]) => v)
    .join("\n")
    .replace(ALLOWED_TAGS, "")
    .match(/\[[A-Z][^\]]*\]/g)?.length ?? 0;
}

/** Below this, a message is rewritten once before the user sees it, and
 * the better of the two versions is kept. 7 = "a good copywriter would send this". */
export const PASS_SCORE = 7;
