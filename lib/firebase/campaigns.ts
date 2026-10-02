import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./client";
import { OfferContext } from "../ai/prompts";
import { StepTemplate } from "../templates/types";

export interface Campaign {
  id: string;
  uid: string;
  title: string;
  templateId: string;
  offer: OfferContext;
  eventDate: string;
  createdAt?: Timestamp;
}

export interface CampaignStepDoc {
  templateStepId: string;
  channel: StepTemplate["channel"];
  title: string;
  purpose: string;
  angle: string;
  fields: StepTemplate["fields"];
  scheduledAt: string;
  copy: Record<string, string> | null;
}

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

export async function listCampaigns(uid: string): Promise<Campaign[]> {
  const q = query(collection(db, "campaigns"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Campaign);
  campaigns.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
  return campaigns;
}

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
