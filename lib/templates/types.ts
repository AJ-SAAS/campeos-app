// A StepTemplate is pure data: no dates, no copy. It says WHAT kind of
// message goes out, on WHICH channel, WHEN relative to the campaign's
// anchor event (a webinar, a sale end, a launch), and WHY it exists (the
// sales angle it's playing). Adding a new campaign type means writing a
// new array of these — never touching the engine or the UI.

export type Channel = "email" | "sms" | "social" | "ad";

// Anchors are the fixed dates a campaign is built around. "event" is the
// webinar/launch/sale-start date the user picks; "end" is when the offer
// closes (defaults to a fixed offset from "event" if the template doesn't
// use a separate close date).
export type Anchor = "event" | "end";

export interface StepTemplate {
  /** Stable id, unique within a template. Used to key generated copy. */
  id: string;
  channel: Channel;
  /** Which fixed date this step's timing is measured from. */
  anchor: Anchor;
  /**
   * Hours relative to the anchor. Negative = before, positive = after.
   * e.g. -72 on anchor "event" means 3 days before the webinar.
   */
  offsetHours: number;
  /** Short label shown on the timeline card, e.g. "Doors open reminder". */
  title: string;
  /**
   * Which CampaignPhase this step belongs to — must match a
   * CampaignPhase.id in the same template's `phases` array. This is what
   * groups the flat step list into a narrative ("Registration" ->
   * "Consumption" -> "Consideration & connection" -> "Conversion" ->
   * "Marketing intel") instead of an unconnected checklist.
   */
  phaseId: string;
  /**
   * Why THIS step exists, in a sentence or two, written the way the
   * strategist who designed the campaign would explain their own call —
   * not a generic label. Shown as "Why this step" in the StepEditor and
   * behind the info icon on the Timeline card.
   */
  purpose: string;
  /**
   * The specific, named copywriting technique this step executes — e.g.
   * "Takeaway selling", "Kill the sacred cow", "FOMO via social proof
   * stack" — never a generic mood word like "urgency" or "curiosity" on
   * its own. This is fed directly into the AI prompt (see
   * lib/ai/prompts.ts) so the generated copy actually executes the named
   * technique, not just copy that happens to differ from the step before
   * it.
   */
  angle: string;
  /**
   * 2-4 concrete things this step is meant to accomplish, in plain
   * language — shown as bullets behind the info icon, and folded into the
   * AI prompt alongside `purpose` and `angle` so the model knows exactly
   * what the step needs to do, not just its general mood.
   */
  goals: string[];
  /**
   * Which specific levers from the master persuasion checklist this step
   * should pull on — e.g. "Proof: social proof stack", "Objections:
   * price". Drawn from the 12-category framework used across the great
   * direct-response copywriters (Schwartz, Hopkins, Ogilvy, Halbert,
   * Caples, Sugarman): audience, pain, desire, stakes, solution, proof,
   * objections, story, offer, risk, urgency, optimization. The point
   * isn't to cram every element into every step — it's picking the 2-3
   * that remove the biggest barrier for THIS step, so the step has a
   * deliberate psychological job instead of a vague "sell it" mandate.
   */
  persuasionElements: string[];
  /**
   * The editable fields this step's copy is made of. Kept generic so the
   * same shape works for an email (subject + body) or an ad (headline +
   * primary text) — lib/ai fills these in per channel.
   */
  fields: StepFieldSpec[];
}

export interface StepFieldSpec {
  key: string;
  label: string;
  /** "short" for headlines/subject lines, "long" for bodies. */
  kind: "short" | "long";
}

/**
 * A named stage of the campaign's narrative arc — e.g. "Consideration &
 * connection" — with its own stated objective. Steps are grouped into
 * phases (StepTemplate.phaseId) so the Timeline can show the campaign's
 * big-picture strategy, not just a flat list of dated steps. See the
 * "Campaign strategy overview" at the top of Timeline.tsx.
 */
export interface CampaignPhase {
  id: string;
  name: string;
  /** What this phase is trying to accomplish in the campaign as a whole. */
  objective: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  /** e.g. "webinar" — used to pick sample copy and default field labels. */
  kind: string;
  /** The named stages this template's steps are grouped into, in order. */
  phases: CampaignPhase[];
  steps: StepTemplate[];
}
