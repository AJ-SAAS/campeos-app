import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";

/**
 * Opens Stripe's hosted Billing Portal for an already-subscribed user —
 * update card, cancel, see invoices. Who you are comes from the
 * verified ID token, so nobody can open someone else's billing.
 */
export async function POST(req: Request) {
  try {
    const caller = await getVerifiedUser(req);
    if (!caller) {
      return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });
    }
    const uid = caller.uid;

    const db = getAdminDb();
    const subSnap = await db.collection("subscriptions").doc(uid).get();
    const customerId = subSnap.exists ? (subSnap.data()?.stripeCustomerId as string | undefined) : undefined;

    if (!customerId) {
      return NextResponse.json({ error: "No billing account yet. Pick a plan first." }, { status: 404 });
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.get("origin")}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't open billing portal." },
      { status: 500 }
    );
  }
}
