import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSprint, clock, defaultChannels, doneCount, newSession, parseSession, publishedCount,
  resultsFrom, streakDays, parseAnySession, sessionHasWork, isStale, repsOf, totalReps, subtasksFor, taskComplete, tasksCompleted, workPercent, sprintVerdict, remainingMs,
} from "../lib/daily/sprint";

const plan = buildSprint({ focus: "balanced", intensity: "steady" });

test("a balanced steady hour adds up to 60 minutes with sensible targets", () => {
  assert.equal(plan.tasks.reduce((n, t) => n + t.minutes, 0), 60);
  const byKind = Object.fromEntries(plan.tasks.map((t) => [t.kind, t.target]));
  assert.deepEqual(byKind, { content: 3, prospect: 15, engage: 10, followup: 5 });
});

test("gentle is lighter and push is heavier", () => {
  const g = buildSprint({ focus: "balanced", intensity: "gentle" });
  const p = buildSprint({ focus: "balanced", intensity: "push" });
  const sum = (x: typeof plan) => x.tasks.reduce((n, t) => n + t.target, 0);
  assert.ok(sum(g) < sum(plan) && sum(plan) < sum(p));
  assert.ok(g.tasks.every((t) => t.target >= 1));
});

test("each focus still totals the hour", () => {
  for (const f of ["balanced", "customers", "attention"] as const) {
    assert.equal(buildSprint({ focus: f, intensity: "steady" }).tasks.reduce((n, t) => n + t.minutes, 0), 60);
  }
});

test("content steps follow the chosen channels", () => {
  const steps = subtasksFor("content", ["linkedin", "reddit"]);
  assert.ok(steps.some((s) => s.id === "linkedin:publish"));
  assert.ok(steps.some((s) => s.id === "reddit:publish"));
  assert.ok(!steps.some((s) => s.id.startsWith("x:")));
});

test("channels: the ones they use come first, capped by the target", () => {
  assert.deepEqual(defaultChannels(["reddit"], 2), ["reddit", "linkedin"]);
  assert.equal(defaultChannels([], 1).length, 1);
  assert.equal(defaultChannels([], 9).length, 3);
});

test("only a published post counts, not a drafted one", () => {
  let s = newSession(plan, 0, ["linkedin", "x"], "2026-10-27");
  s = { ...s, steps: { "linkedin:write": true, "x:write": true } };
  assert.equal(publishedCount(s), 0);
  s = { ...s, steps: { ...s.steps, "linkedin:publish": true } };
  assert.equal(publishedCount(s), 1);
});

test("progress follows work done, not time", () => {
  let s = newSession(plan, 0, ["linkedin", "x", "reddit"], "2026-10-27");
  assert.equal(workPercent(s), 0);
  s = { ...s, counts: { prospect: 15 }, steps: { "linkedin:publish": true } };
  const content = plan.tasks[0];
  const prospect = plan.tasks[1];
  assert.equal(doneCount(s, content), 1);
  assert.ok(taskComplete(s, prospect));
  assert.equal(tasksCompleted(s), 1);
  assert.equal(workPercent(s), Math.round(((1 + 15) / 33) * 100));
});

test("clock and remaining time", () => {
  assert.equal(clock(52 * 60_000 + 18_000), "52:18");
  assert.equal(clock(0), "0:00");
  assert.equal(clock(3600_000), "1:00:00");
  assert.equal(remainingMs(1000, 5000), 0);
});

test("old or broken saved sessions are ignored", () => {
  const s = newSession(plan, 1_000_000, ["linkedin"], "2026-10-27");
  assert.ok(parseSession(JSON.stringify(s), "2026-10-27", 1_000_500));
  assert.equal(parseSession(JSON.stringify(s), "2026-10-28", 1_000_500), null);
  assert.equal(parseSession("not json", "2026-10-27", 0), null);
  assert.equal(parseSession(null, "2026-10-27", 0), null);
  assert.equal(parseSession(JSON.stringify(s), "2026-10-27", s.endsAt + 7 * 3600_000), null);
});

test("results come from what was done, with replies and sales typed in", () => {
  let s = newSession(plan, 0, ["linkedin"], "2026-10-27");
  s = { ...s, counts: { prospect: 12, engage: 4, followup: 3 }, steps: { "linkedin:publish": true } };
  assert.deepEqual(resultsFrom(s, { replies: 2, sales: -1 }), { published: 1, contacted: 12, comments: 4, followUps: 3, replies: 2, sales: 0 });
});

test("the verdict is kind about a light day", () => {
  const s = newSession(plan, 0, ["linkedin"], "2026-10-27");
  assert.match(sprintVerdict(s).title, /Nothing logged/);
  assert.match(sprintVerdict({ ...s, counts: { prospect: 3 } }).title, /showed up/);
});

test("streak counts days in a row and survives until the day ends", () => {
  assert.equal(streakDays(["2026-10-27", "2026-10-26", "2026-10-25", "2026-10-22"], "2026-10-27"), 3);
  assert.equal(streakDays(["2026-10-26", "2026-10-25"], "2026-10-27"), 2);
  assert.equal(streakDays(["2026-10-24"], "2026-10-27"), 0);
  assert.equal(streakDays([], "2026-10-27"), 0);
});

test("yesterday's sprint is stale, today's is not", () => {
  const s = newSession(plan, 1_000_000, ["linkedin"], "2026-10-27");
  assert.equal(isStale(s, "2026-10-28", 1_000_500), true);
  assert.equal(isStale(s, "2026-10-27", 1_000_500), false);
  assert.equal(isStale(s, "2026-10-27", s.endsAt + 7 * 3600_000), true);
});

test("only a sprint with real work in it is worth keeping", () => {
  const s = newSession(plan, 0, ["linkedin"], "2026-10-27");
  assert.equal(sessionHasWork(s), false);
  assert.equal(sessionHasWork({ ...s, steps: { "linkedin:write": true } }), false);
  assert.equal(sessionHasWork({ ...s, counts: { prospect: 2 } }), true);
  assert.equal(sessionHasWork({ ...s, steps: { "linkedin:publish": true } }), true);
});

test("any-day parsing keeps old sessions so their work can be counted", () => {
  const s = newSession(plan, 0, ["linkedin"], "2026-10-20");
  assert.ok(parseAnySession(JSON.stringify(s)));
  assert.equal(parseAnySession("nope"), null);
});

test("the all-time total adds up every action and never resets", () => {
  const r = (n: number) => ({ results: { published: n, contacted: n, comments: n, followUps: n, replies: 9, sales: 9 } });
  assert.equal(repsOf(r(2).results), 8);
  assert.equal(totalReps([r(1), r(2), r(3)]), 24);
  assert.equal(totalReps([]), 0);
});
