import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Opens Stripe's hosted Billing Portal for an already-subscribed user —
 * update card, cancel, see invoices. Body: { uid: string }.
 */
export async function POST(req: Request) {
  try {
    const { uid } = (await req.json()) as { uid?: string };
    if (!uid) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }

    const db = getAdminDb();
    const subSnap = await db.collection("subscriptions").doc(uid).get();
    const customerId = subSnap.exists ? (subSnap.data()?.stripeCustomerId as string | undefined) : undefined;

    if (!customerId) {
      return NextResponse.json({ error: "No billing account yet — subscribe first." }, { status: 404 });
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
