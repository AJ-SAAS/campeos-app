import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser, SIGN_IN_AGAIN } from "@/lib/serverAuth";
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
function asUrl(raw: string): string | null {
  const t = raw.trim();
  if (/\s/.test(t) || !t.includes(".")) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

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
  if (!(await getVerifiedUser(req))) {
    return NextResponse.json({ error: SIGN_IN_AGAIN }, { status: 401 });
  }
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

  // Pasted words, not a link: no fetch, straight to the extractor.
  if (!url) {
    const pasted = raw.replace(/\s+/g, " ").slice(0, MAX_TEXT_LENGTH);
    if (pasted.length < 40) {
      return NextResponse.json({ ok: false, reason: "too_short" });
    }
    try {
      const extraction = await analyzeOfferPage(pasted);
      return NextResponse.json({ ok: true, source: "text", ...extraction });
    } catch {
      return NextResponse.json({ ok: false, reason: "extract_failed" });
    }
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Some page builders serve a stripped-down page to obvious bots.
        "User-Agent":
          "Mozilla/5.0 (compatible; CampeosBot/1.0; +https://campeos.com)",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: "unreachable" });
    }
    html = await res.text();
  } catch {
    // Unreachable, timed out, blocked, DNS failure, etc. — this is the
    // "best-effort" part: no error surfaced, just a clean fall-through.
    return NextResponse.json({ ok: false, reason: "unreachable" });
  }

  const text = stripHtmlToText(html).slice(0, MAX_TEXT_LENGTH);

  if (text.length < MIN_READABLE_LENGTH) {
    // Almost certainly a JS-rendered shell with nothing a plain fetch
    // could see. Onboarding treats this like an unreachable page and
    // asks for the words to be pasted instead.
    return NextResponse.json({ ok: false, reason: "unreadable" });
  }

  try {
    const extraction = await analyzeOfferPage(text);
    return NextResponse.json({ ok: true, source: "url", ...extraction });
  } catch {
    // The crawl worked but the AI call didn't (bad JSON, API error,
    // etc.) — still best-effort, still a silent fall-through rather than
    // blocking onboarding on it.
    return NextResponse.json({ ok: false, reason: "extract_failed" });
  }
}
