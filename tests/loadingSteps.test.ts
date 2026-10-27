import { test } from "node:test";
import assert from "node:assert/strict";
import { LOADING_STEPS, nextLoadingStep } from "../lib/loadingSteps";

test("the loading lines go in order and stop on the last one", () => {
  assert.equal(LOADING_STEPS.length, 3);
  assert.equal(nextLoadingStep(0, 3), 1);
  assert.equal(nextLoadingStep(1, 3), 2);
  assert.equal(nextLoadingStep(2, 3), 2);
});

test("a single line never moves", () => {
  assert.equal(nextLoadingStep(0, 1), 0);
  assert.equal(nextLoadingStep(0, 0), 0);
});
