import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./client";

// A soft daily cap on AI generation calls, per signed-in user. Nothing in
// Campeos limited this before — every "Generate campaign copy" click, or
// now every agent conversation that builds a campaign, called OpenAI with
// no guardrail. This stops a runaway agent loop or a buggy retry from
// burning through the account's OpenAI budget unnoticed.
//
// This is enforced from the client, matching how the rest of the app
// trusts the signed-in Firebase user (Firestore rules, not a server
// session, are what actually keep one user's data away from another's).
// It is not a defense against a malicious user rewriting their own
// client — just a guardrail against normal runaway usage. A server-side
// cap (checked inside the API routes, backed by the Admin SDK) is the
// next step up if this ever needs to be tamper-proof.

const DAILY_LIMIT = 200; // generated fields per user per day — roughly 13 full 15-step campaigns

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

/**
 * Reserves `cost` units against today's budget for this user. Returns
 * true and reserves the cost if there's room; returns false (reserving
 * nothing) if today's limit is already used up.
 */
export async function checkAndIncrementUsage(uid: string, cost: number): Promise<boolean> {
  const ref = doc(db, "usage", uid);
  const day = todayKey();

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : null;
    const current = data && data.day === day ? (data.count as number) : 0;

    if (current + cost > DAILY_LIMIT) {
      return false;
    }

    tx.set(ref, { uid, day, count: current + cost });
    return true;
  });
}

/** Reads today's usage without reserving anything — for showing a "x of y used today" hint. */
export async function getTodayUsage(uid: string): Promise<{ count: number; limit: number }> {
  const snap = await getDoc(doc(db, "usage", uid));
  const data = snap.exists() ? snap.data() : null;
  const count = data && data.day === todayKey() ? (data.count as number) : 0;
  return { count, limit: DAILY_LIMIT };
}
