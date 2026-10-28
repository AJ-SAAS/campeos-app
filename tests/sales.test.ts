import test from "node:test";
import assert from "node:assert/strict";
import { templateForSale, salesCalendar } from "../lib/salesCalendar";
import { catalog } from "../lib/templates/catalog";

test("Black Friday and Cyber Monday open their own templates, never the webinar", () => {
  assert.equal(templateForSale("black-friday"), "black-friday");
  assert.equal(templateForSale("cyber-monday"), "cyber-monday");
  assert.equal(templateForSale("easter"), "holiday-sale");
});

test("every sales day maps to an available template", () => {
  const ids = new Set(catalog.filter((c) => c.status === "available").map((c) => c.id));
  for (const d of salesCalendar(new Date(2026, 9, 28))) assert.ok(ids.has(templateForSale(d.id)), d.id);
});
