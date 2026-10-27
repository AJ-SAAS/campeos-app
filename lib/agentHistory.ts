// Limits for the agent chat. Saving messages is cheap; what costs money is
// how much history goes to the AI with every new message. So we send only
// the last few turns, and keep the saved thread short.

/** How many past messages go to the AI with each new message. */
export const MODEL_HISTORY_LIMIT = 10;

/** How many messages stay saved per user. Older ones are deleted. */
export const SAVED_HISTORY_LIMIT = 50;

/** The most recent messages, for the AI. */
export function recentForModel<T>(messages: T[], limit = MODEL_HISTORY_LIMIT): T[] {
  return limit <= 0 ? [] : messages.slice(-limit);
}

/** Splits oldest-first messages into the ones to keep and the old ones to delete. */
export function splitForPrune<T>(messages: T[], keep = SAVED_HISTORY_LIMIT): { keep: T[]; drop: T[] } {
  if (messages.length <= keep) return { keep: messages, drop: [] };
  const cut = messages.length - keep;
  return { keep: messages.slice(cut), drop: messages.slice(0, cut) };
}

/** A pause this long (or a new day) starts a new "session" in the chat,
 * shown with a divider line so old and new talk don't blur together. */
export const SESSION_GAP_MS = 6 * 60 * 60 * 1000;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** True when `at` starts a new session after `prevAt`. */
export function startsNewSession(prevAt: number | undefined, at: number | undefined): boolean {
  if (prevAt == null || at == null) return false;
  return at - prevAt >= SESSION_GAP_MS || !sameDay(new Date(prevAt), new Date(at));
}

/** "Today", "Yesterday" or "Mon 26 Oct". */
export function sessionLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const n = new Date(now);
  if (sameDay(d, n)) return "Today";
  const y = new Date(n);
  y.setDate(n.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
