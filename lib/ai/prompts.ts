import { StepFieldSpec } from "../templates/types";

/** The reading-level labels shown in Setup's selector. Plain strings, not
 * a strict grade number, so the prompt can hand the model something it
 * understands directly ("Write at roughly a 5th-grade reading level"). */
export const READING_LEVELS = ["5th grade", "7th grade", "9th grade", "Professional"] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export interface OfferContext {
  name: string;
  price: string;
  audience: string;
  whatTheyGet: string;
  tone: string;
  /**
   * One of READING_LEVELS, but typed as a plain string (not the union)
   * since this value round-trips through Firestore and a zod schema
   * that can't guarantee the exact literal — buildCopyRules falls back
   * to "5th grade" for anything it doesn't recognize. Optional so
   * existing OfferContext values (saved campaigns, the agent's profile
   * memory) built before this existed still compile and still work.
   */
  readingLevel?: string;
  /**
   * The signed-in user's own display name, used to sign off emails for
   * real instead of leaving a [YOUR NAME] placeholder — which, before
   * this existed, was the single biggest source of "needs input" flags
   * across a campaign (every email ends with a sign-off). Optional:
   * when missing, the prompt tells the model to sign off without a name
   * at all rather than invent a bracket placeholder for it.
   */
  fromName?: string;
}

export interface StepContext {
  channel: string;
  title: string;
  purpose: string;
  angle: string;
  /** 2-4 concrete things this step needs to accomplish — see
   * lib/templates/types.ts. Optional so older callers that haven't been
   * updated to pass it still compile; buildStepCopyPrompt treats a
   * missing/empty list as "nothing extra to add". */
  goals?: string[];
  /** Which levers from the master persuasion checklist this step should
   * pull on — e.g. "Objections: price" — see StepTemplate in
   * lib/templates/types.ts. Optional for the same reason as `goals`. */
  persuasionElements?: string[];
  /** The campaign phase this step belongs to and what that phase as a
   * whole is trying to do — see CampaignPhase in lib/templates/types.ts.
   * Also optional for the same reason as `goals`. */
  phaseName?: string;
  phaseObjective?: string;
  /**
   * When this specific step is scheduled to go out, formatted for a human
   * (e.g. "Thursday, October 15 at 7:00 PM") — so copy that needs to
   * reference a real day or time doesn't fall back to a [TIME] or [DATE]
   * placeholder it didn't need to.
   */
  scheduledAt?: string;
  /** When the webinar itself goes live, same formatting as scheduledAt —
   * distinct from scheduledAt because most steps need to reference the
   * EVENT's time ("set your alarm for 7 PM"), not their own send time. */
  eventAt?: string;
  fields: StepFieldSpec[];
}

// Turns a Date into something the AI prompt can quote directly in copy
// ("set your alarm for 7:00 PM") instead of falling back to a [TIME] or
// [DATE] placeholder — see StepContext.scheduledAt/eventAt above. Shared
// so the Builder page and the agent's own campaign-building path
// (lib/ai/agentActions.ts) format it identically.
export function formatForPrompt(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface SourceMaterial {
  /** Pasted headlines/subject lines that already converted for this user. */
  winningCopy: string[];
  /** Short buyer-language themes pulled from sales calls, e.g. "tired of doing it alone". */
  callThemes: string[];
}

// The rules here mirror CLAUDE.md's "copy rules" section exactly. If you
// change the rules there, change them here too — this is where they
// actually reach the model.
const READING_LEVEL_INSTRUCTION: Record<ReadingLevel, string> = {
  "5th grade":
    "Write at roughly a 5th-grade reading level. Short sentences. Plain words. No jargon.",
  "7th grade":
    "Write at roughly a 7th-grade reading level. Mostly short sentences, a few longer ones for rhythm. Everyday words over jargon, but don't over-simplify ideas that need a little nuance.",
  "9th grade":
    "Write at roughly a 9th-grade reading level. Natural sentence variety. Some industry terms are fine if the offer itself uses them, but still explain anything genuinely unfamiliar.",
  Professional:
    "Write for a professional, informed reader. Industry terms the audience would actually use are fine and expected. Still plain and direct, never bureaucratic or padded with hedging.",
};

function buildCopyRules(readingLevel: string, fromName?: string): string {
  const instruction =
    READING_LEVEL_INSTRUCTION[readingLevel as ReadingLevel] ??
    READING_LEVEL_INSTRUCTION["5th grade"];
  const signOffRule = fromName
    ? `- When an email needs a sign-off name, use "${fromName}" — that's who's sending this. Don't invent a placeholder for it.`
    : `- When an email needs a sign-off, close warmly without a name line ("Talk soon," is enough) rather than inventing a [YOUR NAME] placeholder — no name was given for this campaign.`;
  return `Rules you must follow:
- Never invent facts: no testimonials, customer names, numbers, or results
  the offer details don't include. If a fact is missing, write a
  placeholder in [ALL CAPS], like [CUSTOMER NAME] or [RESULT].
- To address the reader by name in an email, use exactly the tag
  [FIRST NAME] (that exact phrase, nothing else inside the brackets) —
  it's treated as an intentional merge tag an email tool fills in later,
  not a missing fact, so use it freely wherever a first name would read
  naturally. Never invent a specific reader name.
- Whenever copy needs to point somewhere (register, watch the replay,
  check out, join the call), use exactly the tag [LINK] — that exact
  word, nothing else inside the brackets. Never write a descriptive
  variant like [WEBINAR LINK], [REGISTRATION LINK], or [CHECKOUT LINK];
  [LINK] is the one placeholder the app always fills in automatically,
  and only that exact spelling is recognized as such.
${signOffRule}
- ${instruction}
- Never use the em dash character (—) anywhere, in a headline or a body.
  Use a period, a comma, or "and" instead. This is a hard rule, not a
  style preference — treat a sentence that needs an em dash as a sentence
  you haven't finished rewriting yet.
- Formatting for any body/primary-text field: write it the way real
  direct-response ad and email copy actually looks, broken into short
  lines of 1-2 sentences each, with a blank line between most of them.
  Put a literal newline character in the JSON string value to create
  each break. NEVER return one dense block paragraph — a reader should
  be able to skim it in 2 seconds and still get the gist from the
  shape alone, the way they'd skim a text from a friend, not a wall of
  text from a company.
- Sound like a specific person who understands this specific reader's
  specific problem, not a careful chatbot describing a generic product.
  A test: if you could swap in a different business name and audience
  and the sentence would still basically work, it's too generic, go
  back and make it concrete to THIS offer and THIS audience. Avoid hype
  words like "revolutionary", "game-changing", "unlock", "supercharge",
  and avoid generic filler closers like "don't miss out" or "spots are
  filling fast" unless the offer itself actually has a hard cap you
  were told about. Prefer a specific, slightly uncomfortable detail
  over a polite generality every time.
- Open with one concrete, lived-in moment, not a description of the
  audience as a category. "Busy moms feel chaotic in the morning" is a
  category description and is banned. "6:52 and you've found one shoe"
  is a moment. Invent a small, plausible, illustrative scene like this
  whenever the offer doesn't hand you one directly — it's a relatable
  snapshot, not a claim of fact about a real person, so it does NOT need
  a [PLACEHOLDER] the way a testimonial or number would. If the opening
  line could describe literally any member of the audience on any day,
  it hasn't done this yet; rewrite it until it's specific enough that
  the reader thinks "that's oddly exactly my morning," not "I guess
  that's sort of true."
- If winning copy or call themes are given below, use them as the raw
  material for this step's angle. Don't just repeat them word for word;
  write new copy that carries the same idea.`;
}

export function buildStepCopyPrompt(
  offer: OfferContext,
  step: StepContext,
  source: SourceMaterial
): string {
  const winningCopyBlock = source.winningCopy.length
    ? `Headlines that already worked for this user:\n${source.winningCopy
        .map((line) => `- ${line}`)
        .join("\n")}`
    : "No winning copy has been added yet.";

  const callThemesBlock = source.callThemes.length
    ? `Reasons buyers gave on sales calls, in their own words:\n${source.callThemes
        .map((line) => `- ${line}`)
        .join("\n")}`
    : "No sales call insights have been added yet.";

  // A text message and an email body are both "long" fields (the step's
  // fields are generic across channels, see StepFieldSpec), but they are
  // nothing alike in length — without a channel-specific instruction here
  // the model wrote full email-length paragraphs into SMS steps. An SMS
  // gets its own, much tighter description regardless of field kind.
  const fieldsBlock = step.fields
    .map((f) => {
      if (step.channel === "social" && f.key === "caption") {
        return `- "${f.key}": ${f.label} (an organic social post, not an ad: a scroll-stopping first line, short lines with line breaks, one clear call to action like "link in bio", at most 3 relevant hashtags at the end)`;
      }
      if ((step.channel === "social" || step.channel === "ad") && f.key === "visual") {
        return `- "${f.key}": ${f.label} (one line describing what to show, e.g. "you at your desk holding a coffee". A suggestion only, never a claim about a real photo)`;
      }
      if (step.channel === "email" && f.key === "body") {
        return `- "${f.key}": ${f.label} (formatted as real email copy, NOT a solid block paragraph — see the formatting rule below. Where a picture would help the reader, put it on a line of its own as [IMAGE: what to show], e.g. [IMAGE: you on stage holding the workbook]. Use 0 to 2 of these, only where they help, never inside a sentence. A suggestion only, never a claim about a real photo.)`;
      }
      if (step.channel === "sms") {
        return `- "${f.key}": ${f.label} (a real text message: 1-2 short sentences, under 300 characters, no subject line feel to it)`;
      }
      if (f.kind === "short") {
        return `- "${f.key}": ${f.label} (one line)`;
      }
      return `- "${f.key}": ${f.label} (formatted as real ad/email copy, NOT a solid block paragraph — see the formatting rule below)`;
    })
    .join("\n");

  const goalsBlock = step.goals?.length
    ? `This step needs to specifically accomplish:\n${step.goals.map((g) => `- ${g}`).join("\n")}`
    : "";

  const persuasionBlock = step.persuasionElements?.length
    ? `Lean specifically on these persuasion levers for this step (don't try to cram in others that aren't listed here):\n${step.persuasionElements
        .map((e) => `- ${e}`)
        .join("\n")}`
    : "";

  const readingLevel = offer.readingLevel ?? "5th grade";

  const phaseBlock = step.phaseName
    ? `This step is part of the "${step.phaseName}" phase of the campaign. That phase's objective: ${step.phaseObjective}`
    : "";

  const timingParts: string[] = [];
  if (step.eventAt) timingParts.push(`The webinar itself goes live: ${step.eventAt}.`);
  if (step.scheduledAt) timingParts.push(`This step is scheduled to send: ${step.scheduledAt}.`);
  const timingBlock = timingParts.length
    ? `${timingParts.join(" ")} Use these real values whenever the copy needs to reference a specific day or time (e.g. "set your alarm for 7 PM" or "tomorrow at 7 PM") instead of a [TIME] or [DATE] placeholder — that information isn't actually missing.`
    : "";

  return `You are writing one step of a marketing campaign for this offer:

Offer: ${offer.name}
Price: ${offer.price}
Audience: ${offer.audience}
What they get: ${offer.whatTheyGet}
Tone: ${offer.tone}

${phaseBlock}

${timingBlock}

This step:
Channel: ${step.channel}
Title: ${step.title}
Why this step exists: ${step.purpose}

Named copywriting technique this step must actually execute: "${step.angle}"
Don't just set a mood that matches this name — write copy that DOES what
the technique describes, starting with the headline or subject line, not
just the body. If the technique is "Kill the sacred cow," the headline
itself should name the belief being overturned, and the body must flip it.
If it's "Takeaway selling," the headline should signal that this isn't
for everyone, and the body must explicitly tell some readers they
shouldn't buy, not just ask "is this right for you?" A reader who has seen
real copywriting should recognize the specific technique from the
headline alone, not just notice the body reads differently from the last
email.

${goalsBlock}

${persuasionBlock}

${winningCopyBlock}

${callThemesBlock}

${buildCopyRules(readingLevel, offer.fromName)}

Return ONLY a JSON object with these exact keys and nothing else:
${fieldsBlock}
- "source": one short phrase saying what this copy was built from — e.g.
  "your winning headline", "call theme: <theme>", or "campaign template"
  if neither applied.`;
}

export function buildVariationPrompt(
  offer: OfferContext,
  step: StepContext,
  currentCopy: Record<string, string>,
  instruction: string
): string {
  // "source" is metadata about where this copy came from, not copy to
  // vary — leave it out of what the model sees as editable.
  const currentBlock = Object.entries(currentCopy)
    .filter(([key]) => key !== "source")
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `Here is the current copy for a "${step.title}" (${step.channel}) step
in a campaign for "${offer.name}":

${currentBlock}

The user asked: "${instruction}"

Change ONE thing to satisfy that request. Do not rewrite everything —
if they asked to shorten it, only shorten it; if they asked for a
different angle, only change the angle and keep the rest as close to
the original as makes sense.

${buildCopyRules(offer.readingLevel ?? "5th grade", offer.fromName)}

Return ONLY a JSON object with the same keys as the current copy above
(not "source" — leave that out), plus a "changed" key: a short lowercase
fragment completing the sentence "Done — changed ___", e.g. "the
headline's angle to focus on readiness" (not "Changed the headline's
angle...", and don't restate the word "changed" itself — the UI already
shows it).`;
}
