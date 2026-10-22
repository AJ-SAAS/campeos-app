import { test } from "node:test";
import assert from "node:assert/strict";
import { isDisposableEmail } from "../lib/disposableEmail";
import { needsEmailVerification, requireVerifiedUser, type VerifiedUser } from "../lib/serverAuth";
import { missingDetails, missingDetailsLabel, needsInput } from "../lib/dashboard";
import { joinPrice, splitPrice, defaultCurrency, launchDateInDays, launchDateToEvent, daysUntil, suggestedPlan } from "../lib/onboarding/answers";
import { pageSignals, urlVariants } from "../lib/web";

// ---- fake sign-ups -------------------------------------------------------

test("throwaway inboxes are recognised, real ones are not", () => {
  assert.ok(isDisposableEmail("x@mailinator.com"));
  assert.ok(isDisposableEmail("X@Guerrillamail.com"));
  assert.ok(isDisposableEmail("a@sub.yopmail.com"));
  assert.ok(!isDisposableEmail("ajay@gmail.com"));
  assert.ok(!isDisposableEmail("me@mymailinatorfan.org"));
  assert.ok(!isDisposableEmail(null));
});

const user = (over: Partial<VerifiedUser>): VerifiedUser => ({ uid: "u1", email: "a@b.com", emailVerified: false, passwordUser: true, ...over });

test("email + password accounts must confirm; Google accounts never block", () => {
  assert.ok(needsEmailVerification(user({})));
  assert.ok(!needsEmailVerification(user({ emailVerified: true })));
  assert.ok(!needsEmailVerification(user({ passwordUser: false })));
});

async function gate(u: VerifiedUser | null, isAdmin = (_: string) => false) {
  const realFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "k";
  globalThis.fetch = (async () =>
    u
      ? new Response(JSON.stringify({ users: [{ localId: u.uid, email: u.email, emailVerified: u.emailVerified, providerUserInfo: u.passwordUser ? [{ providerId: "password" }] : [{ providerId: "google.com" }] }] }))
      : new Response("{}", { status: 400 })) as typeof fetch;
  try {
    return await requireVerifiedUser(new Request("http://x", { headers: { authorization: "Bearer t" } }), isAdmin);
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("the AI gate: signed out 401, unverified 403, throwaway 403, verified passes", async () => {
  assert.equal((await gate(null)).error?.status, 401);
  const unverified = await gate(user({}));
  assert.equal(unverified.error?.status, 403);
  assert.equal((await unverified.error!.json()).code, "verify_email");
  const bad = await gate(user({ emailVerified: true, email: "x@mailinator.com" }));
  assert.equal(bad.error?.status, 403);
  assert.ok((await gate(user({ emailVerified: true }))).user);
  assert.ok((await gate(user({ passwordUser: false }))).user, "Google accounts pass");
});

test("the owner's account is never locked out", async () => {
  assert.ok((await gate(user({}), (id) => id === "u1")).user);
});

// ---- "Needs input" -------------------------------------------------------

test("merge tags are not blanks", () => {
  assert.ok(!needsInput({ body: "Hey [FIRST NAME], watch it here: [LINK]" }));
  assert.deepEqual(missingDetails({ body: "Hey [FIRST NAME] [LINK]" }), []);
});

test("real blanks are listed, once each, and named for the card", () => {
  const copy = { headline: "[RESULT] in 30 days", body: "Like [CUSTOMER NAME] got. [RESULT] and a [GUARANTEE]. [LINK]" };
  assert.deepEqual(missingDetails(copy), ["RESULT", "CUSTOMER NAME", "GUARANTEE"]);
  assert.equal(missingDetailsLabel(copy), "Add your result and customer name +1 more");
  assert.equal(missingDetailsLabel({ body: "Add your [TESTIMONIAL]" }), "Add your testimonial");
  assert.equal(missingDetailsLabel(null), "");
});

// ---- onboarding answers --------------------------------------------------

test("price: currency goes in front of a plain number only", () => {
  assert.equal(joinPrice("$", "997"), "$997");
  assert.equal(joinPrice("€", "1 997"), "€1997");
  assert.equal(joinPrice("£", "49.50"), "£49.50");
  assert.equal(joinPrice("$", "97/mo"), "$97/mo");
  assert.equal(joinPrice("$", "$97"), "$97", "already has a symbol: untouched");
  assert.equal(joinPrice("$", "Free"), "Free");
  assert.equal(joinPrice("$", "  "), "");
});

test("price: a scanned price is split back into currency and number", () => {
  assert.deepEqual(splitPrice("$497"), { currency: "$", amount: "497" });
  assert.deepEqual(splitPrice("€ 1,200"), { currency: "€", amount: "1,200" });
  assert.deepEqual(splitPrice("CA$99"), { currency: "CA$", amount: "99" });
  assert.deepEqual(splitPrice("Free"), { currency: null, amount: "Free" });
});

test("currency starts from the browser language", () => {
  assert.equal(defaultCurrency("en-US"), "$");
  assert.equal(defaultCurrency("en-GB"), "£");
  assert.equal(defaultCurrency("de-DE"), "€");
  assert.equal(defaultCurrency("et-EE"), "€");
  assert.equal(defaultCurrency("en-AU"), "A$");
  assert.equal(defaultCurrency(""), "$");
});

test("launch date: shortcuts, 7 PM default, days away", () => {
  const from = new Date(2026, 9, 22, 10, 0, 0);
  assert.equal(launchDateInDays(8, from), "2026-10-30");
  const d = launchDateToEvent("2026-10-30")!;
  assert.equal(d.getHours(), 19);
  assert.equal(d.getDate(), 30);
  assert.equal(launchDateToEvent("soon"), null);
  assert.equal(launchDateToEvent(undefined), null);
  assert.equal(daysUntil("2026-10-30", from), 8);
  assert.equal(daysUntil("2026-10-22", from), 0);
});

test("brand-new users start on Starter", () => {
  assert.equal(suggestedPlan("new"), "starter");
  assert.equal(suggestedPlan("rarely"), "starter");
  assert.equal(suggestedPlan("weekly"), "pro");
});

// ---- link import ---------------------------------------------------------

const SHELL = `<!doctype html><html><head>
<title>Launch Lab | 10 Clients in 30 Days</title>
<meta name="description" content="Done-for-you Facebook ads for coaches stuck under $10K a month.">
<meta property="og:title" content="10 Clients in 30 Days">
<script type="application/ld+json">{"@type":"Product","name":"10 Clients in 30 Days","description":"Ads, funnel and weekly calls","offers":{"price":"997","priceCurrency":"USD"}}</script>
</head><body><div id="root"></div><script>window.app=1</script></body></html>`;

test("a script-built page still gives us its title, description and price", () => {
  const text = pageSignals(SHELL);
  assert.ok(text.includes("10 Clients in 30 Days"));
  assert.ok(text.includes("Done-for-you Facebook ads"));
  assert.ok(text.includes("price: 997"));
  assert.ok(text.length > 80, "long enough to be worth reading");
});

test("headings and no-script text are picked up too", () => {
  const html = `<html><body><h1>Beginner Yoga in 21 Days</h1><h2>For busy women over 40</h2><noscript>Enable JavaScript to see the full page about our yoga course.</noscript></body></html>`;
  const text = pageSignals(html);
  assert.ok(text.includes("Heading: Beginner Yoga in 21 Days"));
  assert.ok(text.includes("busy women over 40"));
  assert.ok(text.includes("yoga course"));
});

test("an empty shell gives nothing, so the user is asked to paste", () => {
  assert.equal(pageSignals("<html><body><div id=root></div></body></html>"), "");
});

test("www and bare addresses are both tried", () => {
  assert.deepEqual(urlVariants("https://campeos.com/"), ["https://campeos.com/", "https://www.campeos.com/"]);
  assert.deepEqual(urlVariants("https://www.campeos.com/x"), ["https://www.campeos.com/x", "https://campeos.com/x"]);
});
