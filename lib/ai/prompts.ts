import { StepFieldSpec } from "../templates/types";

export interface OfferContext {
  name: string;
  price: string;
  audience: string;
  whatTheyGet: string;
  tone: string;
}

export interface StepContext {
  channel: string;
  title: string;
  purpose: string;
  angle: string;
  fields: StepFieldSpec[];
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
const COPY_RULES = `Rules you must follow:
- Never invent facts: no testimonials, customer names, numbers, or results
  the offer details don't include. If a fact is missing, write a
  placeholder in [ALL CAPS], like [CUSTOMER NAME] or [RESULT].
- Write at roughly a 5th-grade reading level. Short sentences. Plain
  words. No jargon unless the offer itself uses it.
- Never use em dashes.
- Sound like a person talking, not an ad. Avoid hype words like
  "revolutionary", "game-changing", "unlock", "supercharge".
- If winning copy or call themes are given below, use them as the raw
  material for this step's angle. Don't just repeat them word for word;
  write new copy that carries the same idea.`;

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

  const fieldsBlock = step.fields
    .map((f) => `- "${f.key}": ${f.label} (${f.kind === "short" ? "one line" : "a few short paragraphs"})`)
    .join("\n");

  return `You are writing one step of a marketing campaign for this offer:

Offer: ${offer.name}
Price: ${offer.price}
Audience: ${offer.audience}
What they get: ${offer.whatTheyGet}
Tone: ${offer.tone}

This step:
Channel: ${step.channel}
Title: ${step.title}
Why this step exists: ${step.purpose}
Sales angle to play: ${step.angle}

${winningCopyBlock}

${callThemesBlock}

${COPY_RULES}

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
  const currentBlock = Object.entries(currentCopy)
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

${COPY_RULES}

Return ONLY a JSON object with the same keys as the current copy above,
plus a "changed" key describing in a few words what you changed.`;
}
