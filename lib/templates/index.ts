import { CampaignTemplate } from "./types";
import { formatForPrompt } from "../ai/prompts";
import { webinarTemplate } from "./webinar";
import { flashSale48hTemplate } from "./flash-sale-48h";
import { cartCloseTemplate } from "./cart-close";
import { cashInjectionTemplate } from "./cash-injection";

// Adding a new campaign type ("pocket") means adding a file next to
// webinar.ts and registering it here. Nothing else should need to change.
export const templates: Record<string, CampaignTemplate> = {
  webinar: webinarTemplate,
  "flash-sale-48h": flashSale48hTemplate,
  "cart-close": cartCloseTemplate,
  "cash-injection": cashInjectionTemplate,
};

/** The "key date" text the writer sees: when it goes live and, for
 * sales, when it ends. Same format as every other date in the prompts. */
export function keyDatesFor(template: CampaignTemplate, live: Date): string {
  const opens = formatForPrompt(live);
  if (template.closeOffsetHours === undefined) return opens;
  const ends = formatForPrompt(new Date(live.getTime() + template.closeOffsetHours * 3600_000));
  return `${opens}. The offer ends: ${ends}`;
}

export function getTemplate(id: string): CampaignTemplate {
  const template = templates[id];
  if (!template) {
    throw new Error(`Unknown campaign template: "${id}"`);
  }
  return template;
}

export * from "./types";
