// The "Try asking" suggestions show once a day. After the user sends a
// message, they stay away until the next day. The day is kept in the
// browser (localStorage), so there's nothing to save on the server.

export const TIPS_KEY = "campeos.agent.tipsDay";

/** "2026-10-27", in the user's own time zone. */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Show them unless they were already used up today. */
export function shouldShowTips(usedDay: string | null | undefined, now: Date = new Date()): boolean {
  return usedDay !== dayKey(now);
}
