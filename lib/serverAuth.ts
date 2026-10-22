// Server-only: works out WHO is calling an API route from the Firebase ID
// token the browser sends (Authorization: Bearer <token>), instead of
// trusting a uid in the request body. Anyone can type any uid into a
// request body, including the admin's, so every route that spends money
// (OpenAI, Stripe) or touches one person's data checks this first.
//
// Uses Identity Toolkit's accounts:lookup over REST, the same approach as
// app/api/account/delete/route.ts and for the same reason:
// firebase-admin/auth can't be imported in this app (see the note at the
// bottom of lib/firebase/admin.ts). Google verifies the token either way.

import { isDisposableEmail } from "@/lib/disposableEmail";

const LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export interface VerifiedUser {
  uid: string;
  email: string | null;
  /** Firebase's own flag: true once the person clicked the link we emailed. */
  emailVerified: boolean;
  /** Signed up with email + password (Google accounts arrive already verified). */
  passwordUser: boolean;
}

export async function getVerifiedUser(req: Request): Promise<VerifiedUser | null> {
  const header = req.headers.get("authorization");
  const idToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!idToken) return null;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${LOOKUP_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const u = data.users?.[0];
    if (!u?.localId) return null;
    return {
      uid: u.localId as string,
      email: (u.email as string | undefined) ?? null,
      emailVerified: u.emailVerified === true,
      passwordUser: ((u.providerUserInfo as { providerId?: string }[] | undefined) ?? []).some((p) => p.providerId === "password"),
    };
  } catch {
    return null;
  }
}

export const SIGN_IN_AGAIN = "Your session ran out. Refresh the page and sign in again.";
export const VERIFY_EMAIL_FIRST = "Confirm your email first. We sent you a link. Open it, then come back and try again.";
export const BAD_EMAIL = "That email can't be used to try Campeos. Sign in with your real email or Google.";

/** True when this account has not yet proven it owns its email. */
export function needsEmailVerification(user: VerifiedUser): boolean {
  return user.passwordUser && !user.emailVerified;
}

/**
 * The gate for every route that spends AI money: signed in, email confirmed,
 * and not a throwaway inbox. Returns the user, or the Response to send back.
 * `isAdmin` lets the owner's own account through whatever its email state.
 */
export async function requireVerifiedUser(
  req: Request,
  isAdmin: (uid: string) => boolean = () => false
): Promise<{ user: VerifiedUser; error?: undefined } | { user?: undefined; error: Response }> {
  const user = await getVerifiedUser(req);
  if (!user) {
    return { error: Response.json({ error: SIGN_IN_AGAIN }, { status: 401 }) };
  }
  if (isAdmin(user.uid)) return { user };
  if (needsEmailVerification(user)) {
    return { error: Response.json({ error: VERIFY_EMAIL_FIRST, code: "verify_email" }, { status: 403 }) };
  }
  if (isDisposableEmail(user.email)) {
    return { error: Response.json({ error: BAD_EMAIL, code: "bad_email" }, { status: 403 }) };
  }
  return { user };
}
