import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_STAGE_MS, remainingDwell, setupStages } from "../lib/onboarding/setupSteps";

test("the checklist skips testimonials when none were found", () => {
  const ids = setupStages({ testimonialCount: 0 }).map((s) => s.id);
  assert.deepEqual(ids, ["profile", "offer", "plan", "home"]);
});

test("the checklist names the offer and counts testimonials", () => {
  const s = setupStages({ testimonialCount: 3, offerName: " Spring Webinar " });
  assert.equal(s[1].label, "Learning about Spring Webinar");
  assert.equal(s[2].id, "insights");
  assert.equal(s[2].label, "Keeping 3 testimonials from your page");
  assert.equal(setupStages({ testimonialCount: 1 })[2].doneLabel, "1 testimonial kept");
});

test("a stage waits only for what is left of its minimum time", () => {
  assert.equal(remainingDwell(1000, 1100), MIN_STAGE_MS - 100);
  assert.equal(remainingDwell(1000, 5000), 0);
});
