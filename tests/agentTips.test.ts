import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, shouldShowTips } from "../lib/agentTips";

test("the day key uses the local date with zero padding", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("suggestions show until used, then come back the next day", () => {
  const today = new Date(2026, 9, 27, 14, 0);
  assert.equal(shouldShowTips(null, today), true);
  assert.equal(shouldShowTips("2026-10-26", today), true);
  assert.equal(shouldShowTips("2026-10-27", today), false);
});
