import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_HISTORY_LIMIT, recentForModel, splitForPrune } from "../lib/agentHistory";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("only the latest messages go to the AI", () => {
  const sent = recentForModel(nums(30));
  assert.equal(sent.length, MODEL_HISTORY_LIMIT);
  assert.equal(sent[sent.length - 1], 30);
  assert.deepEqual(recentForModel([1, 2]), [1, 2]);
});

test("pruning drops the oldest and keeps the newest", () => {
  const { keep, drop } = splitForPrune(nums(7), 5);
  assert.deepEqual(drop, [1, 2]);
  assert.deepEqual(keep, [3, 4, 5, 6, 7]);
  assert.deepEqual(splitForPrune(nums(3), 5), { keep: [1, 2, 3], drop: [] });
});

import { SESSION_GAP_MS, sessionLabel, startsNewSession } from "../lib/agentHistory";

test("a long pause or a new day starts a new session", () => {
  const t = new Date(2026, 9, 27, 10, 0).getTime();
  assert.equal(startsNewSession(t, t + 60_000), false);
  assert.equal(startsNewSession(t, t + SESSION_GAP_MS), true);
  assert.equal(startsNewSession(new Date(2026, 9, 26, 23, 50).getTime(), new Date(2026, 9, 27, 0, 5).getTime()), true);
  assert.equal(startsNewSession(undefined, t), false);
});

test("session labels say Today, Yesterday, or the date", () => {
  const now = new Date(2026, 9, 27, 13, 0).getTime();
  assert.equal(sessionLabel(new Date(2026, 9, 27, 9, 0).getTime(), now), "Today");
  assert.equal(sessionLabel(new Date(2026, 9, 26, 9, 0).getTime(), now), "Yesterday");
  assert.match(sessionLabel(new Date(2026, 9, 20, 9, 0).getTime(), now), /20/);
});
