// MailerLite tagging — server-only. Used by the Stripe webhook to move a
// paying user from the "Signed Up - Unpaid" group into "Customer". The
// other half of this (adding a brand-new signup to "Signed Up - Unpaid")
// happens outside this app, in a Firebase Cloud Function that runs on
// Auth signup — see the functions/index.js snippet in the setup notes,
// since Next.js API routes have no way to hook into Firebase Auth
// triggers directly.
//
// Env vars (see .env.local.example):
//   MAILERLITE_API_KEY
//   ML_GROUP_UNPAID     — MailerLite group id for "Signed Up - Unpaid"
//   ML_GROUP_CUSTOMER   — MailerLite group id for "Customer"
//
// Any failure here is logged and swallowed, never thrown — a MailerLite
// hiccup should never make the Stripe webhook itself look like it failed
// (which would make Stripe keep retrying a payment event that actually
// succeeded).

const ML_BASE = "https://connect.mailerlite.com/api";

async function mailerlite(path: string, method: string, body?: unknown) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.warn("MAILERLITE_API_KEY is not set — skipping MailerLite call.");
    return null;
  }
  const res = await fetch(`${ML_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  // 404 on a group-removal call just means they weren't in that group —
  // not an error worth surfacing.
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`MailerLite ${method} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204 || res.status === 404) return null;
  return res.json().catch(() => null);
}

/** Creates the subscriber if new, or updates them if they exist. Adds
 * them to the given group (does not remove them from any other group). */
async function addToGroup(email: string, groupId: string) {
  return mailerlite("/subscribers", "POST", { email, groups: [groupId] });
}

/** Looks the subscriber up by email to get their id, then removes them
 * from one group. Does nothing if they aren't in MailerLite yet. */
async function removeFromGroup(email: string, groupId: string) {
  const found = (await mailerlite(`/subscribers/${encodeURIComponent(email)}`, "GET")) as
    | { data?: { id?: string } }
    | null;
  const id = found?.data?.id;
  if (!id) return;
  await mailerlite(`/subscribers/${id}/groups/${groupId}`, "DELETE");
}

/** Call when someone's payment succeeds: tags them Customer and takes
 * them out of the abandoned-signup group. Never throws. */
export async function markCustomerInMailerLite(email: string | null | undefined) {
  if (!email) return;
  const customerGroup = process.env.ML_GROUP_CUSTOMER;
  const unpaidGroup = process.env.ML_GROUP_UNPAID;
  if (!customerGroup) {
    console.warn("ML_GROUP_CUSTOMER is not set — skipping MailerLite tagging.");
    return;
  }
  try {
    await addToGroup(email, customerGroup);
    if (unpaidGroup) await removeFromGroup(email, unpaidGroup);
  } catch (err) {
    console.error("MailerLite: couldn't tag new customer:", err);
  }
}
