import { NextResponse } from "next/server";
import { getStripeClient, PLANS, isPlanKey } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Starts a Stripe Checkout session for one of the two plans. No free
 * trial (billing decision: paid only, no free tier/trial) — the
 * Checkout Session is created without a trial_period_days.
 *
 * Body: { uid: string, email: string, plan: "starter" | "pro" }
 * uid/email come from the signed-in Firebase user on the client — there's
 * no server session to read them from (same trust model the rest of the
 * app uses: lib/firebase/usage.ts's own comment explains why that's
 * acceptable here, same reasoning applies).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, email, plan } = body as { uid?: string; email?: string; plan?: string };

    if (!uid || !email) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
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
