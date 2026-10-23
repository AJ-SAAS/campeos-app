import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, PlanKey, BillingInterval } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";
import { markCustomerInMailerLite } from "@/lib/mailerlite";

// Stripe needs the raw request body to verify the signature — Next.js
// would otherwise parse it as JSON first, which breaks verification.
export const runtime = "nodejs";

async function upsertSubscription(
  uid: string,
  fields: Partial<{
    plan: PlanKey | null;
    interval: BillingInterval | null;
    status: Stripe.Subscription.Status | null;
    stripeCustomerId: string;
    stripeSubscriptionId: string | null;
  }>
) {
  const db = getAdminDb();
  await db
    .collection("subscriptions")
    .doc(uid)
    .set({ uid, updatedAt: new Date().toISOString(), ...fields }, { merge: true });
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // First successful payment — the session carries the uid we set
      // as client_reference_id / metadata in the checkout route.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id ?? session.metadata?.uid;
        const plan = session.metadata?.plan as PlanKey | undefined;
        const interval = session.metadata?.interval as BillingInterval | undefined;
        if (!uid) break; // Shouldn't happen — checkout always sets it.

        await upsertSubscription(uid, {
          plan: plan ?? null,
          interval: interval ?? null,
          status: "active",
          stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        });

        // Tag them Customer in MailerLite and take them out of the
        // "Signed Up - Unpaid" group. Best-effort — never blocks or fails
        // the webhook itself (see lib/mailerlite.ts).
        await markCustomerInMailerLite(session.customer_details?.email ?? session.customer_email);
        break;
      }

      // Renewals, upgrades/downgrades, payment failures, cancellations —
      // all land here with the subscription's current status. The uid
      // comes from the subscription's own metadata (set in the checkout
      // route's subscription_data.metadata), not the customer, since
      // that's what's guaranteed present on every subsequent event.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const uid = subscription.metadata?.uid;
        if (!uid) break;

        await upsertSubscription(uid, {
          status: subscription.status,
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      default:
        // Other event types (invoice.*, payment_method.*, etc.) aren't
        // acted on yet — ignored rather than erroring, per Stripe's own
        // guidance to 2xx anything you don't handle.
        break;
    }
  } catch (err) {
    // A failure here means Firestore didn't get updated — return 500 so
    // Stripe retries, rather than silently losing the event.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handling failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
