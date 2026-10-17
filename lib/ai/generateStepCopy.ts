import { z } from "zod";
import { getOpenAIClient, COPY_MODEL } from "./client";
import {
  buildStepCopyPrompt,
  buildVariationPrompt,
  OfferContext,
  StepContext,
  SourceMaterial,
} from "./prompts";

// The schema is built per-step from its field spec, since fields differ
// by channel (email has subject+body, sms has just body, ads have
// headline+primaryText). "source" is always required — it's what powers
// the "Built from" tag in the UI.
function schemaForFields(fields: StepContext["fields"]) {
  const shape: Record<string, z.ZodTypeAny> = { source: z.string() };
  for (const field of fields) {
    shape[field.key] = z.string();
  }
  return z.object(shape);
}

export interface GeneratedStepCopy {
  [fieldKey: string]: string;
}

/**
 * Generates copy for a single step. Meant to be called once per step and
 * run in parallel (Promise.all) across a whole campaign — see
 * app/api/generate-step/route.ts.
 */
export async function generateStepCopy(
  offer: OfferContext,
  step: StepContext,
  source: SourceMaterial
): Promise<GeneratedStepCopy & { source: string }> {
  const prompt = buildStepCopyPrompt(offer, step, source);
  const schema = schemaForFields(step.fields);

  const response = await getOpenAIClient().chat.completions.create({
    model: COPY_MODEL,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = extractText(response);
  const parsed = parseJson(text);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `The AI's response for step "${step.title}" didn't match the expected shape: ${result.error.message}`
    );
  }

  stripEmDashes(result.data as Record<string, unknown>);

  // The schema is built dynamically from the step's field list, so zod
  // can only infer a generic index-signature type for it here. The
  // actual shape is guaranteed by schemaForFields (source + one key per
  // field, all strings), so this cast is safe.
  return result.data as GeneratedStepCopy & { source: string };
}

/**
 * Asks the model to change one thing about an already-generated step, per
 * the user's instruction from the AskCampeosBar. Never rewrites
 * everything — see buildVariationPrompt's rules.
 */
export async function generateStepVariation(
  offer: OfferContext,
  step: StepContext,
  currentCopy: Record<string, string>,
  instruction: string
): Promise<GeneratedStepCopy & { changed: string }> {
  const prompt = buildVariationPrompt(offer, step, currentCopy, instruction);

  // "source" is metadata about where the copy came from ("your winning
  // headline", "campaign template"), not editable copy — it shouldn't be
  // part of what the model is asked to change or required to echo back.
  // Requiring it here meant every variation request failed schema
  // validation the moment the model (correctly, per the "change ONE
  // thing" rule) left it out of a reply that only touched one other field.
  const shape: Record<string, z.ZodTypeAny> = { changed: z.string() };
  for (const key of Object.keys(currentCopy)) {
    if (key === "source") continue;
    shape[key] = z.string();
  }
  const schema = z.object(shape);

  const response = await getOpenAIClient().chat.completions.create({
    model: COPY_MODEL,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = extractText(response);
  const parsed = parseJson(text);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `The AI's variation response didn't match the expected shape: ${result.error.message}`
    );
  }

  stripEmDashes(result.data as Record<string, unknown>);

  // Same reasoning as generateStepCopy above: the dynamic schema only
  // infers a generic shape, but schemaForFields guarantees the real one.
  return result.data as GeneratedStepCopy & { changed: string };
}

// Belt-and-suspenders for the "never use em dashes" rule in
// lib/ai/prompts.ts's COPY_RULES — the prompt asks for this, but a real
// generated campaign still came back with one in a headline (CLAUDE.md
// and the user's own saved preference both call this non-negotiable, so
// a prompt-only guarantee isn't good enough). Mutates every string field
// in place; "—" becomes ", " mid-sentence-ish and a period at a clause
// end reads fine either way, so a comma is the safer universal swap.
function stripEmDashes(data: Record<string, unknown>): void {
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (typeof value === "string") {
      data[key] = value.replace(/\s*—\s*/g, ", ").replace(/,\s*$/, ".");
    }
  }
}

function extractText(response: {
  choices: Array<{ message: { content: string | null } }>;
}): string {
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("The AI returned no text content.");
  }
  return text;
}

function parseJson(text: string): unknown {
  // The model sometimes wraps JSON in a code fence even when asked not to.
  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Could not parse the AI's response as JSON: ${cleaned.slice(0, 200)}`);
  }
}
