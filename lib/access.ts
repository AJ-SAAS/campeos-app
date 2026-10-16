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
 * Whether this account is allowed to spend AI generation credits: an admin
 * account (free), or a paying subscriber with an active plan. This is the
 * paywall itself — checked server-side in /api/generate-step, the one
 * place that actually costs money, rather than in the UI (which a
 * determined user could just bypass).
 */
export async function canGenerate(uid: string): Promise<boolean> {
  if (isAdminUid(uid)) return true;
  const db = getAdminDb();
  const snap = await db.collection("subscriptions").doc(uid).get();
  if (!snap.exists) return false;
  return snap.data()?.status === "active";
}
