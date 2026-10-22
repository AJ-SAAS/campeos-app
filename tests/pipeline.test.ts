import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setChatOverride } from "../lib/ai/client";
import { generateStepCopy, generateStepCopyScored } from "../lib/ai/generateStepCopy";
import { buildBriefPrompt } from "../lib/ai/brief";
import { buildStepCopyPrompt, type OfferContext, type StepContext } from "../lib/ai/prompts";
import { getPlay } from "../lib/frameworks/plays";

afterEach(() => setChatOverride(null));

const offer: OfferContext = {
  name: "10 Clients in 30 Days",
  price: "$997",
  audience: "Coaches under $10K a month",
  whatTheyGet: "Done-for-you Facebook ads, a booking funnel and weekly calls, or we keep working free",
  tone: "Direct",
  fromName: "Ajay",
};

const step: StepContext = {
  channel: "email",
  title: "Who should NOT buy this",
  purpose: "Sell by pushing the wrong people away",
  angle: "Takeaway selling",
  eventAt: "Thursday, October 29 at 7:00 PM",
  fields: [
    { key: "headline", label: "Headline / subject", kind: "short" },
    { key: "body", label: "Body", kind: "long" },
  ],
  play: getPlay("takeaway"),
};

const good = { headline: "3 coaches who shouldn't buy this", body: "Hey [FIRST NAME],\n\nYou posted at lunch. Nobody booked.\n\nIt's $997. [LINK]", source: "campaign template" };

/** Routes stand-in replies by what's being asked: the checker or the writer. */
function script(opts: { scores: number[]; drafts: Record<string, string>[] }) {
  const prompts: { kind: "critic" | "write"; text: string }[] = [];
  let s = 0;
  let d = 0;
  setChatOverride(({ messages }) => {
    const text = String(messages[0].content);
    if (text.includes("copy chief reviewing")) {
      prompts.push({ kind: "critic", text });
      return JSON.stringify({ score: opts.scores[Math.min(s++, opts.scores.length - 1)], problems: ["Make the hook sharper"] });
    }
    prompts.push({ kind: "write", text });
    return JSON.stringify(opts.drafts[Math.min(d++, opts.drafts.length - 1)]);
  });
  return prompts;
}

test("the checker is told every true fact, so it can't call them invented", async () => {
  const prompts = script({ scores: [8], drafts: [good] });
  await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  const critic = prompts.find((p) => p.kind === "critic")!.text;
  for (const fact of ["Price: $997", "The sender signs as: Ajay", "The event / key date: Thursday, October 29", "keep working free"]) {
    assert.ok(critic.includes(fact), `critic should see: ${fact}`);
  }
  assert.ok(critic.includes("Do NOT mark down for"), "placeholders for missing proof are not penalized");
});

test("a good draft is kept: one write, one check, no rewrite", async () => {
  const prompts = script({ scores: [8], drafts: [good] });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(prompts.filter((p) => p.kind === "write").length, 1);
  assert.equal(copy.headline, good.headline);
});

test("a weak draft gets exactly one rewrite, with the notes", async () => {
  const better = { ...good, headline: "If one slow week makes you quit, don't buy this" };
  const prompts = script({ scores: [4], drafts: [good, better] });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  const writes = prompts.filter((p) => p.kind === "write");
  assert.equal(writes.length, 2);
  assert.ok(writes[1].text.includes("Make the hook sharper"), "the rewrite sees the notes");
  assert.ok(writes[1].text.includes("Never add new [PLACEHOLDERS]"));
  assert.equal(copy.headline, better.headline);
});

test("a 6 is no longer good enough: it gets a rewrite", async () => {
  const better = { ...good, headline: "Don't buy this if one slow week makes you quit" };
  const prompts = script({ scores: [6, 8], drafts: [good, better] });
  const r = await generateStepCopyScored(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(prompts.filter((p) => p.kind === "write").length, 2);
  assert.equal(r.copy.headline, better.headline);
  assert.equal(r.score, 8, "reports the score of the copy it kept");
  assert.ok(r.rewritten);
});

test("a rewrite that scores lower is thrown away", async () => {
  const worse = { ...good, headline: "Some thoughts on coaching" };
  script({ scores: [6, 4], drafts: [good, worse] });
  const r = await generateStepCopyScored(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(r.copy.headline, good.headline);
  assert.equal(r.score, 6);
  assert.ok(!r.rewritten);
});

test("short formats are judged as what they are", async () => {
  const sms: StepContext = { ...step, channel: "sms", title: "Save your seat text", fields: [{ key: "body", label: "Text", kind: "long" }] };
  const prompts = script({ scores: [8], drafts: [{ body: "Ajay here. Tonight 7 PM. [LINK]", source: "campaign template" }] });
  await generateStepCopy(offer, sms, { winningCopy: [], callThemes: [] });
  assert.ok(prompts.find((p) => p.kind === "critic")!.text.includes("This is a text message"));
});

test("a rewrite that adds blanks is thrown away", async () => {
  const worse = { ...good, body: "[YOUR NAME] here. It costs [PRICE]. [GUARANTEE] [LINK]" };
  script({ scores: [3], drafts: [good, worse] });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(copy.body, good.body, "kept the first draft, which used the real price");
});

test("AI words trigger a rewrite even when the score is fine", async () => {
  const aiish = { ...good, body: "Unlock your next level journey. [LINK]" };
  const prompts = script({ scores: [8], drafts: [aiish, good] });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(prompts.filter((p) => p.kind === "write").length, 2);
  assert.equal(copy.body, good.body);
});

test("if the checker fails, the first draft still comes back", async () => {
  setChatOverride(({ messages }) => {
    if (String(messages[0].content).includes("copy chief reviewing")) throw new Error("checker down");
    return JSON.stringify(good);
  });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  assert.equal(copy.headline, good.headline);
});

test("em dashes never reach the user", async () => {
  script({ scores: [8], drafts: [{ ...good, headline: "Wait — read this" }] });
  const copy = await generateStepCopy(offer, step, { winningCopy: [], callThemes: [] });
  assert.ok(!copy.headline.includes("—"));
});

test("the writer prompt starts with the shared part, then this message", () => {
  const p = buildStepCopyPrompt(offer, step, { winningCopy: [], callThemes: [] });
  const shared = p.indexOf("Offer: 10 Clients");
  const marker = p.indexOf("=== THE MESSAGE TO WRITE NOW ===");
  const own = p.indexOf("Title: Who should NOT buy this");
  assert.ok(shared > -1 && marker > shared && own > marker, "offer and rules first, this message after: cheap caching");
  assert.ok(p.includes("Never copy their wording"), "plays are structure, not script");
});

test("no play hands over a stock line to copy word for word", () => {
  const { PLAYS } = require("../lib/frameworks/plays");
  const all = JSON.stringify(PLAYS).toLowerCase();
  for (const canned of ["this email will make some people mad.", "sorry for the long email", "i look forward to seeing your result", "so let's change that"]) {
    assert.ok(!all.includes(`'${canned}`) && !all.includes(`close: ${canned}`), `play still scripts: ${canned}`);
  }
});

test("the brief is told to write material, not notes", () => {
  const p = buildBriefPrompt({ offer, source: { winningCopy: [], callThemes: [] } });
  assert.ok(p.includes("WRITE MATERIAL, NOT NOTES"));
  assert.ok(p.includes("exactly an empty string"));
});

import { lintCopy } from "../lib/ai/quality";

test("an ad that never says what it sells is flagged", () => {
  const ad = { headline: "Another text about results", primaryText: "3 P.M. and your phone buzzes. Can we chat about our promo results?", source: "x" };
  const problems = lintCopy(ad, { channel: "ad" }, "Done-for-you Facebook ads Local gym owners We build and run your Facebook ads for you");
  assert.ok(problems.some((p) => p.includes("never says what you're selling")));
});

test("an ad that names the offer or the reader passes that check", () => {
  const ad = { headline: "Gym owner? We run your Facebook ads", primaryText: "You pay $99. We build it all.", source: "x" };
  const problems = lintCopy(ad, { channel: "ad" }, "Done-for-you Facebook ads Local gym owners We build and run your Facebook ads for you");
  assert.ok(!problems.some((p) => p.includes("never says what you're selling")));
});
