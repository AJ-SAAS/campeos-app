import { z } from "zod";
import { getOpenAIClient, OPENAI_MODEL } from "./client";
import {
  buildStepCopyPrompt,
  buildVariationPrompt,
  OfferContext,
  StepContext,
  SourceMaterial,
} from "./prompts";

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

export async function generateStepCopy(
  offer: OfferContext,
  step: StepContext,
  source: SourceMaterial
): Promise<GeneratedStepCopy & { source: string }> {
  const prompt = buildStepCopyPrompt(offer, step, source);
  const schema = schemaForFields(step.fields);

  const response = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL,
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

  return result.data as GeneratedStepCopy & { source: string };
}

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

  const response = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL,
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

  return result.data as GeneratedStepCopy & { changed: string };
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
