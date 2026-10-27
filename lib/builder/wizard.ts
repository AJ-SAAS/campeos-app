// The new-campaign questions (components/builder/CampaignWizard.tsx): three
// short screens, then a "setting up" moment, then the builder. Everything
// here is plain logic so it can be tested without a browser.

import type { OfferContext } from "@/lib/ai/prompts";
import type { SetupStage } from "@/lib/onboarding/setupSteps";
import { daysUntil, joinPrice, launchDateToEvent, splitPrice, type BillingId } from "@/lib/onboarding/answers";

export const WIZARD_STEPS = [
  { id: "offer", label: "Offer" },
  { id: "details", label: "Details" },
  { id: "golive", label: "Go live" },
] as const;

export interface WizardAnswers {
  /** Which saved offer was picked. null = a new offer typed in here. */
  savedOfferId: string | null;
  name: string;
  currency: string;
  /** The number only ("997"). The currency is added when it's saved. */
  price: string;
  billing: BillingId | null;
  audience: string;
  whatTheyGet: string;
  fromName: string;
  tone: string;
  readingLevel: string;
  /** yyyy-mm-dd */
  goLive: string;
}

export const hasAmount = (price: string): boolean => /\d/.test(price);

/** Can the person move on from this screen? */
export function wizardCanContinue(step: number, a: WizardAnswers): boolean {
  if (step === 0) {
    if (a.savedOfferId) return true;
    return a.name.trim().length > 0 && (!hasAmount(a.price) || a.billing !== null);
  }
  if (step === 1) return a.audience.trim().length > 0 && a.whatTheyGet.trim().length > 0;
  if (step === 2) return !!launchDateToEvent(a.goLive) && daysUntil(a.goLive) >= 0;
  return true;
}

/** Says what is missing, for the hint under a disabled button. */
export function wizardHint(step: number, a: WizardAnswers): string {
  if (step === 0) {
    if (!a.name.trim()) return "Give your offer a name to continue.";
    if (hasAmount(a.price) && a.billing === null) return "Pick how they pay to continue.";
  }
  if (step === 1) {
    if (!a.audience.trim() && !a.whatTheyGet.trim()) return "Fill in who it's for and what they get to continue.";
    if (!a.audience.trim()) return "Fill in who it's for to continue.";
    if (!a.whatTheyGet.trim()) return "Fill in what they get to continue.";
  }
  if (step === 2) return "Pick a go-live date, today or later.";
  return "";
}

/** The offer this campaign will be written from. */
export function offerFromAnswers(a: WizardAnswers): OfferContext {
  const paid = hasAmount(a.price);
  return {
    name: a.name.trim(),
    price: joinPrice(a.currency, a.price),
    billing: paid && a.billing ? a.billing : undefined,
    audience: a.audience.trim(),
    whatTheyGet: a.whatTheyGet.trim(),
    tone: a.tone || "Friendly",
    readingLevel: a.readingLevel || "5th grade",
    fromName: a.fromName.trim() || undefined,
  };
}

/** Fills the answers from a saved offer. The date is left alone. */
export function applySavedOffer(a: WizardAnswers, offer: OfferContext & { id: string }): WizardAnswers {
  const split = splitPrice(offer.price ?? "");
  const billing = (["once", "monthly", "yearly"].includes(offer.billing ?? "") ? offer.billing : null) as BillingId | null;
  return {
    ...a,
    savedOfferId: offer.id,
    name: offer.name ?? "",
    currency: split.currency ?? a.currency,
    price: split.amount,
    billing,
    audience: offer.audience ?? "",
    whatTheyGet: offer.whatTheyGet ?? "",
    fromName: offer.fromName ?? a.fromName,
    tone: offer.tone || a.tone,
    readingLevel: offer.readingLevel || a.readingLevel,
  };
}

/** How far the gradient line has filled: 0 on the first screen, 1 on the last (or when finished). */
export function wizardProgress(step: number, finished = false, count = WIZARD_STEPS.length): number {
  if (finished || count < 2) return 1;
  return Math.min(1, Math.max(0, step / (count - 1)));
}

/** "Wed 4 Nov, in 8 days" for the date they picked. */
export function goLiveSummary(value: string, from: Date = new Date(), locale = "en-GB"): string {
  const d = launchDateToEvent(value);
  if (!d) return "";
  const days = daysUntil(value, from);
  const when = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const away = days === 0 ? "today" : days === 1 ? "tomorrow" : days > 1 ? `in ${days} days` : "";
  return away ? `${when}, ${away}` : when;
}

/** The lines on the "setting up" screen. Each one matches real work in finish(). */
export function campaignStages(opts: { templateName: string; offerName: string; newOffer: boolean }): SetupStage[] {
  const offer = opts.offerName.trim();
  const template = opts.templateName.trim() || "campaign";
  return [
    opts.newOffer
      ? { id: "offer", label: "Saving your offer", doneLabel: "Offer saved" }
      : { id: "offer", label: offer ? `Loading ${offer}` : "Loading your offer", doneLabel: "Offer loaded" },
    { id: "date", label: "Setting your go-live date", doneLabel: "Go-live date set" },
    { id: "schedule", label: `Laying out your ${template} schedule`, doneLabel: "Schedule laid out" },
    { id: "ready", label: "Getting your campaign ready", doneLabel: "Campaign ready" },
  ];
}
