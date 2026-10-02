import { CampaignTemplate } from "./types";
import { webinarTemplate } from "./webinar";

// Adding a new campaign type ("pocket") means adding a file next to
// webinar.ts and registering it here. Nothing else should need to change.
export const templates: Record<string, CampaignTemplate> = {
  webinar: webinarTemplate,
};

export function getTemplate(id: string): CampaignTemplate {
  const template = templates[id];
  if (!template) {
    throw new Error(`Unknown campaign template: "${id}"`);
  }
  return template;
}

export * from "./types";
