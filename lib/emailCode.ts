// Server-only: "email me a code" sign-in.
//
// Firebase can only email a link, not a code, so the code part lives here:
//   1. /api/auth/send-code makes a 6-digit code, stores only its hash in
//      Firestore (emailCodes/{hash of email}) and emails it with Resend.
//   2. /api/auth/verify-code checks the code, finds or creates the Firebase
//      user for that email (already marked verified, since they just proved
//      they own the inbox) and returns a Firebase custom token.
//   3. The browser calls signInWithCustomToken(token). Same uid as a Google
//      sign-in with the same email, so nobody ends up with two accounts.
//
// No firebase-admin/auth here on purpose (see the note at the bottom of
// lib/firebase/admin.ts). The custom token is signed with node:crypto and the
// user lookup/create goes through Identity Toolkit's REST API, using a
// short-lived access token from the same service account the Stripe webhook
// already uses (FIREBASE_SERVICE_ACCOUNT_KEY).

import { createHash, createSign, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_S = 30;
export const MAX_SENDS_PER_HOUR = 5;
export const MAX_SENDS_PER_IP_HOUR = 20;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** What we store: the code is never saved, only this hash of code + email. */
export function hashCode(email: string, code: string, secret = serverSecret()): string {
  return createHash("sha256").update(`${secret}:${normalizeEmail(email)}:${code}`).digest("hex");
}

export function codesMatch(expectedHash: string, email: string, code: string, secret = serverSecret()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(hashCode(email, code, secret), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function docIdForEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function serverSecret(): string {
  // The service-account key is already a server-only secret, so reuse it
  // rather than asking for one more env var.
  return process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.slice(-64) || "campeos-dev-secret";
}

export function ipFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

// ---------- email (Resend) ----------

export class MailNotConfigured extends Error {}

export async function sendCodeEmail(to: string, code: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!key || !from) throw new MailNotConfigured("RESEND_API_KEY or AUTH_EMAIL_FROM is not set");

  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `${code} is your Campeos code`,
      text: `Your Campeos code is ${spaced}.\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#17131F">
  <p style="font-size:16px;margin:0 0 16px">Your Campeos code is:</p>
  <p style="font-size:36px;font-weight:700;letter-spacing:6px;margin:0 0 20px">${spaced}</p>
  <p style="font-size:14px;line-height:1.5;color:#6B6577;margin:0">It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`);
}

// ---------- Firebase (service account, REST) ----------

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not set");
  const sa = JSON.parse(raw) as ServiceAccount;
  return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

function signJwt(payload: Record<string, unknown>, privateKey: string): string {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

/** The token the browser trades for a signed-in Firebase session. */
export function mintCustomToken(uid: string, sa = serviceAccount(), now = Math.floor(Date.now() / 1000)): string {
  return signJwt(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3600,
      uid,
    },
    sa.private_key
  );
}

let cachedAccess: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.exp - 60 > now) return cachedAccess.token;
  const assertion = signJwt(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    sa.private_key
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccess = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

async function itk(sa: ServiceAccount, path: string, body: unknown): Promise<Response> {
  const token = await accessToken(sa);
  return fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * The Firebase uid for this email, creating the account if it's new. The
 * account is marked email-verified either way: they just read the code from
 * the inbox. Returns whether it was newly created.
 */
export async function findOrCreateUser(email: string): Promise<{ uid: string; created: boolean }> {
  const sa = serviceAccount();
  const e = normalizeEmail(email);

  const find = async () => {
    const res = await itk(sa, "accounts:lookup", { email: [e] });
    if (!res.ok) throw new Error(`lookup ${res.status}`);
    const data = (await res.json()) as { users?: { localId: string; emailVerified?: boolean }[] };
    return data.users?.[0] ?? null;
  };

  const existing = await find();
  if (existing) {
    if (!existing.emailVerified) {
      await itk(sa, "accounts:update", { localId: existing.localId, emailVerified: true });
    }
    return { uid: existing.localId, created: false };
  }

  const res = await itk(sa, "accounts", { email: e, emailVerified: true });
  if (res.ok) {
    const data = (await res.json()) as { localId: string };
    return { uid: data.localId, created: true };
  }
  // Two tabs verifying at once: the other one won, so use that account.
  const again = await find();
  if (again) return { uid: again.localId, created: false };
  throw new Error(`create ${res.status}`);
}

/**
 * Deletes a Firebase Auth user with the server's own access. Used by account
 * deletion: deleting with the person's own token fails with
 * CREDENTIAL_TOO_OLD_LOGIN_AGAIN unless they signed in a few minutes ago.
 * Callers must already have proven who the uid belongs to.
 */
export async function deleteAuthUser(uid: string): Promise<void> {
  const sa = serviceAccount();
  const res = await itk(sa, "accounts:delete", { localId: uid });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    // Already gone is fine.
    if (data.error?.message?.includes("USER_NOT_FOUND")) return;
    throw new Error(data.error?.message ?? `delete ${res.status}`);
  }
}
