import { CampaignTemplate } from "./types";

const shortLong = [
  { key: "headline", label: "Headline / subject", kind: "short" as const },
  { key: "body", label: "Body", kind: "long" as const },
];

const adFields = [
  { key: "headline", label: "Headline", kind: "short" as const },
  { key: "primaryText", label: "Primary text", kind: "long" as const },
];

const smsFields = [{ key: "body", label: "Text", kind: "long" as const }];

// A 7-day, 3-lane (Facebook ads / Email / Texts) webinar promo campaign.
// Timing is relative to the "event" anchor (the webinar's start time) and
// the "end" anchor (when the offer closes, typically 48-72 hours after).
// This matches the layout built in the Campeos Builder mockup.
export const webinarTemplate: CampaignTemplate = {
  id: "webinar",
  name: "Webinar promo",
  description:
    "Fill seats for a live webinar, then sell the offer hard for 48–72 hours after it ends.",
  kind: "webinar",
  steps: [
    // --- Registration drive: 6 days out to day before ---
    {
      id: "ad-open",
      channel: "ad",
      anchor: "event",
      offsetHours: -144, // 6 days before
      title: "Registration ad",
      purpose: "Cold traffic sees the webinar for the first time and registers.",
      angle: "curiosity",
      fields: adFields,
    },
    {
      id: "email-invite",
      channel: "email",
      anchor: "event",
      offsetHours: -120, // 5 days before
      title: "You're invited",
      purpose: "Tell the list the webinar exists and get the first wave of registrations.",
      angle: "invitation",
      fields: shortLong,
    },
    {
      id: "ad-retarget-registrants",
      channel: "ad",
      anchor: "event",
      offsetHours: -96, // 4 days before
      title: "Retargeting ad",
      purpose: "Bring back people who saw the first ad but didn't register.",
      angle: "objection handling",
      fields: adFields,
    },
    {
      id: "email-whats-inside",
      channel: "email",
      anchor: "event",
      offsetHours: -72, // 3 days before
      title: "What you'll learn",
      purpose: "Give registrants a reason to actually show up, not just sign up.",
      angle: "value preview",
      fields: shortLong,
    },
    {
      id: "sms-save-seat",
      channel: "sms",
      anchor: "event",
      offsetHours: -48, // 2 days before
      title: "Save your seat text",
      purpose: "Short nudge to people who registered but haven't confirmed.",
      angle: "reminder",
      fields: smsFields,
    },
    {
      id: "email-story",
      channel: "email",
      anchor: "event",
      offsetHours: -30,
      title: "Why this matters now",
      purpose: "A story-driven email that builds urgency for the day before.",
      angle: "story",
      fields: shortLong,
    },

    // --- Day before / day of: reminders ---
    {
      id: "sms-tomorrow",
      channel: "sms",
      anchor: "event",
      offsetHours: -24,
      title: "Tomorrow reminder",
      purpose: "Remind registrants the webinar is tomorrow.",
      angle: "reminder",
      fields: smsFields,
    },
    {
      id: "email-today",
      channel: "email",
      anchor: "event",
      offsetHours: -3,
      title: "Starting soon",
      purpose: "Last email before doors open, with the join link front and center.",
      angle: "reminder",
      fields: shortLong,
    },
    {
      id: "sms-live-now",
      channel: "sms",
      anchor: "event",
      offsetHours: 0,
      title: "We're live",
      purpose: "Catch people who forgot the moment it starts.",
      angle: "urgency",
      fields: smsFields,
    },

    // --- Post-webinar: sell the offer ---
    {
      id: "email-replay",
      channel: "email",
      anchor: "event",
      offsetHours: 3,
      title: "Replay + offer opens",
      purpose: "Send the replay and open the cart for people who missed it live.",
      angle: "value recap",
      fields: shortLong,
    },
    {
      id: "ad-offer-open",
      channel: "ad",
      anchor: "event",
      offsetHours: 6,
      title: "Offer is open",
      purpose: "Tell warm traffic the offer from the webinar is live.",
      angle: "offer reveal",
      fields: adFields,
    },
    {
      id: "email-objections",
      channel: "email",
      anchor: "event",
      offsetHours: 24,
      title: "Handle the objections",
      purpose: "Answer the top reasons people hesitate to buy.",
      angle: "objection handling",
      fields: shortLong,
    },
    {
      id: "sms-cart-closing-soon",
      channel: "sms",
      anchor: "end",
      offsetHours: -24,
      title: "Cart closes tomorrow",
      purpose: "Create urgency as the close date approaches.",
      angle: "urgency",
      fields: smsFields,
    },
    {
      id: "email-last-call",
      channel: "email",
      anchor: "end",
      offsetHours: -4,
      title: "Last call",
      purpose: "Final push before the cart closes for good.",
      angle: "urgency",
      fields: shortLong,
    },
    {
      id: "sms-closes-tonight",
      channel: "sms",
      anchor: "end",
      offsetHours: -1,
      title: "Closes tonight",
      purpose: "Last-hour nudge to anyone still on the fence.",
      angle: "urgency",
      fields: smsFields,
    },
  ],
};
