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

const NEW = ["flash-sale-48h", "cart-close", "cash-injection", "black-friday", "cyber-monday", "holiday-sale", "social-blast-30", "app-launch-30", "mini-launch", "product-launch", "win-back", "book-a-call", "hand-raiser", "lead-magnet", "giveaway", "ebook-low-ticket", "xmas-holidays", "valentines-day", "daily-deals", "physical-book-shipping", "social-proof", "newsletter", "mvp-launch", "post-engagement", "branding", "audience-revival"];
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
      assert.ok(s.offsetHours >= -720 && s.offsetHours <= (t.closeOffsetHours !== undefined ? t.closeOffsetHours + 48 : 17 * 24), `${s.id} is inside the campaign`);
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

test("win-back starts with a no-pitch check-in and ends with stay or go", () => {
  const t = templates["win-back"];
  const steps = buildTimeline(t, { event: new Date(2026, 10, 9, 9, 0) });
  assert.equal(steps[0].templateStepId, "email-checkin");
  assert.equal(steps[steps.length - 1].templateStepId, "email-sunset");
  assert.ok(getPlay("winback-checkin")!.avoid!.join(" ").includes("No offer"));
});

test("book a call and hand-raiser steps use call and ask plays, and hand-raiser keeps its follow-up for repliers", () => {
  assert.ok(templates["book-a-call"].steps.some((s) => s.playId === "call-what-happens"));
  assert.ok(templates["book-a-call"].steps.some((s) => s.playId === "call-fit"));
  const next = templates["hand-raiser"].steps.find((s) => s.playId === "handraiser-next")!;
  assert.ok(next.purpose.includes("only to the people who replied"));
});

test("giveaway never invents a winner and ends with an offer to entrants", () => {
  const t = templates.giveaway;
  assert.ok(getPlay("post-giveaway-winner")!.avoid!.join(" ").includes("[WINNER NAME]"));
  assert.ok(getPlay("post-giveaway")!.beats.join(" ").includes("[OFFICIAL RULES LINK]"));
  const steps = buildTimeline(t, { event: new Date(2026, 10, 9, 9, 0) });
  assert.equal(steps[steps.length - 1].templateStepId, "email-offer");
  const win = steps.findIndex((s) => s.templateStepId === "post-winner");
  assert.ok(win > steps.findIndex((s) => s.templateStepId === "email-final"));
});

test("lead magnet delivers before it pitches, and has no fake deadline", () => {
  const t = templates["lead-magnet"];
  assert.equal(t.closeOffsetHours, undefined);
  const idx = (id: string) => t.steps.find((s) => s.id === id)!.offsetHours;
  assert.ok(idx("email-delivery") <= idx("email-first-win") && idx("email-first-win") < idx("email-bridge"));
  assert.ok(getPlay("magnet-delivery")!.avoid!.join(" ").includes("No pitch"));
});

test("ebook: sample and proof come before any deadline, and the buyers-only email says so", () => {
  const t = templates["ebook-low-ticket"];
  const next = t.steps.find((s) => s.playId === "ebook-next-step")!;
  assert.ok(next.purpose.includes("only to the people who bought"));
  const idx = (id: string) => t.steps.find((s) => s.id === id)!.offsetHours;
  assert.ok(idx("email-sample") < idx("email-countdown"));
});

test("daily deals: a different deal every day for seven days, never inventing products", () => {
  const t = templates["daily-deals"];
  const emails = t.steps.filter((s) => s.id.startsWith("email-deal-"));
  assert.equal(emails.length, 7);
  assert.equal(new Set(emails.map((s) => s.angle)).size, 7, "each day has its own angle");
  assert.ok(emails.every((s) => s.purpose.includes("[TODAY'S DEAL]")));
  assert.ok(getPlay("post-deal-of-day")!.avoid!.join(" ").includes("Never invent a product"));
  assert.ok(getPlay("deals-recap")!.avoid!.join(" ").includes("Never list a deal that was not sent"));
});

test("xmas ends with a no-pitch thank you; valentine's has three angles and an order-by date", () => {
  const x = templates["xmas-holidays"];
  const last = x.steps.reduce((a, b) => (b.offsetHours > a.offsetHours ? b : a));
  assert.ok(last.playId === "holiday-thanks" || last.playId === "post-holiday-thanks");
  assert.ok(getPlay("holiday-thanks")!.avoid!.join(" ").includes("No offer"));
  const v = templates["valentines-day"];
  assert.ok(v.steps.some((s) => s.playId === "love-angles"));
  assert.ok(v.steps.some((s) => s.playId === "order-by"));
});

test("physical book: says shipping is the only cost and never hides a catch", () => {
  const t = templates["physical-book-shipping"];
  assert.ok(t.steps.some((s) => s.playId === "book-why-free"));
  assert.ok(t.steps.some((s) => s.playId === "book-shipping"));
  assert.ok(getPlay("book-announce")!.avoid!.join(" ").includes("Never call it fully free"));
  assert.ok(getPlay("book-why-free")!.avoid!.join(" ").includes("Never hide a later charge"));
});

test("social proof: asks for proof first, never invents it, ends with an invitation", () => {
  const t = templates["social-proof"];
  const first = t.steps.reduce((a, b) => (b.offsetHours < a.offsetHours ? b : a));
  assert.equal(first.playId, "email-review-ask");
  for (const id of ["email-proof-roundup", "post-proof-quote", "proof-numbers", "ad-proof"]) {
    assert.ok(getPlay(id)!.avoid!.join(" ").includes("Never invent"), id);
  }
  const last = t.steps.filter((s) => s.playId === "proof-next-step");
  assert.equal(last.length, 1);
});

test("newsletter: welcome first, weekly issues a week apart", () => {
  const t = templates.newsletter;
  const first = t.steps.reduce((a, b) => (b.offsetHours < a.offsetHours ? b : a));
  assert.equal(first.playId, "newsletter-welcome");
  const issues = t.steps.filter((s) => s.id.startsWith("email-issue-")).map((s) => s.offsetHours);
  assert.deepEqual(issues, [0, 168, 336]);
});

test("mvp launch: honest about what is built, asks for feedback, shows what changed", () => {
  const t = templates["mvp-launch"];
  for (const id of ["email-beta-invite", "mvp-founder-note", "mvp-feedback-ask", "mvp-you-said"]) {
    assert.ok(t.steps.some((s) => s.playId === id), id);
  }
  assert.ok(getPlay("mvp-founder-note")!.avoid!.join(" ").includes("not built yet"));
  assert.ok(getPlay("mvp-you-said")!.avoid!.join(" ").includes("not made"));
});

test("post engagement: replies first, delivery before the bridge, never invents reach", () => {
  const t = templates["post-engagement"];
  const first = t.steps.reduce((a, b) => (b.offsetHours < a.offsetHours ? b : a));
  assert.equal(first.playId, "post-reply-link");
  const at = (p: string) => t.steps.find((s) => s.playId === p)!.offsetHours;
  assert.ok(at("magnet-delivery") < at("magnet-bridge"));
  assert.ok(getPlay("post-viral-followup")!.avoid!.join(" ").includes("Never invent reach"));
});

test("branding: no hard sell, no competitor attacks, spans two weeks", () => {
  const t = templates.branding;
  assert.ok(!t.steps.some((s) => s.playId === "sale-announce" || s.playId === "countdown"));
  assert.ok(getPlay("post-brand-difference")!.avoid!.join(" ").includes("competitor"));
  const max = Math.max(...t.steps.map((s) => s.offsetHours));
  assert.ok(max >= 11 * 24 && max <= 14 * 24);
});

test("audience revival: social first, offer only after trust, clean exit last, preflight set", () => {
  const t = templates["audience-revival"];
  assert.ok(t.preflight && t.preflight.items.length >= 5);
  const first = t.steps.reduce((a, b) => (b.offsetHours < a.offsetHours ? b : a));
  assert.equal(first.channel, "social");
  const at = (p: string) => t.steps.find((s) => s.playId === p)!.offsetHours;
  assert.ok(at("revival-hello") < at("revival-remind"));
  assert.ok(at("revival-hello") < at("revival-offer"));
  assert.ok(at("revival-poll") < at("revival-offer"));
  const last = t.steps.reduce((a, b) => (b.offsetHours > a.offsetHours ? b : a));
  assert.equal(last.playId, "revival-stay-or-go");
  assert.ok(getPlay("revival-hello")!.avoid!.join(" ").includes("No sales pitch"));
  assert.ok(getPlay("revival-offer")!.avoid!.join(" ").includes("Send only to people who clicked"));
});
