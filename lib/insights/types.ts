// Buyer insights: everything a user's buyers said or did, collected on the
// Buyer insights page and read by the AI (lib/ai/readInsight.ts). Each
// insight belongs to one offer. The offer profile (lib/insights/logic.ts,
// buildProfile) is rebuilt from all of an offer's insights, and the copy
// engine writes every campaign for that offer from it.

export type InsightKind =
  | "call"
  | "testimonial"
  | "story"
  | "message"
  | "survey"
  | "objection"
  | "mystory"
  | "result"
  | "other";

export const KIND_LABEL: Record<InsightKind, string> = {
  call: "Sales call",
  testimonial: "Testimonial",
  story: "Customer story",
  message: "Message or DM",
  survey: "Survey answers",
  objection: "Objection",
  mystory: "My story",
  result: "Result or number",
  other: "Note",
};

export type InsightSource = "paste" | "file" | "voice" | "link" | "form" | "scan" | "import";

/** How a testimonial's author is credited in copy. */
export type Credit = "full" | "first" | "initials" | "none";

export interface Objection {
  objection: string;
  answer: string;
}

export interface StoryArc {
  before: string;
  turn: string;
  after: string;
}

/** What the AI pulled out of one insight. Every list may be empty. */
export interface Learned {
  /** Short quotable lines, in the buyer's own words. */
  quotes: string[];
  pains: string[];
  desires: string[];
  objections: Objection[];
  /** Concrete results or numbers someone can stand behind. */
  results: string[];
  /** Phrases the buyer uses, for hooks. */
  words: string[];
  /** What they tried before that didn't work. */
  tried: string[];
  /** Why they bought (or what tipped them). */
  whyBought: string[];
  story: StoryArc | null;
  testimonial: { quote: string; name: string; role: string; result: string } | null;
}

export interface Insight {
  id: string;
  uid: string;
  offerId: string;
  kind: InsightKind;
  title: string;
  /** The original text (or transcript), kept so it can be re-read later. */
  text: string;
  source: InsightSource;
  learned: Learned;
  /** Testimonials only: how the person may be credited. */
  credit?: Credit;
  createdAt: string;
}

export interface ProofItem {
  insightId: string;
  quote: string;
  result: string;
  name: string;
  role: string;
  credit: Credit;
}

/** Everything known about an offer's buyers, rebuilt from its insights. */
export interface OfferProfile {
  offerId: string;
  uid: string;
  proof: ProofItem[];
  results: string[];
  objections: Objection[];
  pains: string[];
  desires: string[];
  words: string[];
  tried: string[];
  whyBought: string[];
  /** Customer stories (case studies). */
  stories: (StoryArc & { insightId: string })[];
  /** The founder's own story, if they told it. */
  myStory: StoryArc | null;
  counts: { insights: number; calls: number; testimonials: number };
  updatedAt: string;
}

export function emptyLearned(): Learned {
  return {
    quotes: [],
    pains: [],
    desires: [],
    objections: [],
    results: [],
    words: [],
    tried: [],
    whyBought: [],
    story: null,
    testimonial: null,
  };
}
