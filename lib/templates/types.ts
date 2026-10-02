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
  /** One line explaining why this step exists — shown as "Why this step". */
  purpose: string;
  /**
   * The sales angle this step plays (urgency, social proof, objection
   * handling, etc). Used to steer AI copy and to match against buyer-call
   * themes and winning copy when picking what to build the copy from.
   */
  angle: string;
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

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  /** e.g. "webinar" — used to pick sample copy and default field labels. */
  kind: string;
  steps: StepTemplate[];
}
