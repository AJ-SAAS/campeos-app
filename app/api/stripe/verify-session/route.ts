import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";
import { amountToValue } from "@/lib/meta/payload";

/**
 * Used by the /welcome page. Asks Stripe whether this Checkout Session is
 * really paid AND belongs to the person asking, so nobody can fire a
 * Purchase with a made-up or someone else's session id. The page then
 * sends the browser copy of the Purchase with the numbers returned here.
 * Tracking never decides access: that is the webhook's job.
 */
export async function POST(req: Request) {
  const caller = await getVerifiedUser(req);
  if (!caller) return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });

  let sessionId: unknown;
  try {
    ({ sessionId } = await req.json());
  } catch {
    return NextResponse.json({ paid: false }, { status: 400 });
  }
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) {
    return NextResponse.json({ paid: false }, { status: 400 });
  }

  try {
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    const owner = session.client_reference_id ?? session.metadata?.uid;
    if (owner !== caller.uid) return NextResponse.json({ paid: false }, { status: 403 });

    const paid = session.mode === "subscription" && session.payment_status === "paid";
    const amount = session.amount_total ?? 0;
    return NextResponse.json({
      paid,
      eventId: session.id,
      value: amountToValue(amount),
      currency: (session.currency ?? "usd").toUpperCase(),
      // A fully discounted checkout charged nothing, so it is not a sale to report.
      countable: paid && amount > 0,
    });
  } catch {
    return NextResponse.json({ paid: false }, { status: 404 });
  }
}
