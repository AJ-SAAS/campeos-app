import { test } from "node:test";
import assert from "node:assert/strict";
import { opensAutomatically, showsFloatingAgent } from "../lib/agentPages";

test("floating Eos shows on app pages but not on settings, sign-in or marketing", () => {
  for (const p of ["/dashboard", "/campaigns", "/offers", "/buyer-insights", "/winning-copy", "/billing", "/campaigns/abc"]) {
    assert.equal(showsFloatingAgent(p), true, p);
  }
  for (const p of ["/settings", "/auth", "/onboarding", "/", "/privacy", "/terms", "/builder", "/dashboardx", null]) {
    assert.equal(showsFloatingAgent(p), false, String(p));
  }
});

test("Eos opens by itself only on Home", () => {
  assert.equal(opensAutomatically("/dashboard"), true);
  assert.equal(opensAutomatically("/campaigns"), false);
});
