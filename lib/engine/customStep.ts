import { ScheduledStep } from "./buildTimeline";
import { Channel, StepFieldSpec } from "../templates/types";
import { adFields, shortLong, smsFields, socialFields, videoFields } from "../templates/fields";

// A post the user adds themselves from the "+ Add a post" button in the
// builder, on top of whatever the campaign template already plans. It's
// just another step as far as the engine, the sequence view, and the AI
// are concerned — the only thing that marks it as user-added is its id
// (CUSTOM_PREFIX), which SequenceView and app/builder/page.tsx check for
// to show the editable title and the "Remove this post" action. It saves
// to this one campaign's own "steps" subcollection
// (lib/firebase/campaigns.ts) — never the template, so it can never show
// up in any other campaign.

export const CUSTOM_PREFIX = "custom-";

export function isCustomStepId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}

// Channels someone can hand-add a post for. "store" (the App Store
// listing) is a one-off tied to app-launch campaigns specifically and
// wouldn't make sense as a free-standing add here.
export const ADDABLE_CHANNELS: Channel[] = ["email", "sms", "social", "ad", "video"];

const CHANNEL_FIELDS: Partial<Record<Channel, StepFieldSpec[]>> = {
  email: shortLong,
  sms: smsFields,
  social: socialFields,
  ad: adFields,
  video: videoFields,
};

const CHANNEL_DEFAULT_TITLE: Partial<Record<Channel, string>> = {
  email: "New email",
  sms: "New text message",
  social: "New social post",
  ad: "New ad",
  video: "New video",
};

function newCustomId(): string {
  return `${CUSTOM_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A blank user-added post for the given channel, scheduled at the given
 * time. Everything about it (title, fields) can be edited right after —
 * this just needs to be a well-formed step the rest of the app can treat
 * like any other. */
export function makeCustomStep(channel: Channel, scheduledAt: Date): ScheduledStep {
  return {
    templateStepId: newCustomId(),
    channel,
    title: CHANNEL_DEFAULT_TITLE[channel] ?? "New post",
    purpose: "A one-off post you added to this campaign, outside its usual plan.",
    angle: "Say it plainly, in your own words.",
    goals: ["Say what this post needs to say"],
    persuasionElements: [],
    phaseName: "Your own posts",
    phaseObjective: "Posts you added yourself, outside the campaign's built-in plan.",
    fields: CHANNEL_FIELDS[channel] ?? shortLong,
    scheduledAt,
  };
}
