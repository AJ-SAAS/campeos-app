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

// A video is not scripted word for word. Campeos gives a few title angles
// to pick from and a short plan of what the video covers, so the person
// can film it in their own words.
export const videoFields = [
  { key: "titles", label: "Title ideas", kind: "long" as const },
  { key: "summary", label: "What the video is about", kind: "long" as const },
  { key: "bullets", label: "What to cover", kind: "long" as const },
];
