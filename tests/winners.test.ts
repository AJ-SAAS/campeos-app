import { test } from "node:test";
import assert from "node:assert/strict";
import { confettiPieces } from "../lib/confetti";
import {
  MAX_WINNERS_IN_PROMPT,
  WinnerEntry,
  findWinner,
  isWinnableField,
  normalizeWinnerText,
  winnerChipLabel,
  winnerPromptLine,
  winnerTag,
  winnersForPrompt,
} from "../lib/winners";

const entry = (id: string, text: string, extra: Partial<WinnerEntry> = {}): WinnerEntry => ({
  id,
  text,
  origin: "marked",
  addedAt: new Date(2026, 9, Number(id) || 1),
  ...extra,
});

test("only real copy fields can be marked as winners", () => {
  for (const key of ["headline", "primaryText", "body", "caption"]) {
    assert.equal(isWinnableField(key), true, key);
  }
  for (const key of ["visual", "source", "keywords", "titles", "bullets"]) {
    assert.equal(isWinnableField(key), false, key);
  }
});

test("matching a winner ignores case and extra whitespace", () => {
  assert.equal(normalizeWinnerText("  Last   CALL\nfor seats "), "last call for seats");
  const list = [entry("1", "Last call for seats")];
  assert.equal(findWinner(list, "  last call   for seats ")?.id, "1");
  assert.equal(findWinner(list, "Something else"), undefined);
  assert.equal(findWinner(list, "   "), undefined);
});

test("a tag says channel, field and campaign type", () => {
  const meta = { channel: "email", fieldLabel: "Headline / subject", campaignType: "Webinar" };
  assert.equal(winnerTag(meta), "email, Headline / subject, Webinar campaign");
  assert.equal(winnerTag({ channel: "sms" }), "text message");
  assert.equal(winnerTag({}), "");
  assert.equal(winnerChipLabel(meta), "Email · Headline / subject");
});

test("pasted lines reach the prompt unchanged, marked ones get a tag", () => {
  assert.equal(
    winnerPromptLine({ text: "Testimonial: It worked. - Sam", origin: "pasted" }),
    "Testimonial: It worked. - Sam"
  );
  assert.equal(
    winnerPromptLine({ text: " 3 seats left ", origin: "marked", channel: "ad", fieldLabel: "Primary text" }),
    "3 seats left [ad, Primary text]"
  );
  // Marked but with no context: no empty brackets.
  assert.equal(winnerPromptLine({ text: "Hello", origin: "marked" }), "Hello");
});

test("prompt winners are newest first and capped", () => {
  const many = Array.from({ length: MAX_WINNERS_IN_PROMPT + 10 }, (_, i) =>
    entry(String(i + 1), `line ${i + 1}`, { addedAt: new Date(2026, 0, i + 1), origin: "pasted" })
  );
  const lines = winnersForPrompt(many);
  assert.equal(lines.length, MAX_WINNERS_IN_PROMPT);
  assert.equal(lines[0], `line ${many.length}`);
  assert.equal(lines.includes("line 1"), false);
});

test("empty entries never reach the prompt", () => {
  assert.deepEqual(winnersForPrompt([entry("1", "   ")]), []);
});

test("a confetti burst makes the right number of pieces that all fall down in the end", () => {
  const pieces = confettiPieces(20);
  assert.equal(pieces.length, 20);
  for (const p of pieces) {
    assert.ok(p.dy > 0, "ends below where it started");
    assert.ok(p.rise < 0, "goes up first");
    assert.ok(p.duration >= 800 && p.duration <= 1300);
    assert.match(p.color, /^#[0-9A-F]{6}$/i);
  }
});
