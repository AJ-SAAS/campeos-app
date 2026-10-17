import { z } from "zod";
import { getOpenAIClient, UTILITY_MODEL } from "./client";

const themesSchema = z.object({ themes: z.array(z.string()).min(1).max(5) });

/**
 * Pulls 3-5 short, buyer-language themes out of a pasted sales call
 * transcript — the real reasons this person wanted (or hesitated on)
 * the offer, close to their own words. These feed into the "Why people
 * buy" panel and into every copy-generation prompt from then on.
 */
export async function analyzeSalesCall(transcript: string): Promise<string[]> {
  const prompt = `Here is a transcript of a sales call for an offer.

${transcript}

Pull out 3 to 5 short phrases (5 words or less each) that capture the
real reasons this buyer wanted the offer, or hesitated on it, close to
their own words. Think of them as buyer-language themes a marketer
could reuse in ad copy, like "tired of doing it alone" or "wants a plan
to follow".

Return ONLY a JSON object in this exact shape: { "themes": ["...", "...", ...] }`;

  const response = await getOpenAIClient().chat.completions.create({
    model: UTILITY_MODEL,
    max_tokens: 300,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("The AI returned no themes.");
  }

  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse the theme response as JSON: ${cleaned.slice(0, 200)}`);
  }

  const result = themesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Theme response didn't match the expected shape: ${result.error.message}`);
  }

  return result.data.themes;
}
