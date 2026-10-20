import { NextResponse } from "next/server";
import { getStripeClient, PLANS, isPlanKey, isBillingInterval, type BillingInterval } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";

/**
 * Starts a Stripe Checkout session for one of the two plans, monthly or
 * yearly. No free trial (billing decision: paid only, no free tier/trial).
 *
 * Body: { plan: "starter" | "pro", interval?: "monthly" | "yearly" }.
 * interval defaults to "monthly". The uid and email come from the
 * verified ID token (lib/serverAuth.ts), never the body, so nobody can
 * start a checkout as someone else.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plan, interval: rawInterval } = body as { plan?: string; interval?: string };

    const caller = await getVerifiedUser(req);
    if (!caller) {
      return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });
    }
    const uid = caller.uid;
    const email = caller.email ?? undefined;
    if (!plan || !isPlanKey(plan)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const interval: BillingInterval =
      rawInterval && isBillingInterval(rawInterval) ? rawInterval : "monthly";

    const planConfig = PLANS[plan];
    const priceId = planConfig.priceId[interval];
    if (!priceId) {
      const envVar = interval === "yearly" ? `STRIPE_PRICE_${plan.toUpperCase()}_YEARLY` : `STRIPE_PRICE_${plan.toUpperCase()}`;
      return NextResponse.json(
        { error: `No Stripe price id configured for the ${planConfig.name} ${interval} plan. Set ${envVar} in your environment.` },
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
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { uid, plan, interval },
      },
      metadata: { uid, plan, interval },
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
