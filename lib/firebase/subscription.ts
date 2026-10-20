import { doc, getDoc } from "firebase/firestore";
import { db } from "./client";

/**
 * One doc per user, keyed by uid — written ONLY by the Stripe webhook
 * (via the Admin SDK, see lib/firebase/admin.ts and
 * app/api/stripe/webhook/route.ts), never by the client. See
 * firestore.rules: this collection is read-only from the client SDK.
 */
export interface Subscription {
  uid: string;
  plan: "starter" | "pro" | null;
  interval: "monthly" | "yearly" | null;
  status: "active" | "past_due" | "canceled" | "incomplete" | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string; // ISO string
}

const EMPTY: Omit<Subscription, "uid"> = {
  plan: null,
  interval: null,
  status: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  updatedAt: new Date(0).toISOString(),
};

/** Reads the signed-in user's subscription. No doc yet (never subscribed) reads as "no plan." */
export async function getSubscription(uid: string): Promise<Subscription> {
  const snap = await getDoc(doc(db, "subscriptions", uid));
  if (!snap.exists()) return { uid, ...EMPTY };
  return { uid, ...EMPTY, ...(snap.data() as Partial<Subscription>) };
}

export function isActive(sub: Subscription): boolean {
  return sub.status === "active";
}
