import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { isDisposableEmail } from "@/lib/disposableEmail";
import {
  CODE_TTL_MS,
  MAX_SENDS_PER_HOUR,
  MAX_SENDS_PER_IP_HOUR,
  MailNotConfigured,
  RESEND_COOLDOWN_S,
  docIdForEmail,
  generateCode,
  hashCode,
  ipFrom,
  isValidEmail,
  normalizeEmail,
  sendCodeEmail,
} from "@/lib/emailCode";
import { createHash } from "node:crypto";

// Step 1 of "email me a code": checks the address, limits how often a code
// can be sent (per email and per network), stores the code's hash, emails it.
export const runtime = "nodejs";

const HOUR = 60 * 60 * 1000;

export async function POST(req: Request) {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = normalizeEmail(body.email ?? "");
  } catch {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { error: "Use your real email so we can send you a code. Temporary inboxes don't work.", code: "bad_email" },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const now = Date.now();
    const ref = db.collection("emailCodes").doc(docIdForEmail(email));
    const ipRef = db.collection("emailCodeIps").doc(createHash("sha256").update(ipFrom(req)).digest("hex"));
    const code = generateCode();

    const verdict = await db.runTransaction(async (tx) => {
      const [snap, ipSnap] = await Promise.all([tx.get(ref), tx.get(ipRef)]);
      const d = snap.data() as { sentAt?: number; windowStart?: number; sends?: number } | undefined;
      const ip = ipSnap.data() as { windowStart?: number; sends?: number } | undefined;

      if (d?.sentAt && now - d.sentAt < RESEND_COOLDOWN_S * 1000) {
        return { ok: false as const, wait: Math.ceil((RESEND_COOLDOWN_S * 1000 - (now - d.sentAt)) / 1000) };
      }
      const inWindow = d?.windowStart && now - d.windowStart < HOUR;
      const sends = inWindow ? d?.sends ?? 0 : 0;
      if (sends >= MAX_SENDS_PER_HOUR) return { ok: false as const, tooMany: true };

      const ipInWindow = ip?.windowStart && now - ip.windowStart < HOUR;
      const ipSends = ipInWindow ? ip?.sends ?? 0 : 0;
      if (ipSends >= MAX_SENDS_PER_IP_HOUR) return { ok: false as const, tooMany: true };

      tx.set(ref, {
        hash: hashCode(email, code),
        expiresAt: now + CODE_TTL_MS,
        attempts: 0,
        sentAt: now,
        windowStart: inWindow ? d!.windowStart : now,
        sends: sends + 1,
      });
      tx.set(ipRef, { windowStart: ipInWindow ? ip!.windowStart : now, sends: ipSends + 1 });
      return { ok: true as const };
    });

    if (!verdict.ok) {
      if ("wait" in verdict) {
        return NextResponse.json(
          { error: `Wait ${verdict.wait} seconds before asking for another code.`, wait: verdict.wait },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Too many codes asked for. Try again in an hour." }, { status: 429 });
    }

    try {
      await sendCodeEmail(email, code);
    } catch (err) {
      // Don't leave a code nobody received, and let them ask again right away.
      await ref.delete().catch(() => {});
      if (err instanceof MailNotConfigured) {
        console.error("send-code: email sender is not configured", err.message);
        return NextResponse.json({ error: "Email sign-in isn't ready yet. Use Google for now." }, { status: 503 });
      }
      console.error("send-code: email failed", err);
      return NextResponse.json({ error: "We couldn't send that email. Check the address and try again." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, cooldown: RESEND_COOLDOWN_S });
  } catch (err) {
    console.error("send-code failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment." }, { status: 500 });
  }
}
