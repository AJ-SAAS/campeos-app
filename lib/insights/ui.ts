// Small pure helpers for the Buyer insights page, onboarding and the
// builder. No Firebase, no AI, so they are testable (tests/insights.test.ts).

import { buildProfile, profileForBrief } from "./logic";
import { Credit, emptyLearned, Insight, InsightSource, ProofItem } from "./types";

/** Insights are kept per account for now, not per offer. */
export const ALL_OFFERS = "all";

export interface TestimonialInput {
  quote: string;
  name?: string;
  role?: string;
  result?: string;
  credit?: Credit;
  source?: InsightSource;
}

/**
 * The page scan returns each testimonial as one line, sometimes with the
 * author tacked on ("Great course. - Sarah K., coach"). Pulls the name and
 * role out when they are clearly there, otherwise keeps the whole line as
 * the quote. Never guesses a name.
 */
export function parseScannedTestimonial(raw: string): { quote: string; name: string; role: string } {
  const text = (raw ?? "").trim();
  const m = text.match(/^(.+?)\s+[-–—]\s+([A-Z][\p{L}.'’ ]{1,40}?)(?:,\s*([^,]{2,60}))?$/su);
  const unquote = (s: string) => s.trim().replace(/^["“'‘]+|["”'’]+$/g, "").trim();
  if (m && unquote(m[1]).length >= 10) {
    return { quote: unquote(m[1]), name: m[2].trim(), role: (m[3] ?? "").trim() };
  }
  return { quote: unquote(text), name: "", role: "" };
}

/** A testimonial as a saveable insight (without its id and date). */
export function testimonialInsight(
  uid: string,
  t: TestimonialInput
): Omit<Insight, "id" | "createdAt"> {
  const quote = t.quote.trim();
  const name = (t.name ?? "").trim();
  const role = (t.role ?? "").trim();
  const result = (t.result ?? "").trim();
  return {
    uid,
    offerId: ALL_OFFERS,
    kind: "testimonial",
    title: name ? `${name}` : quote.slice(0, 40),
    text: quote,
    source: t.source ?? "paste",
    credit: t.credit ?? (name ? "full" : "none"),
    learned: {
      ...emptyLearned(),
      quotes: quote.length <= 160 ? [quote] : [],
      results: result ? [result] : [],
      testimonial: { quote, name, role, result },
    },
  };
}

/** What the copy writer gets from a user's insights: real proof lines and
 * research lines. Proof goes in with the lines that worked, research with
 * the buyer themes. */
export function insightLines(uid: string, insights: Insight[]): { proof: string[]; research: string[] } {
  return profileForBrief(buildProfile(ALL_OFFERS, uid, insights));
}

/** The real testimonials and results, for the "Fill from your proof" button. */
export function insightProof(uid: string, insights: Insight[]): { items: ProofItem[]; results: string[] } {
  const p = buildProfile(ALL_OFFERS, uid, insights);
  return { items: p.proof, results: p.results };
}
