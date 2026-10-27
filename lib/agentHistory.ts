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
