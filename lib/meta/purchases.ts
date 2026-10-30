import type Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase/admin";
import { PLANS, isPlanKey } from "@/lib/stripe/client";
import { sendEventToMeta } from "./capi";
import { buildPurchaseEvent } from "./payload";

// One Firestore doc per Stripe Checkout Session: metaPurchases/{sessionId}.
// It is written when checkout starts (with the click cookies, IP and
// browser, which the Stripe webhook can't see) and updated when the
// payment lands. Its status is what makes a repeated webhook harmless.
//
//   awaiting          checkout started, not paid yet
//   sent              Purchase delivered to Meta
//   failed            Meta didn't take it (we try again on a webhook retry)
//   skipped_consent   they opted out, nothing sent
//   skipped_zero      nothing was charged (100% coupon), nothing sent

const COLLECTION = "metaPurchases";

export interface CheckoutAttribution {
  uid: string;
  fbp?: string;
  fbc?: string;
  ip?: string | null;
  userAgent?: string | null;
  sourceUrl?: string;
  consent: boolean;
}

export async function saveCheckoutAttribution(sessionId: string, a: CheckoutAttribution) {
  const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined && v !== null));
  await getAdminDb()
    .collection(COLLECTION)
    .doc(sessionId)
    .set({ ...clean, status: "awaiting", createdAt: new Date().toISOString() }, { merge: true });
}

/** Called from the Stripe webhook. Never throws. */
export async function reportPurchase(session: Stripe.Checkout.Session): Promise<void> {
  try {
    if (session.mode !== "subscription" || session.payment_status !== "paid") return;

    const ref = getAdminDb().collection(COLLECTION).doc(session.id);
    const snap = await ref.get();
    const saved = snap.exists ? (snap.data() ?? {}) : {};
    if (saved.status === "sent" || saved.status === "skipped_consent" || saved.status === "skipped_zero") return;

    const amount = session.amount_total ?? 0;
    if (amount <= 0) {
      await ref.set({ status: "skipped_zero", updatedAt: new Date().toISOString() }, { merge: true });
      return;
    }
    if (saved.consent === false) {
      await ref.set({ status: "skipped_consent", updatedAt: new Date().toISOString() }, { merge: true });
      return;
    }

    const planKey = session.metadata?.plan;
    const event = buildPurchaseEvent({
      eventId: session.id,
      amountTotal: amount,
      currency: session.currency ?? "usd",
      email: session.customer_details?.email ?? session.customer_email,
      uid: session.client_reference_id ?? session.metadata?.uid,
      fbp: saved.fbp,
      fbc: saved.fbc,
      ip: saved.ip,
      userAgent: saved.userAgent,
      sourceUrl: saved.sourceUrl,
      planLabel: planKey && isPlanKey(planKey) ? PLANS[planKey].name : null,
    });

    const result = await sendEventToMeta(event);
    await ref.set(
      result.ok
        ? { status: "sent", sentAt: new Date().toISOString(), error: null }
        : { status: "failed", error: result.error ?? "unknown", updatedAt: new Date().toISOString() },
      { merge: true }
    );
    if (!result.ok) console.error("Meta Purchase not delivered:", result.error);
  } catch (err) {
    console.error("Meta Purchase tracking error:", err);
  }
}
