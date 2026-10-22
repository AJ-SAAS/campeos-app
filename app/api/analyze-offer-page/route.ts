import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/serverAuth";
import { isAdminUid, claimDaily, DAILY_LIMIT_MESSAGE } from "@/lib/access";
import { z } from "zod";
import { analyzeOfferPage, MIN_READABLE_LENGTH } from "@/lib/ai/analyzeOfferPage";
import { asUrl, condenseText, fetchPageHtml, normalizeUrlKey, pageSignals, pageToLines, urlVariants } from "@/lib/web";
import { cacheKey, getCachedScan, putCachedScan } from "@/lib/scanCache";

// Takes a sales-page URL from the new first onboarding step, fetches it
// server-side, strips it down to visible text, and runs that through
// analyzeOfferPage. Called before the manual name/whatTheyGet/audience/
// price questions, so those steps can arrive pre-filled instead of blank
// (see app/onboarding/page.tsx).
//
// Deliberately a PLAIN fetch, not a headless browser — per the decision
// to keep this best-effort rather than add a Playwright/Puppeteer
// dependency for it. A lot of modern page builders (ClickFunnels, Kajabi,
// etc.) render their real content with JavaScript, so a plain fetch of
// those pages gets back mostly empty markup. Rather than treat that as
// an error, this route detects "suspiciously little text came back" and
// returns ok:false with no error message — the onboarding step reads
// that as "couldn't read this page" and falls straight through to the
// existing manual questions, no different than if the user had skipped.

// Accepts either { url } (the original shape) or { input }, which is
// whatever the user typed into onboarding's "Link, or words from the
// page" box: a link (with or without https://) OR the page's words
// pasted straight in. Pasting the words is the fallback for page
// builders that block a plain fetch, so it skips the fetch entirely.
const requestSchema = z
  .object({
    url: z.string().optional(),
    input: z.string().max(40000).optional(),
  })
  .refine((b) => (b.url ?? b.input ?? "").trim().length > 0, {
    message: "Paste a link or the words from your page.",
  });

// One "word" with a dot in it and no spaces reads as a link:
// "coachmachine.com/10-clients", "https://x.com", "linktr.ee/me".
// (asUrl and stripHtmlToText live in lib/web.ts, shared with Buyer insights.)

const FETCH_TIMEOUT_MS = 8000;
// Enough for a title plus a description or a few headings.
const MIN_SIGNAL_LENGTH = 80;
// Roughly enough to cover a long landing page without blowing past a
// reasonable prompt-length budget for UTILITY_MODEL.
// Trimmed first (lib/web.ts condenseText), so the model reads less.
const MAX_TEXT_LENGTH = 9000;


export async function POST(req: NextRequest) {
  const gate = await requireVerifiedUser(req, isAdminUid);
  if (gate.error) return gate.error;
  const caller = gate.user;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const raw = (parsed.data.input ?? parsed.data.url ?? "").trim();
  const url = asUrl(raw);

  // Same page or same words scanned in the last 2 days: reuse the answer.
  // Free, instant, and doesn't count against the daily limit.
  const key = url ? cacheKey("url", normalizeUrlKey(url)) : cacheKey("text", raw.replace(/\s+/g, " ").toLowerCase());
  const cached = await getCachedScan<Record<string, unknown>>(key);
  if (cached) {
    return NextResponse.json({ ok: true, source: url ? "url" : "text", cached: true, ...cached });
  }

  if (!(await claimDaily(caller.uid, "scan", 40))) {
    return NextResponse.json({ error: DAILY_LIMIT_MESSAGE }, { status: 429 });
  }

  // Pasted words, not a link: no fetch, straight to the extractor.
  if (!url) {
    const pasted = condenseText(raw, MAX_TEXT_LENGTH);
    if (pasted.length < 40) {
      return NextResponse.json({ ok: false, reason: "too_short" });
    }
    try {
      const extraction = await analyzeOfferPage(pasted);
      await putCachedScan(key, extraction);
      return NextResponse.json({ ok: true, source: "text", ...extraction });
    } catch {
      return NextResponse.json({ ok: false, reason: "extract_failed" });
    }
  }

  // Try the address as typed, then with/without "www.". Script-built pages
  // and bot walls don't stop us from reading the title, description and
  // headings, which is often enough to name the offer.
  let text = "";
  let sawBlocked = false;
  let sawPage = false;
  for (const candidate of urlVariants(url)) {
    const page = await fetchPageHtml(candidate, FETCH_TIMEOUT_MS);
    if (page.status === "blocked") {
      sawBlocked = true;
      continue;
    }
    if (page.status !== "ok") continue;
    sawPage = true;
    const body = condenseText(pageToLines(page.html), MAX_TEXT_LENGTH);
    const signals = pageSignals(page.html);
    const combined = body.length >= MIN_READABLE_LENGTH ? body : `${signals}\n${body}`.trim();
    if (combined.length > text.length) text = combined;
    if (text.length >= MIN_READABLE_LENGTH) break;
  }
  text = condenseText(text, MAX_TEXT_LENGTH);

  // Titles and descriptions alone can still name an offer, so the bar for
  // "worth sending to the model" is lower than for a full page of text.
  if (text.length < MIN_SIGNAL_LENGTH) {
    // Tell the user WHY, so the next step is clear: blocked sites need the
    // words pasted; script-built pages too; a bad address needs fixing.
    const reason = sawPage ? "script_only" : sawBlocked ? "blocked" : "unreachable";
    return NextResponse.json({ ok: false, reason });
  }

  try {
    const extraction = await analyzeOfferPage(text);
    await putCachedScan(key, extraction);
    return NextResponse.json({ ok: true, source: "url", ...extraction });
  } catch {
    // The crawl worked but the AI call didn't (bad JSON, API error,
    // etc.) — still best-effort, still a silent fall-through rather than
    // blocking onboarding on it.
    return NextResponse.json({ ok: false, reason: "extract_failed" });
  }
}
