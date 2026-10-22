// Server-only: remembers what the page scan found, so scanning the same page
// again (a retry, a second try after a typo elsewhere, two people with the
// same public page) costs nothing. Keyed by a hash of the page address or of
// the pasted words, never by user. Stored in scanCache/{hash}. Only the
// Admin SDK touches it, so no client rule opens it. Any failure here is
// ignored: the cache is a saving, never a requirement.

import { createHash } from "node:crypto";
import { getAdminDb } from "@/lib/firebase/admin";

const TTL_MS = 2 * 24 * 60 * 60 * 1000;

export const cacheKey = (kind: "url" | "text", value: string) =>
  createHash("sha256").update(`${kind}:${value}`).digest("hex");

export async function getCachedScan<T>(key: string): Promise<T | null> {
  try {
    const snap = await getAdminDb().collection("scanCache").doc(key).get();
    const d = snap.data() as { at?: number; result?: string } | undefined;
    if (!d?.at || !d.result || Date.now() - d.at > TTL_MS) return null;
    return JSON.parse(d.result) as T;
  } catch {
    return null;
  }
}

export async function putCachedScan(key: string, result: unknown): Promise<void> {
  try {
    await getAdminDb().collection("scanCache").doc(key).set({ at: Date.now(), result: JSON.stringify(result) });
  } catch {
    // ignore
  }
}
