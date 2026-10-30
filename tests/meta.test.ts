import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isOptOutRegion, parseConsent, readCookie, trackingAllowed } from "../lib/meta/consent";
import { amountToValue, buildPurchaseEvent, cleanMetaCookie, clientIpFrom, normalizeEmail, sha256 } from "../lib/meta/payload";

test("US is opt-out, everywhere else (and unknown) asks first", () => {
  assert.equal(isOptOutRegion("US"), true);
  assert.equal(isOptOutRegion("us"), true);
  assert.equal(isOptOutRegion("EE"), false);
  assert.equal(isOptOutRegion(""), false);
  assert.equal(isOptOutRegion(null), false);
});

test("tracking rules: choice wins, then region default", () => {
  assert.equal(trackingAllowed(null, "US"), true);
  assert.equal(trackingAllowed("denied", "US"), false);
  assert.equal(trackingAllowed(null, "DE"), false);
  assert.equal(trackingAllowed(null, null), false);
  assert.equal(trackingAllowed("granted", "DE"), true);
});

test("consent cookie parsing", () => {
  assert.equal(parseConsent("granted"), "granted");
  assert.equal(parseConsent("denied"), "denied");
  assert.equal(parseConsent("maybe"), null);
  assert.equal(parseConsent(undefined), null);
  assert.equal(readCookie("cp_consent", "a=1; cp_consent=denied; b=2"), "denied");
  assert.equal(readCookie("missing", "a=1"), null);
});

test("emails are lower-cased and trimmed before hashing", () => {
  assert.equal(normalizeEmail("  Ajay@Example.COM "), "ajay@example.com");
  assert.equal(sha256("a"), createHash("sha256").update("a").digest("hex"));
});

test("amounts: cents to dollars, exact", () => {
  assert.equal(amountToValue(3900), 39);
  assert.equal(amountToValue(9900), 99);
  assert.equal(amountToValue(39600), 396);
  assert.equal(amountToValue(1999), 19.99);
});

test("the Purchase event has the real value, the shared id and hashed email", () => {
  const e = buildPurchaseEvent({
    eventId: "cs_test_123",
    amountTotal: 3900,
    currency: "usd",
    email: " Buyer@Example.com ",
    uid: "u1",
    fbp: "fb.1.1.2",
    fbc: "fb.1.1.abc",
    ip: "1.2.3.4",
    userAgent: "UA",
    sourceUrl: "https://campeos.com/welcome",
    eventTime: 1700000000,
    planLabel: "Starter",
  });
  assert.equal(e.event_name, "Purchase");
  assert.equal(e.event_id, "cs_test_123");
  assert.equal(e.action_source, "website");
  assert.equal(e.event_time, 1700000000);
  assert.deepEqual(e.custom_data, { value: 39, currency: "USD", content_name: "Starter" });
  assert.deepEqual(e.user_data.em, [sha256("buyer@example.com")]);
  assert.deepEqual(e.user_data.external_id, [sha256("u1")]);
  assert.equal(e.user_data.fbp, "fb.1.1.2");
  assert.equal(e.user_data.client_ip_address, "1.2.3.4");
  // raw email never appears
  assert.equal(JSON.stringify(e).includes("Buyer@Example.com"), false);
  assert.equal(JSON.stringify(e).includes("buyer@example.com"), false);
});

test("missing match data is left out, not sent empty", () => {
  const e = buildPurchaseEvent({ eventId: "cs_1", amountTotal: 9900, currency: "USD" });
  assert.deepEqual(e.user_data, {});
  assert.equal("event_source_url" in e, false);
  assert.equal("content_name" in e.custom_data, false);
});

test("client ip and cookie cleaning", () => {
  assert.equal(clientIpFrom("9.9.9.9, 10.0.0.1"), "9.9.9.9");
  assert.equal(clientIpFrom(null), null);
  assert.equal(cleanMetaCookie("fb.1.1700000000.123456"), "fb.1.1700000000.123456");
  assert.equal(cleanMetaCookie("<script>"), undefined);
  assert.equal(cleanMetaCookie(42), undefined);
  assert.equal(cleanMetaCookie("x".repeat(500)), undefined);
});
