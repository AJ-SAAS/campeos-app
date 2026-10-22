import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addUnique,
  buildProfile,
  creditName,
  fillPlaceholders,
  proofLine,
  scanPlaceholders,
  similar,
  strength,
} from "../lib/insights/logic";
import { emptyLearned, Insight, Learned } from "../lib/insights/types";

const ins = (id: string, kind: Insight["kind"], learned: Partial<Learned>, extra: Partial<Insight> = {}): Insight => ({
  id,
  uid: "u1",
  offerId: "o1",
  kind,
  title: id,
  text: "",
  source: "paste",
  learned: { ...emptyLearned(), ...learned },
  createdAt: extra.createdAt ?? `2026-10-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T10:00:00Z`,
  ...extra,
});

test("similar: catches the same idea said slightly differently", () => {
  assert.ok(similar("I don't have time", "i dont have time!"));
  assert.ok(similar("posting every day and getting no clients", "Posting every day, getting no clients"));
  assert.ok(!similar("no time", "too expensive"));
  assert.ok(!similar("I don't have time for ads", "I don't have time for content"), "one different word can be a different objection");
  assert.ok(!similar("", "anything"));
});

test("addUnique: skips blanks, duplicates, and stops at the cap", () => {
  const out = addUnique(["no time"], ["No time.", "", "  ", "too expensive", "a", "b"], 3);
  assert.deepEqual(out, ["no time", "too expensive", "a"]);
});

test("buildProfile: merges insights, newest first, without duplicates", () => {
  const profile = buildProfile("o1", "u1", [
    ins("i1", "call", {
      pains: ["posting every day with no clients", "no time"],
      objections: [{ objection: "I tried ads and lost money", answer: "" }],
      words: ["posting into the void"],
    }),
    ins("i2", "call", {
      pains: ["No time!"],
      objections: [{ objection: "I tried ads and lost money.", answer: "We run them for you" }],
      words: ["feast or famine"],
    }),
    ins(
      "i3",
      "testimonial",
      { testimonial: { quote: "I booked 11 calls in 3 weeks", name: "Sarah Kim", role: "business coach", result: "11 calls in 3 weeks" } },
      { credit: "first" }
    ),
    ins("i4", "mystory", { story: { before: "agency burnout", turn: "found ads", after: "400 clients" } }),
    { ...ins("x", "call", { pains: ["other offer"] }), offerId: "o2" },
  ]);
  assert.equal(profile.counts.insights, 4, "other offers are left out");
  assert.equal(profile.counts.calls, 2);
  assert.equal(profile.pains.length, 2, "duplicate pain removed");
  assert.equal(profile.objections.length, 1);
  assert.equal(profile.objections[0].answer, "We run them for you", "an answer from a later insight fills a blank one");
  assert.equal(profile.proof.length, 1);
  assert.equal(profile.proof[0].credit, "first");
  assert.deepEqual(profile.results, ["11 calls in 3 weeks"]);
  assert.ok(profile.myStory, "the founder story is kept apart from customer stories");
  assert.equal(profile.stories.length, 0);
  assert.ok(profile.words.includes("feast or famine"));
});

test("buildProfile: deleting an insight removes what it added", () => {
  const all = [
    ins("i1", "testimonial", { testimonial: { quote: "Great", name: "Ann Lee", role: "", result: "" } }),
    ins("i2", "call", { pains: ["no time"] }),
  ];
  assert.equal(buildProfile("o1", "u1", all).proof.length, 1);
  assert.equal(buildProfile("o1", "u1", all.filter((i) => i.id !== "i1")).proof.length, 0);
});

test("creditName: full, first, initials, none", () => {
  assert.equal(creditName("Sarah Kim", "full"), "Sarah Kim");
  assert.equal(creditName("Sarah Kim", "first"), "Sarah");
  assert.equal(creditName("Sarah Kim", "initials"), "S.K.");
  assert.equal(creditName("Sarah Kim", "none"), "");
  assert.equal(creditName("", "full"), "");
});

test("proofLine: role only shows with the full name, quotes are not doubled", () => {
  const base = { insightId: "i", quote: "“I booked 11 calls”", result: "", name: "Sarah Kim", role: "coach" };
  assert.equal(proofLine({ ...base, credit: "full" }), '"I booked 11 calls" (Sarah Kim, coach)');
  assert.equal(proofLine({ ...base, credit: "first" }), '"I booked 11 calls" (Sarah)');
  assert.equal(proofLine({ ...base, credit: "none" }), '"I booked 11 calls"');
});

test("scanPlaceholders: counts each kind and ignores merge tags", () => {
  const c = scanPlaceholders({
    headline: "Hey [FIRST NAME]",
    body: "[TESTIMONIAL 1]\n[TESTIMONIAL 2]\n[CUSTOMER NAME] got [RESULT].\n[YOUR STORY]\n[LINK]\n[IMAGE: you on stage]",
    source: "[TESTIMONIAL]",
  });
  assert.equal(c.testimonial, 2, "the source field is not copy");
  assert.equal(c.customerName, 1);
  assert.equal(c.result, 1);
  assert.equal(c.story, 1);
});

test("fillPlaceholders: fills testimonials in order and keeps name and result matched", () => {
  const proof = [
    { insightId: "a", quote: "I booked 11 calls", result: "11 calls in 3 weeks", name: "Sarah Kim", role: "", credit: "first" as const },
    { insightId: "b", quote: "Finally consistent", result: "", name: "Tom Ray", role: "", credit: "initials" as const },
  ];
  const { copy, changes, needsRewrite } = fillPlaceholders(
    {
      headline: "Will this work for you?",
      body: "Here's proof:\n[TESTIMONIAL 1]\n[TESTIMONIAL 2]\n[CUSTOMER NAME] got [RESULT].\nThen [YOUR STORY]",
      source: "campaign template",
    },
    proof
  );
  assert.ok(copy.body.includes('"I booked 11 calls" (Sarah)'));
  assert.ok(copy.body.includes('"Finally consistent" (T.R.)'));
  assert.ok(copy.body.includes("Sarah got 11 calls in 3 weeks."), "name and result come from the first quote used");
  assert.equal(copy.source, "campaign template", "source untouched");
  assert.equal(changes.length, 4);
  assert.equal(changes[0].before, "[TESTIMONIAL 1]");
  assert.deepEqual(needsRewrite, ["story"]);
});

test("fillPlaceholders: no proof means nothing changes", () => {
  const before = { body: "[TESTIMONIAL]" };
  const { copy, changes } = fillPlaceholders(before, []);
  assert.equal(copy.body, "[TESTIMONIAL]");
  assert.equal(changes.length, 0);
});

test("fillPlaceholders: a placeholder value that itself looks like a blank never loops", () => {
  const proof = [{ insightId: "a", quote: "[TESTIMONIAL]", result: "", name: "", role: "", credit: "none" as const }];
  const { copy } = fillPlaceholders({ body: "[TESTIMONIAL] and [TESTIMONIAL]" }, proof);
  assert.equal(copy.body, '"[TESTIMONIAL]" and [TESTIMONIAL]');
});

test("strength: empty profile is 0 and points at the biggest gap", () => {
  const s = strength(null);
  assert.equal(s.score, 0);
  assert.equal(s.areas.length, 5);
  assert.ok(s.headline.length > 0);
});

test("strength: blanks in campaigns become the headline", () => {
  const p = buildProfile("o1", "u1", [ins("i1", "call", { pains: ["a b c"], objections: [{ objection: "x y z", answer: "" }] })]);
  const s = strength(p, { testimonial: 4, story: 0, number: 0 });
  assert.equal(s.headline, "4 messages still say [TESTIMONIAL]");
  assert.ok(s.score > 0 && s.score < 100);
});

test("strength: a full profile has no tips", () => {
  const W = ["apple", "river", "candle", "harbor", "violet", "copper", "meadow", "lantern", "falcon", "pepper", "marble", "willow", "saddle", "orchid"];
  const many = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p} ${W[i]} ${W[(i + 5) % W.length]}`);
  const p = buildProfile("o1", "u1", [
    ins("i1", "call", {
      pains: many(6, "pain"),
      desires: many(6, "desire"),
      words: many(12, "phrase"),
      objections: many(6, "objection").map((o) => ({ objection: o, answer: "a" })),
    }),
    ...Array.from({ length: 5 }, (_, k) =>
      ins(`t${k + 2}`, "testimonial", { testimonial: { quote: `${W[k]} ${W[k + 3]} ${W[k + 6]} changed everything`, name: "A B", role: "", result: "" } })
    ),
    ins("i9", "mystory", { story: { before: "b", turn: "t", after: "a" } }),
  ]);
  const s = strength(p);
  assert.equal(s.score, 100);
  assert.ok(s.areas.every((a) => !a.tip));
  assert.equal(s.headline, "Strong. Campeos has plenty to write from.");
});
