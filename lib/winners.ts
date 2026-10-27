// Pure helpers for "Best performers": copy the user marked as a winner
// (or pasted in by hand). No Firestore in here, so it's easy to test.
//
// Winners live in the `winners` collection (see lib/firebase/library.ts).
// A winner is just the text plus, when it was marked from a campaign,
// a little context: what kind of message it was and what kind of
// campaign it came from. The AI reads these as reference, so it can tell
// a subject line from an ad's primary text.

export interface WinnerMeta {
  /** "email", "sms", "ad", "social"... (Channel in lib/templates/types.ts). */
  channel?: string;
  /** The field it came from, e.g. "Headline / subject" or "Primary text". */
  fieldLabel?: string;
  /** The campaign type, e.g. "Webinar" or "Flash sale". */
  campaignType?: string;
}

export interface WinnerEntry extends WinnerMeta {
  id: string;
  text: string;
  /** "marked" = clicked "Mark as winner" in a step. "pasted" = added by hand. */
  origin: "marked" | "pasted";
  addedAt: Date | null;
}

/** Fields that hold real copy worth saving. Everything else (image ideas,
 * keywords, title ideas, the "source" note) is left out on purpose. */
const WINNABLE_FIELD_KEYS = new Set(["headline", "primaryText", "body", "caption"]);

export function isWinnableField(key: string): boolean {
  return WINNABLE_FIELD_KEYS.has(key);
}

/** Lowercase + collapse whitespace, so the same line isn't saved twice
 * just because of a stray space or a line break. */
export function normalizeWinnerText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Finds the saved entry that matches this text, if there is one. */
export function findWinner<T extends { text: string }>(entries: T[], text: string): T | undefined {
  const key = normalizeWinnerText(text);
  if (!key) return undefined;
  return entries.find((e) => normalizeWinnerText(e.text) === key);
}

const CHANNEL_NAME: Record<string, string> = {
  ad: "ad",
  email: "email",
  sms: "text message",
  social: "social post",
  video: "video",
  store: "App Store",
};

/** "email, Headline / subject, Webinar campaign" or "" for pasted lines. */
export function winnerTag(entry: WinnerMeta): string {
  const parts: string[] = [];
  if (entry.channel) parts.push(CHANNEL_NAME[entry.channel] ?? entry.channel);
  if (entry.fieldLabel) parts.push(entry.fieldLabel);
  if (entry.campaignType) parts.push(`${entry.campaignType} campaign`);
  return parts.join(", ");
}

/** Short label for the Best performers page, e.g. "Email · Headline / subject". */
export function winnerChipLabel(entry: WinnerMeta): string {
  const channel = entry.channel ? CHANNEL_NAME[entry.channel] ?? entry.channel : "";
  const label = [channel && channel[0].toUpperCase() + channel.slice(1), entry.fieldLabel]
    .filter(Boolean)
    .join(" · ");
  return label;
}

/**
 * One line of reference copy for the AI prompt. Pasted lines go through
 * unchanged (some start with "Testimonial:" or "Result:", which the prompt
 * treats specially). Marked winners get a tag at the end, in brackets, so
 * the model knows what kind of copy it was.
 */
export function winnerPromptLine(entry: Pick<WinnerEntry, "text" | "origin"> & WinnerMeta): string {
  const text = entry.text.trim();
  if (entry.origin === "pasted") return text;
  const tag = winnerTag(entry);
  return tag ? `${text} [${tag}]` : text;
}

/** How many winners go into one prompt. Newest first. Keeps the prompt
 * from growing forever as a user saves more. */
export const MAX_WINNERS_IN_PROMPT = 25;

/** Newest first, capped, as prompt lines. */
export function winnersForPrompt(entries: WinnerEntry[], max = MAX_WINNERS_IN_PROMPT): string[] {
  return [...entries]
    .filter((e) => e.text.trim())
    .sort((a, b) => (b.addedAt?.getTime() ?? 0) - (a.addedAt?.getTime() ?? 0))
    .slice(0, max)
    .map(winnerPromptLine);
}
