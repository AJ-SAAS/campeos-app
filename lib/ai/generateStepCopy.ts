import { z } from "zod";
import { getClaudeClient, CLAUDE_MODEL } from "./client";
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

  const response = await getClaudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = extractText(response);
  const parsed = parseJson(text);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Claude's response for step "${step.title}" didn't match the expected shape: ${result.error.message}`
    );
  }

  // The schema is built dynamically from the step's field list, so zod
  // can only infer a generic index-signature type for it here. The
  // actual shape is guaranteed by schemaForFields (source + one key per
  // field, all strings), so this cast is safe.
  return result.data as GeneratedStepCopy & { source: string };
}

/**
 * Asks Claude to change one thing about an already-generated step, per
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

  const shape: Record<string, z.ZodTypeAny> = { changed: z.string() };
  for (const key of Object.keys(currentCopy)) {
    shape[key] = z.string();
  }
  const schema = z.object(shape);

  const response = await getClaudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = extractText(response);
  const parsed = parseJson(text);
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `Claude's variation response didn't match the expected shape: ${result.error.message}`
    );
  }

  // Same reasoning as generateStepCopy above: the dynamic schema only
  // infers a generic shape, but schemaForFields guarantees the real one.
  return result.data as GeneratedStepCopy & { changed: string };
}

function extractText(response: { content: Array<{ type: string; text?: string }> }): string {
  const block = response.content.find((b) => b.type === "text");
  if (!block?.text) {
    throw new Error("Claude returned no text content.");
  }
  return block.text;
}

function parseJson(text: string): unknown {
  // Claude sometimes wraps JSON in a code fence even when asked not to.
  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Could not parse Claude's response as JSON: ${cleaned.slice(0, 200)}`);
  }
}
