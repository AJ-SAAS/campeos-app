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

export type BillingInterval = "monthly" | "yearly";

export function isBillingInterval(value: string): value is BillingInterval {
  return value === "monthly" || value === "yearly";
}

/**
 * The two plans, mapped to env-configured Stripe Price ids so the actual
 * ids (test or live) never get hardcoded here. Keep in sync with the
 * pricing decision on record: two tiers, no free tier, no trial. Each
 * plan has a separate yearly price (not the same price billed less often
 * — Stripe prices are tied to one billing interval each), set from its
 * own env var so the existing monthly ids never need to change.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    price: { monthly: "$39/mo", yearly: "$33/mo, billed yearly" },
    priceId: {
      monthly: process.env.STRIPE_PRICE_STARTER,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    },
  },
  pro: {
    name: "Pro",
    price: { monthly: "$99/mo", yearly: "$83/mo, billed yearly" },
    priceId: {
      monthly: process.env.STRIPE_PRICE_PRO,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlanKey(value: string): value is PlanKey {
  return value === "starter" || value === "pro";
}
