import { test } from "node:test";
import assert from "node:assert/strict";
import { launchDateInDays } from "../lib/onboarding/answers";
import {
  WizardAnswers,
  applySavedOffer,
  campaignStages,
  goLiveSummary,
  offerFromAnswers,
  wizardCanContinue,
  wizardHint,
  wizardProgress,
} from "../lib/builder/wizard";

const blank = (extra: Partial<WizardAnswers> = {}): WizardAnswers => ({
  savedOfferId: null,
  name: "",
  currency: "$",
  price: "",
  billing: null,
  audience: "",
  whatTheyGet: "",
  fromName: "",
  tone: "Friendly",
  readingLevel: "5th grade",
  goLive: "",
  ...extra,
});

test("screen 1 needs a name, and a billing choice once there is a price", () => {
  assert.equal(wizardCanContinue(0, blank()), false);
  assert.equal(wizardCanContinue(0, blank({ name: "Yoga" })), true);
  assert.equal(wizardCanContinue(0, blank({ name: "Yoga", price: "97" })), false);
  assert.equal(wizardCanContinue(0, blank({ name: "Yoga", price: "97", billing: "once" })), true);
  assert.equal(wizardHint(0, blank({ name: "Yoga", price: "97" })), "Pick how they pay to continue.");
});

test("a saved offer is enough to continue", () => {
  assert.equal(wizardCanContinue(0, blank({ savedOfferId: "abc" })), true);
});

test("screen 2 needs who it is for and what they get", () => {
  assert.equal(wizardCanContinue(1, blank({ audience: "Coaches" })), false);
  assert.equal(wizardCanContinue(1, blank({ audience: "Coaches", whatTheyGet: "A course" })), true);
  assert.match(wizardHint(1, blank()), /who it's for and what they get/);
});

test("screen 3 needs a real date, today or later", () => {
  assert.equal(wizardCanContinue(2, blank()), false);
  assert.equal(wizardCanContinue(2, blank({ goLive: launchDateInDays(8) })), true);
  assert.equal(wizardCanContinue(2, blank({ goLive: launchDateInDays(-2) })), false);
});

test("the offer puts the currency on the price and drops billing when free", () => {
  const paid = offerFromAnswers(blank({ name: " Yoga ", price: "97", currency: "£", billing: "monthly", audience: "A", whatTheyGet: "B", fromName: " Ajay " }));
  assert.equal(paid.name, "Yoga");
  assert.equal(paid.price, "£97");
  assert.equal(paid.billing, "monthly");
  assert.equal(paid.fromName, "Ajay");
  const free = offerFromAnswers(blank({ name: "Free", price: "", billing: "once" }));
  assert.equal(free.price, "");
  assert.equal(free.billing, undefined);
});

test("a saved offer fills the answers and splits the price back apart", () => {
  const a = applySavedOffer(blank({ goLive: "2026-11-30" }), {
    id: "o1", name: "Course", price: "€297", billing: "once", audience: "Founders", whatTheyGet: "Videos", tone: "Bold", readingLevel: "7th grade",
  });
  assert.equal(a.savedOfferId, "o1");
  assert.equal(a.currency, "€");
  assert.equal(a.price, "297");
  assert.equal(a.billing, "once");
  assert.equal(a.tone, "Bold");
  assert.equal(a.goLive, "2026-11-30");
});

test("the gradient line fills as the person moves forward", () => {
  assert.equal(wizardProgress(0), 0);
  assert.equal(wizardProgress(1), 0.5);
  assert.equal(wizardProgress(2), 1);
  assert.equal(wizardProgress(0, true), 1);
});

test("the go-live summary says the weekday and how far away it is", () => {
  const from = new Date(2026, 10, 1, 10, 0);
  assert.equal(goLiveSummary("2026-11-04", from), "Wed 4 Nov, in 3 days");
  assert.equal(goLiveSummary("2026-11-02", from), "Mon 2 Nov, tomorrow");
  assert.equal(goLiveSummary("nope", from), "");
});

test("the setting-up lines change for a new offer and name the campaign", () => {
  const fresh = campaignStages({ templateName: "48 Hour Flash Sale", offerName: "Yoga", newOffer: true });
  assert.equal(fresh[0].label, "Saving your offer");
  assert.equal(fresh[2].label, "Laying out your 48 Hour Flash Sale schedule");
  const saved = campaignStages({ templateName: "Webinar", offerName: "Yoga", newOffer: false });
  assert.equal(saved[0].label, "Loading Yoga");
});
