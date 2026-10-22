// Pure logic for buyer insights: no Firebase, no AI, fully testable
// (tests/insights.test.ts).
//
// - buildProfile: rebuilds an offer's profile from all its insights. Done
//   from scratch each time (not merged in place), so deleting an insight
//   cleanly removes everything it added, and the profile never drifts.
// - strength: how much the copy engine has to work with, per area, with
//   the plain-words consequence of each gap.
// - scanPlaceholders / fillPlaceholders: find the [TESTIMONIAL]-style blanks
//   in written copy and fill them from real proof, showing before/after.

import {
  Credit,
  Insight,
  Objection,
  OfferProfile,
  ProofItem,
  StoryArc,
} from "./types";

/* ------------------------------------------------------------------ */
/* Dedupe                                                              */
/* ------------------------------------------------------------------ */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[“”".,!?;:()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Little words that don't change what a line means.
const FILLER = new Set(["and", "the", "for", "with", "but", "you", "your", "are", "was", "that", "this", "just", "really", "very", "its"]);

function words(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((w) => w.length > 2 && !FILLER.has(w)));
}

/** True when two lines say the same thing (same words, or one inside the other). */
export function similar(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 12 && nb.length > 12 && (na.includes(nb) || nb.includes(na))) return true;
  const wa = words(a);
  const wb = words(b);
  if (wa.size < 3 || wb.size < 3) return false;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared += 1;
  });
  // High bar on purpose: "no time for ads" and "no time for content" are
  // different objections, and losing one is worse than keeping a near-twin.
  return shared / Math.max(wa.size, wb.size) >= 0.85;
}

/** Adds items in order, skipping blanks and near-duplicates, up to a cap. */
export function addUnique(list: string[], items: string[], cap: number): string[] {
  const out = [...list];
  for (const raw of items) {
    const item = (raw ?? "").trim();
    if (!item || out.length >= cap) continue;
    if (out.some((x) => similar(x, item))) continue;
    out.push(item);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const CAPS = {
  proof: 20,
  results: 15,
  objections: 12,
  pains: 15,
  desires: 15,
  words: 25,
  tried: 10,
  whyBought: 10,
  stories: 8,
};

/** Rebuilds an offer's profile from all of its insights, newest first. */
export function buildProfile(offerId: string, uid: string, insights: Insight[]): OfferProfile {
  const sorted = [...insights]
    .filter((i) => i.offerId === offerId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0));

  let proof: ProofItem[] = [];
  let results: string[] = [];
  let objections: Objection[] = [];
  let pains: string[] = [];
  let desires: string[] = [];
  let wordsList: string[] = [];
  let tried: string[] = [];
  let whyBought: string[] = [];
  const stories: (StoryArc & { insightId: string })[] = [];
  let myStory: StoryArc | null = null;

  for (const ins of sorted) {
    const l = ins.learned;
    if (l.testimonial?.quote && proof.length < CAPS.proof && !proof.some((p) => similar(p.quote, l.testimonial!.quote))) {
      proof.push({
        insightId: ins.id,
        quote: l.testimonial.quote.trim(),
        result: (l.testimonial.result ?? "").trim(),
        name: (l.testimonial.name ?? "").trim(),
        role: (l.testimonial.role ?? "").trim(),
        credit: ins.credit ?? (l.testimonial.name ? "first" : "none"),
      });
    }
    results = addUnique(results, [...l.results, l.testimonial?.result ?? ""], CAPS.results);
    for (const o of l.objections) {
      if (!o.objection?.trim() || objections.length >= CAPS.objections) continue;
      const i = objections.findIndex((x) => similar(x.objection, o.objection));
      if (i === -1) objections.push({ objection: o.objection.trim(), answer: (o.answer ?? "").trim() });
      else if (!objections[i].answer && o.answer) objections[i] = { ...objections[i], answer: o.answer.trim() };
    }
    pains = addUnique(pains, l.pains, CAPS.pains);
    desires = addUnique(desires, l.desires, CAPS.desires);
    wordsList = addUnique(wordsList, [...l.words, ...l.quotes.filter((q) => q.length <= 60)], CAPS.words);
    tried = addUnique(tried, l.tried, CAPS.tried);
    whyBought = addUnique(whyBought, l.whyBought, CAPS.whyBought);
    if (l.story && (l.story.before || l.story.after)) {
      if (ins.kind === "mystory") {
        if (!myStory) myStory = { ...l.story };
      } else if (stories.length < CAPS.stories) {
        stories.push({ ...l.story, insightId: ins.id });
      }
    }
  }

  // Keep the type checker honest about reassigned lists.
  proof = proof.slice(0, CAPS.proof);

  return {
    offerId,
    uid,
    proof,
    results,
    objections,
    pains,
    desires,
    words: wordsList,
    tried,
    whyBought,
    stories,
    myStory,
    counts: {
      insights: sorted.length,
      calls: sorted.filter((i) => i.kind === "call").length,
      testimonials: proof.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Credit                                                              */
/* ------------------------------------------------------------------ */

/** How a person is named in copy, e.g. "Sarah", "S.K.", or "" for no name. */
export function creditName(name: string, credit: Credit): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || credit === "none") return "";
  if (credit === "full") return parts.join(" ");
  if (credit === "first") return parts[0];
  return parts.map((p) => `${p[0].toUpperCase()}.`).join("");
}

/** A testimonial as it appears in copy: "quote" (Sarah, business coach). */
export function proofLine(p: ProofItem): string {
  const who = creditName(p.name, p.credit);
  const tag = who ? (p.role && p.credit === "full" ? `${who}, ${p.role}` : who) : "";
  const quote = p.quote.replace(/^["“]|["”]$/g, "");
  return tag ? `"${quote}" (${tag})` : `"${quote}"`;
}

/* ------------------------------------------------------------------ */
/* Placeholders                                                        */
/* ------------------------------------------------------------------ */

export type PlaceholderKind = "testimonial" | "customerName" | "result" | "number" | "story" | "guarantee";

const PLACEHOLDERS: Record<PlaceholderKind, RegExp> = {
  testimonial: /\[(?:TESTIMONIAL(?: ?\d+)?|CUSTOMER QUOTE|CLIENT QUOTE|QUOTE(?: FROM [A-Z ]+)?)\]/g,
  customerName: /\[(?:CUSTOMER NAME|CLIENT NAME|STUDENT NAME)\]/g,
  result: /\[(?:RESULT|CUSTOMER RESULT|CLIENT RESULT|SPECIFIC RESULT)\]/g,
  number: /\[(?:NUMBER(?: OF [A-Z ]+)?|NUMBER OF STUDENTS|NUMBER OF CLIENTS)\]/g,
  story: /\[(?:YOUR STORY|YOUR WIN|YOUR STRUGGLE|STORY)\]/g,
  guarantee: /\[(?:GUARANTEE|YOUR GUARANTEE)\]/g,
};

export type PlaceholderCounts = Record<PlaceholderKind, number>;

export function emptyCounts(): PlaceholderCounts {
  return { testimonial: 0, customerName: 0, result: 0, number: 0, story: 0, guarantee: 0 };
}

/** Counts each kind of fillable blank in one message's copy. */
export function scanPlaceholders(copy: Record<string, string> | null | undefined): PlaceholderCounts {
  const counts = emptyCounts();
  if (!copy) return counts;
  const text = Object.entries(copy)
    .filter(([k]) => k !== "source")
    .map(([, v]) => v)
    .join("\n");
  (Object.keys(PLACEHOLDERS) as PlaceholderKind[]).forEach((k) => {
    counts[k] = (text.match(PLACEHOLDERS[k]) ?? []).length;
  });
  return counts;
}

export interface FillChange {
  field: string;
  /** The line as it was. */
  before: string;
  /** The line after filling. */
  after: string;
}

/** The line of `text` that contains character position `at`. */
function lineAt(text: string, at: number): string {
  const start = text.lastIndexOf("\n", at - 1) + 1;
  const end = text.indexOf("\n", at);
  return text.slice(start, end === -1 ? text.length : end).trim();
}

/**
 * Fills the blanks that real proof can fill without any AI: testimonials,
 * customer names, results and numbers. Story and guarantee blanks need a
 * rewrite (they change sentences around them), so they're left for the
 * AI and reported in `needsRewrite`.
 *
 * Testimonials are used in order, one per blank, so [TESTIMONIAL 1] and
 * [TESTIMONIAL 2] get two different people. A customer name or result in
 * the same message comes from the first testimonial used there, so the
 * name and the result always match the quote.
 */
export function fillPlaceholders(
  copy: Record<string, string>,
  proof: ProofItem[],
  extra: { results?: string[]; number?: string } = {}
): { copy: Record<string, string>; changes: FillChange[]; needsRewrite: PlaceholderKind[] } {
  const out: Record<string, string> = { ...copy };
  const changes: FillChange[] = [];
  let next = 0;
  let anchor: ProofItem | undefined;

  for (const [field, value] of Object.entries(copy)) {
    if (field === "source" || typeof value !== "string") continue;
    let text = value;

    const replaceAll = (re: RegExp, pick: () => string | null) => {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      // Walk matches one at a time so each gets its own replacement.
      while ((m = re.exec(text))) {
        const value = pick();
        if (!value) break;
        const before = lineAt(text, m.index);
        text = text.slice(0, m.index) + value + text.slice(m.index + m[0].length);
        changes.push({ field, before, after: lineAt(text, m.index) });
        re.lastIndex = m.index + value.length;
      }
    };

    replaceAll(new RegExp(PLACEHOLDERS.testimonial.source, "g"), () => {
      const p = proof[next];
      if (!p) return null;
      next += 1;
      anchor = anchor ?? p;
      return proofLine(p);
    });
    replaceAll(new RegExp(PLACEHOLDERS.customerName.source, "g"), () => {
      const p = anchor ?? proof.find((x) => creditName(x.name, x.credit));
      if (!p) return null;
      anchor = p;
      return creditName(p.name, p.credit) || "one of my clients";
    });
    replaceAll(new RegExp(PLACEHOLDERS.result.source, "g"), () => {
      const r = anchor?.result || extra.results?.[0];
      return r || null;
    });
    replaceAll(new RegExp(PLACEHOLDERS.number.source, "g"), () => extra.number || null);

    out[field] = text;
  }

  const left = scanPlaceholders(out);
  const needsRewrite = (Object.keys(left) as PlaceholderKind[]).filter(
    (k) => left[k] > 0 && (k === "story" || k === "guarantee")
  );
  return { copy: out, changes, needsRewrite };
}

/* ------------------------------------------------------------------ */
/* Strength                                                            */
/* ------------------------------------------------------------------ */

export type AreaId = "proof" | "objections" | "pains" | "story" | "words";

export interface StrengthArea {
  id: AreaId;
  name: string;
  /** 0 to 1 */
  level: number;
  count: string;
  /** The plain-words consequence of the gap, or "" when it's fine. */
  tip: string;
  /** What to add to close the gap (an InsightKind), or "" */
  add: string;
}

const WEIGHT: Record<AreaId, number> = { proof: 0.3, objections: 0.2, pains: 0.2, story: 0.15, words: 0.15 };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * How much the copy engine has to work with. `blanks` are the placeholder
 * counts across this offer's written campaigns, so a gap can be said as a
 * consequence ("4 messages say [TESTIMONIAL]") instead of a score.
 */
export function strength(
  p: OfferProfile | null,
  blanks: { testimonial: number; story: number; number: number } = { testimonial: 0, story: 0, number: 0 }
): { score: number; areas: StrengthArea[]; headline: string } {
  const proofN = p?.proof.length ?? 0;
  const resultsN = p?.results.length ?? 0;
  const objN = p?.objections.length ?? 0;
  const painN = (p?.pains.length ?? 0) + (p?.desires.length ?? 0);
  const wordsN = p?.words.length ?? 0;
  const hasStory = !!p?.myStory;

  const areas: StrengthArea[] = [
    {
      id: "proof",
      name: "Proof",
      level: Math.min(1, (proofN + resultsN * 0.5) / 5),
      count: proofN || resultsN ? `${plural(proofN, "testimonial")}, ${plural(resultsN, "result")}` : "None yet",
      tip:
        blanks.testimonial > 0
          ? `${plural(blanks.testimonial, "post")} still ${blanks.testimonial === 1 ? "says" : "say"} [TESTIMONIAL]`
          : proofN < 3
            ? "Real results make your emails and ads believable"
            : "",
      add: blanks.testimonial > 0 || proofN < 3 ? "testimonial" : "",
    },
    {
      id: "objections",
      name: "Objections",
      level: Math.min(1, objN / 6),
      count: objN ? `${objN} found` : "None yet",
      tip: objN < 6 ? `Your FAQ and "But what if" emails answer ${objN ? `only ${objN}` : "none"}. A sales call finds more.` : "",
      add: objN < 6 ? "call" : "",
    },
    {
      id: "pains",
      name: "Pains and wants",
      level: Math.min(1, painN / 10),
      count: painN ? `${painN} found` : "None yet",
      tip: painN < 10 ? "Openers get more specific with a call or a few DMs" : "",
      add: painN < 10 ? "call" : "",
    },
    {
      id: "story",
      name: "Your story",
      level: hasStory ? 1 : 0,
      count: hasStory ? "Added" : "Missing",
      tip: hasStory
        ? ""
        : blanks.story > 0
          ? `${plural(blanks.story, "email")} ${blanks.story === 1 ? "says" : "say"} [YOUR STORY]. Add 3 lines or a voice note.`
          : 'Add 3 lines or a voice note. Powers your "A confession" emails.',
      add: hasStory ? "" : "mystory",
    },
    {
      id: "words",
      name: "Their words",
      level: Math.min(1, wordsN / 12),
      count: wordsN ? plural(wordsN, "phrase") : "None yet",
      tip: wordsN < 12 ? "Hooks sound more like them with a few DMs or replies" : "",
      add: wordsN < 12 ? "message" : "",
    },
  ];

  const score = Math.round(areas.reduce((s, a) => s + a.level * WEIGHT[a.id], 0) * 100);
  // The gap that costs the most: weight times how much is missing.
  const worst = [...areas]
    .filter((a) => a.tip)
    .sort((a, b) => (1 - b.level) * WEIGHT[b.id] - (1 - a.level) * WEIGHT[a.id])[0];
  const blankArea = areas.find((a) => (a.id === "proof" && blanks.testimonial > 0) || (a.id === "story" && blanks.story > 0));
  const focus = blankArea ?? worst;
  const headline = !focus ? "Strong. Campeos has plenty to write from." : focus.tip;
  return { score, areas, headline };
}

/* ------------------------------------------------------------------ */
/* For the copy engine                                                 */
/* ------------------------------------------------------------------ */

/** The profile as research lines for the buyer brief prompt. */
export function profileForBrief(p: OfferProfile): { proof: string[]; research: string[] } {
  const proof = [
    ...p.proof.map((x) => `Testimonial: ${proofLine(x)}${x.result ? ` (result: ${x.result})` : ""}`),
    ...p.results.map((r) => `Result: ${r}`),
  ];
  const research = [
    ...p.objections.map((o) => `Objection buyers raised: "${o.objection}"${o.answer ? ` -> the seller's answer: ${o.answer}` : ""}`),
    ...p.pains.map((x) => `Pain buyers described: ${x}`),
    ...p.desires.map((x) => `What buyers want: ${x}`),
    ...p.words.map((x) => `Buyer's own words: "${x}"`),
    ...p.tried.map((x) => `Tried before and it failed: ${x}`),
    ...p.whyBought.map((x) => `Why they bought: ${x}`),
    ...p.stories.map((s) => `Customer story: before: ${s.before} | turn: ${s.turn} | after: ${s.after}`),
    ...(p.myStory ? [`The seller's own story (real, use it): before: ${p.myStory.before} | turn: ${p.myStory.turn} | after: ${p.myStory.after}`] : []),
  ];
  return { proof, research };
}
