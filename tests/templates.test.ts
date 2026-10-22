import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, keyDatesFor } from "../lib/templates";
import { catalog } from "../lib/templates/catalog";
import { getPlay } from "../lib/frameworks/plays";
import { buildTimeline } from "../lib/engine/buildTimeline";
import { buildStepCopyPrompt, type OfferContext } from "../lib/ai/prompts";
import { templateChannelsFor } from "../lib/onboarding/answers";

const NEW = ["flash-sale-48h", "cart-close", "cash-injection", "black-friday", "cyber-monday", "holiday-sale"];
const offer: OfferContext = { name: "Candle Club", price: "$40", audience: "Candle lovers", whatTheyGet: "A box of 3 candles", tone: "Friendly" };

for (const id of NEW) {
  test(`${id}: every step is well formed`, () => {
    const t = templates[id];
    assert.ok(t, "registered");
    assert.equal(catalog.find((c) => c.id === id)?.status, "available");
    const ids = new Set<string>();
    const phases = new Set(t.phases.map((p) => p.id));
    for (const s of t.steps) {
      assert.ok(!ids.has(s.id), `duplicate step id ${s.id}`);
      ids.add(s.id);
      assert.ok(phases.has(s.phaseId), `${s.id} has a real phase`);
      assert.ok(s.playId && getPlay(s.playId), `${s.id} has a real play`);
      assert.ok(s.goals.length >= 2 || s.channel === "sms", `${s.id} has goals`);
      assert.ok(s.fields.length > 0);
      assert.ok(s.offsetHours >= -360 && s.offsetHours <= (t.closeOffsetHours ?? 0), `${s.id} is inside the campaign`);
      assert.ok(!/—|–/.test(JSON.stringify(s)), `${s.id} has no dashes used as punctuation`);
    }
    for (const p of t.phases) assert.ok(t.steps.some((s) => s.phaseId === p.id), `phase ${p.id} is used`);
  });
}

test("flash sale timeline runs from the day before to hour 48", () => {
  const live = new Date(2026, 10, 27, 9, 0);
  const steps = buildTimeline(templates["flash-sale-48h"], { event: live });
  assert.equal(steps.length, 13);
  assert.ok(steps[0].scheduledAt < live);
  assert.ok(steps[steps.length - 1].scheduledAt.getTime() - live.getTime() <= 48 * 3600_000);
});

test("key dates carry the end time for sales and nothing extra for webinars", () => {
  const live = new Date(2026, 10, 27, 9, 0);
  assert.ok(keyDatesFor(templates["cart-close"], live).includes("The offer ends:"));
  assert.ok(!keyDatesFor(templates.webinar, live).includes("The offer ends"));
});

test("a video step asks for 3 titles, a summary and bullets, not a script", () => {
  const t = templates["cart-close"];
  const s = buildTimeline(t, { event: new Date(2026, 10, 27, 9, 0) }).find((x) => x.channel === "video")!;
  assert.deepEqual(s.fields.map((f) => f.key), ["titles", "summary", "bullets"]);
  const prompt = buildStepCopyPrompt(offer, { ...s, play: getPlay("video-pitch"), scheduledAt: "x", eventAt: keyDatesFor(t, new Date(2026, 10, 27, 9, 0)) } as never, { winningCopy: [], callThemes: [] } as never);
  assert.ok(prompt.includes("exactly 3 title ideas"));
  assert.ok(prompt.includes("Not a word-for-word script"));
});

test("video is allowed whenever someone posts on a social platform", () => {
  assert.ok(templateChannelsFor(["email", "instagram"])!.has("video"));
  assert.ok(!templateChannelsFor(["email", "sms"])!.has("video"));
});

test("black friday is your 24 touch grid: 16 days, 3 phases, video on both video days", () => {
  const t = templates["black-friday"];
  assert.equal(t.steps.length, 24);
  assert.equal(t.phases.length, 3);
  assert.equal(t.steps.filter((s) => s.channel === "video").length, 3);
  const q = "What is the Black Friday offer, and is it worth waiting for?";
  const loop = t.steps.filter((s) => s.purpose.includes(q));
  assert.equal(loop.length, 3, "story video, story email and the answer email share one question");
  const steps = buildTimeline(t, { event: new Date(2026, 10, 27, 9, 0) });
  assert.equal(steps[0].scheduledAt.getDate(), 12);
  assert.equal(steps[steps.length - 1].scheduledAt.getDate(), 1);
});
