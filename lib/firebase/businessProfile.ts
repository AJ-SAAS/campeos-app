import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./client";
import { OfferContext } from "../ai/prompts";

/**
 * The onboarding answers that aren't part of the offer itself — see
 * lib/onboarding/answers.ts. Optional because accounts created before
 * the new onboarding don't have them.
 */
export interface OnboardingAnswers {
  /** Platform ids picked in "Where do you reach your customers?" */
  channels?: string[];
  /** Frequency id picked in "How often do you run a sale or promo?" */
  frequency?: string;
  /** Plan suggested from the frequency answer ("starter" | "pro"). */
  suggestedPlan?: string;
  /** The link or pasted page text from "Do you have a sales page?" */
  salesPage?: string;
  /** When onboarding was finished (ISO string). */
  onboardedAt?: string;
  /** The campaign built straight after onboarding, shown as "Your first
   * launch" on the dashboard. */
  firstCampaignId?: string;
  /** True once they close the floating "Get started" list for good. */
  checklistHidden?: boolean;
  /** Default "Sign emails as" name for new offers (Settings). */
  signOffName?: string;
}

export interface BusinessProfile extends OfferContext, OnboardingAnswers {
  updatedAt?: unknown;
}

// What the agent remembers about this user's business between
// conversations — so a second campaign doesn't start from zero. One doc
// per user, keyed by uid (same pattern as usage/{uid}). Written first by
// onboarding (app/onboarding/page.tsx), then again after every campaign
// the agent builds (see lib/ai/agentActions.ts), and read before every
// new agent conversation (see components/agent/AgentPanel.tsx).
export async function getBusinessProfile(uid: string): Promise<BusinessProfile | null> {
  const snap = await getDoc(doc(db, "businessProfiles", uid));
  if (!snap.exists()) return null;
  return snap.data() as BusinessProfile;
}

// merge: true so the agent saving a new offer after a campaign never
// wipes the onboarding answers (channels, frequency) stored on the same
// doc. Before those existed this was a full overwrite, which was fine
// because the doc only ever held the offer fields.
export async function saveBusinessProfile(
  uid: string,
  profile: OfferContext & OnboardingAnswers
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(profile).filter(([, v]) => v !== undefined)
  );
  await setDoc(
    doc(db, "businessProfiles", uid),
    { ...clean, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function saveFirstCampaignId(uid: string, campaignId: string): Promise<void> {
  await setDoc(doc(db, "businessProfiles", uid), { firstCampaignId: campaignId }, { merge: true });
}

export async function hideChecklist(uid: string): Promise<void> {
  await setDoc(doc(db, "businessProfiles", uid), { checklistHidden: true }, { merge: true });
}
