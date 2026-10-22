import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, keyDatesFor } from "../lib/templates";
import { catalog } from "../lib/templates/catalog";
import { getPlay } from "../lib/frameworks/plays";
import { buildTimeline } from "../lib/engine/buildTimeline";
import { buildStepCopyPrompt, type OfferContext } from "../lib/ai/prompts";
import { templateChannelsFor } from "../lib/onboarding/answers";
import { finishCopy, STANDARD_EULA_URL } from "../lib/ai/generateStepCopy";
import { lintCopy } from "../lib/ai/quality";

const NEW = ["flash-sale-48h", "cart-close", "cash-injection", "black-friday", "cyber-monday", "holiday-sale", "social-blast-30", "app-launch-30", "mini-launch", "product-launch"];
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
      assert.ok(s.offsetHours >= -720 && s.offsetHours <= (t.closeOffsetHours ?? 17 * 24), `${s.id} is inside the campaign`);
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

test("30 day blast: 30 days, weekly phases, mostly posts, ends on the big day", () => {
  const t = templates["social-blast-30"];
  assert.equal(t.phases.length, 4);
  const steps = buildTimeline(t, { event: new Date(2026, 10, 27, 9, 0) });
  const days = new Set(steps.map((x) => x.scheduledAt.toDateString()));
  assert.ok(days.size >= 26, "posts almost every day");
  const span = (steps[steps.length - 1].scheduledAt.getTime() - steps[0].scheduledAt.getTime()) / 86400000;
  assert.ok(span > 28 && span < 30.5, `spans 30 days, got ${span}`);
  assert.ok(t.steps.filter((s) => s.channel === "social").length >= 18);
});

test("app launch starts with the App Store listing and launches around day 14", () => {
  const t = templates["app-launch-30"];
  const steps = buildTimeline(t, { event: new Date(2026, 10, 27, 9, 0) });
  assert.equal(steps[0].channel, "store");
  assert.deepEqual(steps[0].fields.map((f) => f.key), ["appName", "subtitle", "promo", "keywords", "description"]);
  const span = (steps[steps.length - 1].scheduledAt.getTime() - steps[0].scheduledAt.getTime()) / 86400000;
  assert.ok(span > 28 && span < 31, `spans about 30 days, got ${span}`);
  const launch = steps.findIndex((x) => x.templateStepId === "email-live");
  assert.ok(launch > 10 && launch < steps.length - 10);
});

test("App Store descriptions always carry the standard terms link, once", () => {
  const out = finishCopy({ channel: "store" }, { description: "A calm way to plan your week." });
  assert.ok(out.description.includes(STANDARD_EULA_URL));
  const again = finishCopy({ channel: "store" }, out);
  assert.equal(again.description.split(STANDARD_EULA_URL).length - 1, 1);
  const mail = finishCopy({ channel: "email" }, { body: "hi" });
  assert.equal(mail.body, "hi");
});

test("store listing limits are checked", () => {
  const long = { appName: "A".repeat(31), subtitle: "ok", promo: "ok", keywords: "one, two", description: "ok" };
  const problems = lintCopy(long, { channel: "store" });
  assert.ok(problems.some((p) => p.includes("appName")));
  assert.ok(problems.some((p) => p.includes("Keywords")));
});

test("the store listing is always kept, even with only email and sms picked", () => {
  assert.ok(templateChannelsFor(["email", "sms"])!.has("store"));
});

test("product launch: three free videos before the cart opens, then a hard close", () => {
  const t = templates["product-launch"];
  const steps = buildTimeline(t, { event: new Date(2026, 10, 2, 9, 0) });
  const videos = steps.filter((s) => ["video-1", "video-2", "video-3"].includes(s.templateStepId));
  assert.equal(videos.length, 3);
  const open = new Date(2026, 10, 2, 9, 0).getTime();
  assert.ok(videos.every((v) => v.scheduledAt.getTime() < open), "all three come before the cart opens");
  assert.ok(videos[0].scheduledAt < videos[1].scheduledAt && videos[1].scheduledAt < videos[2].scheduledAt);
  const drops = t.steps.filter((s) => s.playId === "email-content-drop");
  assert.equal(drops.length, 3);
  assert.ok(drops.every((s) => s.phaseId === "content" && s.channel === "email"));
  const last = steps[steps.length - 1].scheduledAt.getTime() - open;
  assert.ok(last <= 135 * 3600_000, "nothing after the close");
});

test("mini-launch runs three days after a one-day tease", () => {
  const t = templates["mini-launch"];
  const open = new Date(2026, 10, 2, 9, 0);
  const steps = buildTimeline(t, { event: open });
  assert.ok(steps[0].scheduledAt < open);
  assert.ok(steps[steps.length - 1].scheduledAt.getTime() - open.getTime() <= 63 * 3600_000);
  assert.equal(new Set(steps.map((s) => s.scheduledAt.toDateString())).size, 4);
});
