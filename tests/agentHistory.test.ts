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
