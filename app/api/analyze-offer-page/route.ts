import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeOfferPage, MIN_READABLE_LENGTH } from "@/lib/ai/analyzeOfferPage";

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

const requestSchema = z.object({
  url: z.string().url("That doesn't look like a valid URL."),
});

const FETCH_TIMEOUT_MS = 8000;
// Roughly enough to cover a long landing page without blowing past a
// reasonable prompt-length budget for UTILITY_MODEL.
const MAX_TEXT_LENGTH = 12000;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
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

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(parsed.data.url, {
      signal: controller.signal,
      headers: {
        // Some page builders serve a stripped-down page to obvious bots.
        "User-Agent":
          "Mozilla/5.0 (compatible; CampeosBot/1.0; +https://campeos.com)",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ ok: false });
    }
    html = await res.text();
  } catch {
    // Unreachable, timed out, blocked, DNS failure, etc. — this is the
    // "best-effort" part: no error surfaced, just a clean fall-through.
    return NextResponse.json({ ok: false });
  }

  const text = stripHtmlToText(html).slice(0, MAX_TEXT_LENGTH);

  if (text.length < MIN_READABLE_LENGTH) {
    // Almost certainly a JS-rendered shell with nothing a plain fetch
    // could see — same fall-through as an unreachable page.
    return NextResponse.json({ ok: false });
  }

  try {
    const extraction = await analyzeOfferPage(text);
    return NextResponse.json({ ok: true, ...extraction });
  } catch {
    // The crawl worked but the AI call didn't (bad JSON, API error,
    // etc.) — still best-effort, still a silent fall-through rather than
    // blocking onboarding on it.
    return NextResponse.json({ ok: false });
  }
}
