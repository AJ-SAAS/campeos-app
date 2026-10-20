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

const LOOKUP_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export interface VerifiedUser {
  uid: string;
  email: string | null;
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
    return { uid: u.localId as string, email: (u.email as string | undefined) ?? null };
  } catch {
    return null;
  }
}

export const SIGN_IN_AGAIN = "Your session ran out. Refresh the page and sign in again.";
