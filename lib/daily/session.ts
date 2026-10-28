import { saveSprint } from "@/lib/firebase/dailySprints";
import {
  isStale, parseAnySession, resultsFrom, sessionHasWork, tasksCompleted, workPercent,
  type SprintSession,
} from "./sprint";

// The running sprint lives in this browser until it is finished. Shared by
// the Daily Reps page and the Home card.

export const storeKey = (uid: string) => `campeos:daily:${uid}`;

export function readStore(uid: string): string | null {
  try {
    return localStorage.getItem(storeKey(uid));
  } catch {
    return null;
  }
}

export function writeStore(uid: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(storeKey(uid));
    else localStorage.setItem(storeKey(uid), value);
  } catch {
    /* private window: the sprint still runs, it just won't survive a refresh */
  }
}

/**
 * Today's unfinished sprint, if there is one. A sprint from an earlier day is
 * not shown: the reps reset every day. But work done in it still counts, so
 * it is saved to the running total first (with no replies or sales logged)
 * and then cleared.
 */
export async function todaysSession(uid: string, today: string, now: number): Promise<SprintSession | null> {
  const raw = readStore(uid);
  const s = parseAnySession(raw);
  if (!s) {
    if (raw) writeStore(uid, null);
    return null;
  }
  if (!isStale(s, today, now)) return s;
  writeStore(uid, null);
  if (sessionHasWork(s)) {
    try {
      await saveSprint(uid, {
        date: s.date,
        minutes: s.plan.minutes,
        focus: s.plan.focus,
        intensity: s.plan.intensity,
        tasksCompleted: tasksCompleted(s),
        workPercent: workPercent(s),
        results: resultsFrom(s, { replies: 0, sales: 0 }),
      });
    } catch {
      writeStore(uid, raw); // try again next time rather than lose it
    }
  }
  return null;
}
