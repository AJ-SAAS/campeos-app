import {
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./client";
import { OfferContext } from "../ai/prompts";
import { StepTemplate } from "../templates/types";
import { StepImage } from "../images";

export interface Campaign {
  id: string;
  uid: string;
  title: string;
  templateId: string;
  offer: OfferContext;
  eventDate: string; // ISO string
  createdAt?: Timestamp;
  /** Messages switched off in the builder (templateStepIds). */
  skippedSteps?: string[];
  /** Whole channels switched off in the builder ("email", "sms", "ad", "social"). */
  skippedChannels?: string[];
}

export interface CampaignStepDoc {
  templateStepId: string;
  channel: StepTemplate["channel"];
  title: string;
  purpose: string;
  angle: string;
  goals: string[];
  persuasionElements: string[];
  phaseName: string;
  phaseObjective: string;
  fields: StepTemplate["fields"];
  scheduledAt: string; // ISO string
  copy: Record<string, string> | null;
  /** Pictures added to this message, by slot ("main", or "img-1"... for
   * an email's [IMAGE] lines). See lib/images.ts. */
  images?: Record<string, StepImage>;
}

/**
 * Creates a new campaign document for the signed-in user, plus one step
 * document per scheduled step. Called from the Campaign Builder when
 * "Generate campaign copy" runs for the first time on a given session.
 */
export async function createCampaign(
  uid: string,
  title: string,
  templateId: string,
  offer: OfferContext,
  eventDate: Date,
  steps: CampaignStepDoc[]
): Promise<string> {
  const campaignRef = await addDoc(collection(db, "campaigns"), {
    uid,
    title,
    templateId,
    offer,
    eventDate: eventDate.toISOString(),
    createdAt: serverTimestamp(),
  });

  await Promise.all(
    steps.map((step) =>
      setDoc(doc(db, "campaigns", campaignRef.id, "steps", step.templateStepId), step)
    )
  );

  return campaignRef.id;
}

/**
 * Updates just the generated copy for one step. Used after a variation
 * request from the AskCampeosBar, so we don't rewrite the whole campaign
 * for a one-field change.
 */
export async function saveStepCopy(
  campaignId: string,
  templateStepId: string,
  copy: Record<string, string>
): Promise<void> {
  await setDoc(
    doc(db, "campaigns", campaignId, "steps", templateStepId),
    { copy },
    { merge: true }
  );
}

/** Saves the campaign's own copy of the offer after it's edited in setup. */
export async function saveCampaignOffer(campaignId: string, offer: OfferContext): Promise<void> {
  const clean = Object.fromEntries(Object.entries(offer).filter(([, v]) => v !== undefined));
  await updateDoc(doc(db, "campaigns", campaignId), { offer: clean, title: offer.name || "Untitled campaign" });
}

/** Saves which messages and channels are switched off for a campaign. */
export async function saveCampaignSkips(
  campaignId: string,
  skippedSteps: string[],
  skippedChannels: string[]
): Promise<void> {
  await updateDoc(doc(db, "campaigns", campaignId), { skippedSteps, skippedChannels });
}

/** Lists campaigns owned by this user, most recently created first. */
export async function listCampaigns(uid: string): Promise<Campaign[]> {
  const q = query(collection(db, "campaigns"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign);
  campaigns.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return campaigns;
}

/**
 * Maps each templateId to the user's most recently created campaign
 * built from it. Used by the /campaigns gallery so clicking a template
 * card continues an existing campaign instead of always starting a new
 * one — one Firestore read for every card instead of one per card.
 */
export function latestCampaignByTemplate(campaigns: Campaign[]): Record<string, Campaign> {
  const byTemplate: Record<string, Campaign> = {};
  // campaigns is already sorted most-recent-first, so the first one seen
  // per templateId is the one to keep.
  for (const c of campaigns) {
    if (!byTemplate[c.templateId]) byTemplate[c.templateId] = c;
  }
  return byTemplate;
}

/**
 * Permanently deletes a campaign and every one of its step documents.
 * Firestore doesn't cascade-delete subcollections when you delete a
 * parent doc, so the steps have to be removed explicitly — batched into
 * one atomic write instead of one delete call per step. There's no
 * confirmation here; the caller (the campaigns list UI) is responsible
 * for confirming with the user before calling this, since it can't be
 * undone.
 */
export async function deleteCampaign(campaignId: string, uid?: string): Promise<void> {
  // Loaded only here, so pages that never delete don't carry the
  // Storage SDK.
  if (uid) await import("./stepImages").then((m) => m.deleteCampaignImages(uid, campaignId));
  const stepsSnap = await getDocs(collection(db, "campaigns", campaignId, "steps"));
  const batch = writeBatch(db);
  for (const stepDoc of stepsSnap.docs) {
    batch.delete(stepDoc.ref);
  }
  batch.delete(doc(db, "campaigns", campaignId));
  await batch.commit();
}

/** Loads one campaign and all its steps. */
export async function getCampaignWithSteps(
  campaignId: string
): Promise<{ campaign: Campaign; steps: CampaignStepDoc[] } | null> {
  const campaignSnap = await getDoc(doc(db, "campaigns", campaignId));
  if (!campaignSnap.exists()) return null;

  const stepsSnap = await getDocs(collection(db, "campaigns", campaignId, "steps"));
  const steps = stepsSnap.docs.map((d) => d.data() as CampaignStepDoc);

  return {
    campaign: { id: campaignSnap.id, ...campaignSnap.data() } as Campaign,
    steps,
  };
}
