import { NextResponse } from "next/server";
import { getStripeClient, PLANS, isPlanKey } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";

/**
 * Starts a Stripe Checkout session for one of the two plans. No free
 * trial (billing decision: paid only, no free tier/trial) — the
 * Checkout Session is created without a trial_period_days.
 *
 * Body: { plan: "starter" | "pro" }. The uid and email come from the
 * verified ID token (lib/serverAuth.ts), not the body.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan } = body as { plan?: string };

    const caller = await getVerifiedUser(req);
    if (!caller) {
      return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });
    }
    const uid = caller.uid;
    const email = caller.email ?? undefined;
    if (!plan || !isPlanKey(plan)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }

    const planConfig = PLANS[plan];
    if (!planConfig.priceId) {
      return NextResponse.json(
        {
          error: `No Stripe price id configured for the ${planConfig.name} plan — set STRIPE_PRICE_${plan.toUpperCase()} in your environment.`,
        },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    const db = getAdminDb();

    // Reuse the existing Stripe customer if this user already has one
    // (e.g. they canceled and are resubscribing) — avoids a duplicate
    // customer record for the same person.
    const subRef = db.collection("subscriptions").doc(uid);
    const subSnap = await subRef.get();
    const existingCustomerId = subSnap.exists ? (subSnap.data()?.stripeCustomerId as string | undefined) : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: existingCustomerId,
      customer_email: existingCustomerId ? undefined : email,
      client_reference_id: uid,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      subscription_data: {
        metadata: { uid, plan },
      },
      metadata: { uid, plan },
      success_url: `${req.headers.get("origin")}/dashboard?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/billing?checkout=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe didn't return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed." },
      { status: 500 }
    );
  }
}
