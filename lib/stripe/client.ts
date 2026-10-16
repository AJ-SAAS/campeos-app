import Stripe from "stripe";

// Server-only, same rule as lib/ai/client.ts: the secret key is never
// imported into a client component. Used from app/api/stripe/* routes.
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Use a TEST mode key (sk_test_...) while building — see .env.local.example."
    );
  }

  stripeClient = new Stripe(key, {
    apiVersion: "2026-09-30.endive",
  });
  return stripeClient;
}

/**
 * The two plans, mapped to env-configured Stripe Price ids so the actual
 * ids (test or live) never get hardcoded here. Keep in sync with the
 * pricing decision on record: two tiers, no free tier, no trial.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    price: "$39/mo",
    priceId: process.env.STRIPE_PRICE_STARTER,
  },
  pro: {
    name: "Pro",
    price: "$99/mo",
    priceId: process.env.STRIPE_PRICE_PRO,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: string): value is PlanKey {
  return value === "starter" || value === "pro";
}
