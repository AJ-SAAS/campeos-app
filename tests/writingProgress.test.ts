import { test } from "node:test";
import assert from "node:assert/strict";
import { writingPercent, writingTarget } from "../lib/builder/writingProgress";

test("locked posts are not part of what gets written", () => {
  assert.equal(writingTarget(38, 30), 8);
  assert.equal(writingTarget(5, 9), 0);
});

test("the percent is a whole number from 0 to 100", () => {
  assert.equal(writingPercent(0, 38), 0);
  assert.equal(writingPercent(19, 38), 50);
  assert.equal(writingPercent(1, 3), 33);
  assert.equal(writingPercent(40, 38), 100);
  assert.equal(writingPercent(3, 0), 0);
});
