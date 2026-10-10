import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./client";
import { OfferContext } from "../ai/prompts";

export interface BusinessProfile extends OfferContext {
  updatedAt?: unknown;
}

// What the agent remembers about this user's business between
// conversations — so a second campaign doesn't start from zero. One doc
// per user, keyed by uid (same pattern as usage/{uid}). Saved after every
// campaign the agent builds (see lib/ai/agentActions.ts), and read before
// every new agent conversation (see components/agent/AgentPanel.tsx) so
// the agent can say "here's what I already know" instead of re-asking.
//
// This deliberately mirrors OfferContext's shape rather than adding a
// separate schema — a "business profile" and "the offer for the last
// campaign built" are the same five fields today. If Campeos grows beyond
// one offer per account, this is the file to split.
export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, "businessProfiles", uid));
  if (!snap.exists()) return null;
  return snap.data() as BusinessProfile;
}

export async function saveBusinessProfile(uid: string, profile: OfferContext): Promise<void> {
  await setDoc(doc(db, "businessProfiles", uid), {
    ...profile,
    updatedAt: serverTimestamp(),
  });
}
