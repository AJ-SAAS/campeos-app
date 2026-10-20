// Images on campaign messages: where they go, and what size each one
// should be. Pure helpers (no Firebase) so the editor, the uploader and
// the prompts all agree.
//
// Where images go:
// - Email: the AI marks spots in the body as a line of its own,
//   [IMAGE: what to show]. Each marker is one image slot, in order. People
//   can add, move or delete markers like any other text.
// - Social posts and ads: one image per message (slot "main").
// - Texts: none.

export interface StepImage {
  url: string;
  /** Storage path, so a replaced or removed image can be deleted. */
  path: string;
  width: number;
  height: number;
  /** The shape it was cropped to (ShapeId). */
  shape: string;
  name: string;
  uploadedAt: string;
}

export type ShapeId = "feed" | "vertical" | "square" | "email" | "banner";

export interface Shape {
  id: ShapeId;
  label: string;
  /** Output size. height null = keep the image's own shape at this width. */
  width: number;
  height: number | null;
  /** Where this shape fits, in plain words. */
  note: string;
}

export const SHAPES: Record<ShapeId, Shape> = {
  feed: { id: "feed", label: "Feed post", width: 1080, height: 1350, note: "Instagram, Facebook, LinkedIn and Threads feeds" },
  vertical: { id: "vertical", label: "Full screen", width: 1080, height: 1920, note: "TikTok, Reels, Stories and Shorts" },
  square: { id: "square", label: "Square", width: 1080, height: 1080, note: "Works everywhere, but takes up less of the screen" },
  email: { id: "email", label: "Keep its shape", width: 1200, height: null, note: "Emails show images 600 wide, so 1200 keeps it sharp on phones" },
  banner: { id: "banner", label: "Wide banner", width: 1200, height: 600, note: "A banner across the top of an email" },
};

const FEED_PLATFORMS = ["instagram", "facebook", "linkedin", "threads"];
const VERTICAL_PLATFORMS = ["tiktok", "youtube"];

/** The shapes to offer for a message, best one first. */
export function shapesFor(channel: string, platforms: string[]): Shape[] {
  if (channel === "email") return [SHAPES.email, SHAPES.banner];
  if (channel === "ad") return [SHAPES.feed, SHAPES.vertical, SHAPES.square];
  if (channel === "social") {
    const feed = platforms.some((p) => FEED_PLATFORMS.includes(p));
    const vertical = platforms.some((p) => VERTICAL_PLATFORMS.includes(p));
    if (vertical && !feed) return [SHAPES.vertical, SHAPES.feed, SHAPES.square];
    return [SHAPES.feed, SHAPES.vertical, SHAPES.square];
  }
  return [];
}

export function sizeText(shape: Shape): string {
  return shape.height ? `${shape.width} × ${shape.height}` : `${shape.width} wide`;
}

/** A line of its own like [IMAGE: you on stage with the workbook]. */
export const IMAGE_MARKER = /\[IMAGE:\s*([^\]\n]*)\]/gi;

export interface ImageSlot {
  id: string;
  /** What the picture should show (from the marker or the image idea). */
  label: string;
}

/** The image slots a message has, given its channel and current copy. */
export function imageSlots(channel: string, copy: Record<string, string> | null | undefined): ImageSlot[] {
  if (channel === "email") {
    const body = copy?.body ?? "";
    const slots: ImageSlot[] = [];
    let i = 0;
    for (const m of Array.from(body.matchAll(IMAGE_MARKER))) {
      i += 1;
      slots.push({ id: `img-${i}`, label: m[1].trim() || `Image ${i}` });
    }
    return slots;
  }
  if (channel === "social" || channel === "ad") {
    return [{ id: "main", label: (copy?.visual ?? "").trim() }];
  }
  return [];
}

/** Plain-words heads-up about an uploaded picture, or null if it's fine. */
export function sizeWarning(width: number, shape: Shape): string | null {
  if (width < shape.width * 0.7) {
    return `This picture is ${width} pixels wide, so it may look blurry. ${shape.width} wide or more looks best.`;
  }
  return null;
}

/** Biggest file we take in, before it's resized. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
/** Biggest file we store (also enforced in storage.rules). */
export const MAX_STORED_BYTES = 5 * 1024 * 1024;
