import { z } from "zod";
import { chat, UTILITY_MODEL } from "./client";

const offerPageSchema = z.object({
  name: z.string(),
  whatTheyGet: z.string(),
  audience: z.string(),
  price: z.string(),
  testimonials: z.array(z.string()).max(10),
  angles: z.array(z.string()).max(8),
});

export interface OfferPageExtraction {
  name: string;
  whatTheyGet: string;
  audience: string;
  price: string;
  testimonials: string[];
  angles: string[];
}

/** Below this many characters of extracted body text, treat the page as
 * effectively empty (a JS-rendered shell a plain fetch couldn't see
 * into) rather than sending it to the model — see
 * app/api/analyze-offer-page/route.ts, which is where this constant is
 * actually enforced before this function ever gets called. Exported so
 * the route and this file can't drift apart on what "too thin to read"
 * means. */
export const MIN_READABLE_LENGTH = 200;

/**
 * Pulls whatever a sales page's own visible text actually states about
 * the offer — name, what they get, audience, price, testimonials, and
 * the persuasion angles the page already leans on — so onboarding can
 * pre-fill its questions instead of starting blank. Mirrors
 * analyzeSalesCall.ts's shape exactly (same model tier, same
 * JSON-mode + zod pattern).
 *
 * Follows CLAUDE.md's "never invent facts" rule just as strictly as
 * copy generation does: every field comes back as an empty string/array
 * when the page doesn't actually say it, never a guess.
 */
export async function analyzeOfferPage(pageText: string): Promise<OfferPageExtraction> {
  const prompt = `Here is the visible text scraped from a sales/offer page:

${pageText}

Pull out ONLY what this page actually states. Do not guess, infer, or
fill in anything the text doesn't support, even if it seems obvious or
likely — an empty value is correct and expected when the page doesn't
say it.

- "name": the offer/product/program name, if stated. Otherwise "".
- "whatTheyGet": a short, concrete description of what's actually
  included, in the page's own terms. Otherwise "".
- "audience": who the page says this is for. Otherwise "".
- "price": the price exactly as shown (e.g. "$497", "$97/mo"). Otherwise "".
- "testimonials": direct quotes or close paraphrases of real customer
  testimonials/reviews/results that appear on the page, each as one
  string. An empty array if none appear. Never invent one.
- "angles": short phrases naming the persuasion angles or hooks the page
  already uses (e.g. "scarcity: limited spots", "social proof: 1,200
  students"), based only on what's actually on the page. An empty array
  if none are clear.

Return ONLY a JSON object in this exact shape:
{ "name": "", "whatTheyGet": "", "audience": "", "price": "", "testimonials": [], "angles": [] }`;

  const response = await chat({
    model: UTILITY_MODEL,
    maxTokens: 1200,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("The AI returned nothing for this page.");
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
    throw new Error(`Could not parse the offer-page response as JSON: ${cleaned.slice(0, 200)}`);
  }

  const result = offerPageSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Offer-page response didn't match the expected shape: ${result.error.message}`);
  }

  return result.data;
}
