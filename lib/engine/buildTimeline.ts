import { CampaignTemplate, StepTemplate } from "../templates/types";

export interface AnchorDates {
  /** The main event date/time — a webinar start, a launch, a sale start. */
  event: Date;
  /**
   * When the offer closes. Optional: if omitted, defaults to 72 hours
   * after the event, which matches the webinar template's cart-close
   * window. Templates that don't use the "end" anchor ignore this.
   */
  end?: Date;
}

export interface ScheduledStep {
  templateStepId: string;
  channel: StepTemplate["channel"];
  title: string;
  purpose: string;
  angle: string;
  fields: StepTemplate["fields"];
  /** The real calendar date/time this step should go out. */
  scheduledAt: Date;
}

const DEFAULT_END_OFFSET_HOURS = 72;

/**
 * Pure date math: turns a campaign template's relative offsets into real
 * scheduled dates, given the anchor dates the user picked. No AI calls,
 * no randomness, no I/O — this is the function to unit test.
 */
export function buildTimeline(
  template: CampaignTemplate,
  anchors: AnchorDates
): ScheduledStep[] {
  const end =
    anchors.end ??
    addHours(anchors.event, DEFAULT_END_OFFSET_HOURS);

  return template.steps
    .map((step) => {
      const base = step.anchor === "event" ? anchors.event : end;
      return {
        templateStepId: step.id,
        channel: step.channel,
        title: step.title,
        purpose: step.purpose,
        angle: step.angle,
        fields: step.fields,
        scheduledAt: addHours(base, step.offsetHours),
      };
    })
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/**
 * Groups scheduled steps by calendar day, for the day-by-day timeline
 * layout in the Campaign Builder (one column per day, one lane per
 * channel).
 */
export function groupByDay(
  steps: ScheduledStep[]
): { day: string; steps: ScheduledStep[] }[] {
  const groups = new Map<string, ScheduledStep[]>();

  for (const step of steps) {
    const key = dayKey(step.scheduledAt);
    const existing = groups.get(key);
    if (existing) {
      existing.push(step);
    } else {
      groups.set(key, [step]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, steps]) => ({ day, steps }));
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}
