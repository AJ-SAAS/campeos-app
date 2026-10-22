import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isDisposableEmail } from "@/lib/disposableEmail";
import { MAX_ATTEMPTS, codesMatch, docIdForEmail, findOrCreateUser, isValidEmail, mintCustomToken, normalizeEmail } from "@/lib/emailCode";

// Step 2 of "email me a code": checks the 6 digits and, if right, returns a
// Firebase custom token the browser signs in with. Five wrong tries and the
// code is dead; they have to ask for a new one.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let email = "";
  let code = "";
  try {
    const body = (await req.json()) as { email?: string; code?: string };
    email = normalizeEmail(body.email ?? "");
    code = String(body.code ?? "").replace(/\s+/g, "");
  } catch {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json({ error: "That email can't be used to try Campeos.", code: "bad_email" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const ref = db.collection("emailCodes").doc(docIdForEmail(email));

    // Count the try and check the code in one step, so two fast guesses
    // can't both slip through under the limit.
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data() as { hash?: string; expiresAt?: number; attempts?: number } | undefined;
      if (!d?.hash || !d.expiresAt) return "none" as const;
      if (Date.now() > d.expiresAt) {
        tx.delete(ref);
        return "expired" as const;
      }
      if ((d.attempts ?? 0) >= MAX_ATTEMPTS) return "locked" as const;
      if (!codesMatch(d.hash, email, code)) {
        tx.update(ref, { attempts: (d.attempts ?? 0) + 1 });
        return "wrong" as const;
      }
      tx.delete(ref); // one use only
      return "ok" as const;
    });

    if (result === "none" || result === "expired") {
      return NextResponse.json({ error: "That code has run out. Tap \"Send a new code\".", code: "expired" }, { status: 400 });
    }
    if (result === "locked") {
      return NextResponse.json({ error: "Too many wrong tries. Tap \"Send a new code\".", code: "locked" }, { status: 429 });
    }
    if (result === "wrong") {
      return NextResponse.json({ error: "That code isn't right. Check it and try again.", code: "wrong" }, { status: 400 });
    }

    const { uid } = await findOrCreateUser(email);
    return NextResponse.json({ token: mintCustomToken(uid) });
  } catch (err) {
    console.error("verify-code failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
  }
}
