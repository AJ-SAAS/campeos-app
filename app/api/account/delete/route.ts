import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

// Permanently deletes a signed-in user's account: every Firestore
// document that belongs to them, then the Firebase Auth user itself.
// Called from the Settings page (components there do the "are you
// sure" confirmation — this route does the deletion, no confirmation
// of its own).
//
// The uid comes from verifying the caller's own Firebase ID token, not
// from the request body — otherwise any signed-in user could pass
// someone else's uid and delete their account.
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

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid or expired session — sign in again." }, { status: 401 });
  }

  try {
    const db = getAdminDb();

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

    await getAdminAuth().deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't delete the account." },
      { status: 500 }
    );
  }
}
