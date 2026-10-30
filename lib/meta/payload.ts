import { createHash } from "node:crypto";

// Builds the one event Campeos ever sends to Meta from the server:
// Purchase. Pure, so it can be tested without any network.

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Meta wants phone numbers as digits only, country code included, no plus
 * or spaces. Stripe gives them like "+372 5555 5555". Too short to be real
 * returns null so we never send junk.
 */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Stripe amounts are in the smallest unit (cents). Meta wants dollars. */
export function amountToValue(amountTotal: number): number {
  return Math.round(amountTotal) / 100;
}

export interface PurchaseInput {
  /** The Stripe Checkout Session id. Same id the browser copy uses. */
  eventId: string;
  amountTotal: number;
  currency: string;
  email?: string | null;
  phone?: string | null;
  uid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  sourceUrl?: string | null;
  /** Unix seconds. Defaults to now. */
  eventTime?: number;
  planLabel?: string | null;
}

export function buildPurchaseEvent(input: PurchaseInput) {
  const user_data: Record<string, unknown> = {};
  if (input.email) user_data.em = [sha256(normalizeEmail(input.email))];
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone) user_data.ph = [sha256(phone)];
  if (input.uid) user_data.external_id = [sha256(input.uid)];
  if (input.fbp) user_data.fbp = input.fbp;
  if (input.fbc) user_data.fbc = input.fbc;
  if (input.ip) user_data.client_ip_address = input.ip;
  if (input.userAgent) user_data.client_user_agent = input.userAgent;

  const custom_data: Record<string, unknown> = {
    value: amountToValue(input.amountTotal),
    currency: input.currency.toUpperCase(),
  };
  if (input.planLabel) custom_data.content_name = input.planLabel;

  return {
    event_name: "Purchase",
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    ...(input.sourceUrl ? { event_source_url: input.sourceUrl } : {}),
    user_data,
    custom_data,
  };
}

/** First address in x-forwarded-for, or null. */
export function clientIpFrom(forwardedFor: string | null): string | null {
  const first = (forwardedFor ?? "").split(",")[0]?.trim();
  return first ? first : null;
}

/** Cookie values come from the browser, so keep only sane-looking ones. */
export function cleanMetaCookie(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return /^[A-Za-z0-9._-]{4,200}$/.test(v) ? v : undefined;
}
