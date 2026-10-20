import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

// Hardcoded rather than env-configured — there's exactly one admin account
// right now (Ajay's own), and this gets checked on every generation
// request. Add more uids here if more admin accounts are needed later.
const ADMIN_UIDS = new Set<string>([
  "9kTcEuk008giUNnkk0Gji58RUhy1", // gridking111@gmail.com
]);

export function isAdminUid(uid: string): boolean {
  return ADMIN_UIDS.has(uid);
}

/**
 * Whether this account can spend AI generation credits without limit: an
 * admin account, or a paying subscriber with an active plan. Checked
 * server-side in /api/generate-step, the one place that costs money. The
 * uid passed in must come from a verified ID token (lib/serverAuth.ts),
 * never from the request body.
 */
export async function canGenerate(uid: string): Promise<boolean> {
  if (isAdminUid(uid)) return true;
  const db = getAdminDb();
  const snap = await db.collection("subscriptions").doc(uid).get();
  if (!snap.exists) return false;
  return snap.data()?.status === "active";
}

/**
 * The free taste: an account with no plan gets the first FREE_STEP_LIMIT
 * steps of a campaign written once, so they see their own launch before
 * paying. Tracked in freeTrials/{uid}, which only the Admin SDK writes
 * (no client rule allows it, so it can't be reset from the browser).
 */
export const FREE_STEP_LIMIT = 3;

/** Reserves `count` free steps. Returns false if that would go over the limit. */
export async function claimFreeSteps(uid: string, count: number): Promise<boolean> {
  if (count < 1 || count > FREE_STEP_LIMIT) return false;
  const db = getAdminDb();
  const ref = db.collection("freeTrials").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.exists ? (snap.data()?.stepsUsed as number) : 0) || 0;
    if (used + count > FREE_STEP_LIMIT) return false;
    tx.set(ref, { stepsUsed: used + count, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  });
}

/** Gives back free steps that were reserved but failed to generate. */
export async function refundFreeSteps(uid: string, count: number): Promise<void> {
  if (count < 1) return;
  const db = getAdminDb();
  await db
    .collection("freeTrials")
    .doc(uid)
    .set({ stepsUsed: FieldValue.increment(-count) }, { merge: true });
}
