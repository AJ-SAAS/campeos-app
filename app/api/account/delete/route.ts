import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { deleteAuthUser } from "@/lib/emailCode";

// Permanently deletes a signed-in user's account: every Firestore
// document that belongs to them, then the Firebase Auth user itself.
// Called from the Settings page (components there do the "are you
// sure" confirmation — this route does the deletion, no confirmation
// of its own).
//
// The uid comes from Firebase verifying the caller's own ID token via
// the Identity Toolkit REST API (accounts:lookup), not from the request
// body — otherwise any signed-in user could pass someone else's uid and
// delete their account. This uses the REST API instead of the Admin
// SDK's firebase-admin/auth on purpose: that module can't currently be
// loaded at all in this deploy (see the comment in
// lib/firebase/admin.ts) — a jwks-rsa/jose version conflict, not
// something fixable from this app's code. The REST calls give the same
// guarantee (Google verifies/deletes server-side) without that broken
// dependency.
//
// This does NOT cancel a Stripe subscription — Settings tells the user
// to cancel billing first. Wiring that up here would mean either taking
// a Stripe dependency in this route or trusting the client to have done
// it, and a half-canceled subscription silently left behind is worse
// than asking the user to handle it in Billing before deleting.
export const runtime = "nodejs";

const COLLECTIONS_BY_UID_FIELD = [
  "campaigns",
  "offers",
  "winners",
  "salesCalls",
  "agentMessages",
] as const;

const DOCS_KEYED_BY_UID = ["usage", "businessProfiles", "subscriptions"] as const;

const IDENTITY_TOOLKIT_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_FIREBASE_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  // accounts:lookup both verifies the token (Google rejects an invalid
  // or expired one) and hands back the uid it belongs to — the REST
  // equivalent of admin.auth().verifyIdToken().
  let uid: string;
  try {
    const lookupRes = await fetch(`${IDENTITY_TOOLKIT_BASE}:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const lookupData = await lookupRes.json();
    if (!lookupRes.ok || !lookupData.users?.[0]?.localId) {
      throw new Error(lookupData.error?.message ?? "Token lookup failed.");
    }
    uid = lookupData.users[0].localId;
  } catch {
    return NextResponse.json({ error: "Invalid or expired session — sign in again." }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // Sign-in account first. The caller's token proved who they are, and
    // deleting with the server's own access works however long ago they
    // signed in (their own token fails with CREDENTIAL_TOO_OLD_LOGIN_AGAIN).
    // Doing it first also means a failure here leaves their data untouched,
    // instead of wiping it and leaving a login with nothing behind it.
    // freeTrials and dailyUsage are kept on purpose: deleting and signing up
    // again must not hand out a fresh set of free messages.
    await deleteAuthUser(uid);

    for (const collectionName of COLLECTIONS_BY_UID_FIELD) {
      const snap = await db.collection(collectionName).where("uid", "==", uid).get();
      for (const docSnap of snap.docs) {
        // Campaigns keep their copy in a steps/ subcollection, which
        // doesn't cascade-delete on its own — same reason
        // lib/firebase/campaigns.ts's deleteCampaign batches it.
        if (collectionName === "campaigns") {
          const stepsSnap = await docSnap.ref.collection("steps").get();
          for (const stepDoc of stepsSnap.docs) {
            await stepDoc.ref.delete();
          }
        }
        await docSnap.ref.delete();
      }
    }

    for (const collectionName of DOCS_KEYED_BY_UID) {
      await db.collection(collectionName).doc(uid).delete();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't delete the account." },
      { status: 500 }
    );
  }
}
