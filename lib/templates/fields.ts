// Field sets shared by the newer campaign templates. (webinar.ts keeps its
// own copies from before this file existed.)

export const shortLong = [
  { key: "headline", label: "Headline / subject", kind: "short" as const },
  { key: "body", label: "Body", kind: "long" as const },
];

export const adFields = [
  { key: "headline", label: "Headline", kind: "short" as const },
  { key: "primaryText", label: "Primary text", kind: "long" as const },
  { key: "visual", label: "Image or video idea", kind: "short" as const },
];

export const smsFields = [{ key: "body", label: "Text", kind: "long" as const }];

export const socialFields = [
  { key: "caption", label: "Caption", kind: "long" as const },
  { key: "visual", label: "Image or video idea", kind: "short" as const },
];

// The App Store listing. Apple's own limits are enforced in the prompt and in
// lib/ai/quality.ts: name 30, subtitle 30, promo text 170, keywords 100.
export const storeFields = [
  { key: "appName", label: "App name (30 max)", kind: "short" as const },
  { key: "subtitle", label: "Subtitle (30 max)", kind: "short" as const },
  { key: "promo", label: "Promotional text (170 max)", kind: "long" as const },
  { key: "keywords", label: "Keywords (100 max)", kind: "short" as const },
  { key: "description", label: "Description", kind: "long" as const },
];

// A video is not scripted word for word. Campeos gives a few title angles
// to pick from and a short plan of what the video covers, so the person
// can film it in their own words.
export const videoFields = [
  { key: "titles", label: "Title ideas", kind: "long" as const },
  { key: "summary", label: "What the video is about", kind: "long" as const },
  { key: "bullets", label: "What to cover", kind: "long" as const },
];
