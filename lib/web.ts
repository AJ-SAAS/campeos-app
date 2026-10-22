// Server-only: fetching a public web page as plain text. Shared by the sales
// page scan (app/api/analyze-offer-page) and Buyer insights' "From a link"
// (app/api/insights/read).

export function asUrl(raw: string): string | null {
  const t = raw.trim();
  if (/\s/.test(t) || !t.includes(".")) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".") || isPrivateHost(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Never fetch our own network or cloud metadata, whatever a user types. */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^0\./.test(h) ||
    h === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(h) ||
    /^fe80:/.test(h)
  );
}

export function stripHtmlToText(html: string): string {
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

// A real browser's headers. Many sites (and Cloudflare "bot fight" rules,
// which campeos.com itself uses) turn away anything that announces itself as
// a bot, so the old "CampeosBot" agent got "We couldn't open that link".
// This only reads one public page the user pointed us at.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export type PageFetch =
  | { status: "ok"; html: string; finalUrl: string }
  | { status: "blocked" | "unreachable" };

/** Fetches one public page. "blocked" = the site answered but refused us
 * (403, 429, a bot wall), "unreachable" = no answer or an error page. */
export async function fetchPageHtml(url: string, timeoutMs = 8000): Promise<PageFetch> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: BROWSER_HEADERS });
    clearTimeout(timeout);
    // A redirect onto a private address is refused too.
    let finalUrl = url;
    try {
      finalUrl = res.url || url;
      if (isPrivateHost(new URL(finalUrl).hostname)) return { status: "unreachable" };
    } catch {
      return { status: "unreachable" };
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) return { status: "blocked" };
    if (!res.ok) return { status: "unreachable" };
    const html = (await res.text()).slice(0, 2_000_000);
    return { status: "ok", html, finalUrl };
  } catch {
    return { status: "unreachable" };
  }
}

/** The same address with and without "www.", for sites that only answer on one. */
export function urlVariants(url: string): string[] {
  try {
    const u = new URL(url);
    const alt = new URL(url);
    alt.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
    return [url, alt.toString()];
  } catch {
    return [url];
  }
}

const decode = (t: string) =>
  t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, key: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const k = tag.match(/(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (k === key) {
      const c = tag.match(/content=["']([^"']*)["']/i)?.[1];
      if (c) return decode(c);
    }
  }
  return "";
}

/** Walks JSON-LD (schema.org) and pulls the readable bits: names,
 * descriptions, prices, reviews. Many script-heavy sites still ship this. */
function jsonLdLines(html: string): string[] {
  const out: string[] = [];
  const blocks = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const visit = (node: unknown, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    for (const key of ["name", "headline", "description", "reviewBody", "price", "priceCurrency", "audience"]) {
      const v = o[key];
      if (typeof v === "string" || typeof v === "number") out.push(`${key}: ${decode(String(v))}`);
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v, depth + 1);
  };
  for (const b of blocks) {
    const body = b.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      visit(JSON.parse(body));
    } catch {
      // not valid JSON: skip it
    }
  }
  return out;
}

/**
 * Everything readable from a page that does NOT depend on running its
 * scripts: title, description, social-share tags, schema.org data,
 * headings, and <noscript> text. For script-built pages (a plain fetch of
 * those returns an empty shell) this is usually enough to name the offer.
 */
export function pageSignals(html: string): string {
  const lines: string[] = [];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) lines.push(`Page title: ${decode(title.replace(/<[^>]+>/g, " "))}`);
  for (const key of ["description", "og:title", "og:description", "og:site_name", "twitter:title", "twitter:description"]) {
    const v = metaContent(html, key);
    if (v) lines.push(`${key}: ${v}`);
  }
  lines.push(...jsonLdLines(html));
  const headings = html.match(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi) ?? [];
  for (const h of headings.slice(0, 30)) {
    const t = decode(h.replace(/<[^>]+>/g, " "));
    if (t) lines.push(`Heading: ${t}`);
  }
  const noscript = html.match(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi) ?? [];
  for (const n of noscript.slice(0, 5)) {
    const t = decode(n.replace(/<[^>]+>/g, " "));
    if (t.length > 30) lines.push(t);
  }
  return [...new Set(lines)].join("\n");
}

/** The visible text of a public page, or null if it can't be reached. */
export async function fetchPageText(url: string, maxLength = 12000, timeoutMs = 8000): Promise<string | null> {
  for (const candidate of urlVariants(url)) {
    const page = await fetchPageHtml(candidate, timeoutMs);
    if (page.status !== "ok") continue;
    const text = stripHtmlToText(page.html);
    const signals = pageSignals(page.html);
    const combined = text.length >= 200 ? text : `${signals}\n${text}`.trim();
    if (combined) return combined.slice(0, maxLength);
  }
  return null;
}

// ---------- Lighter text for the AI (no AI involved here) ----------

const BOILERPLATE = /^(skip to (main )?content|menu|close|search|log ?in|sign ?in|sign ?up|cart|accept( all)?( cookies)?|decline|©|copyright|all rights reserved|privacy( policy)?|terms( of (service|use))?|cookies?( policy| settings)?|powered by|back to top)\b|all rights reserved|we use cookies/i;

// Lines worth keeping even when a long page has to be cut short.
const KEEPERS = /[$€£₹]\s?\d|\d+\s?%|testimonial|review|guarantee|results?|clients?|customers?|students?|members?|per month|\/\s?mo\b|price|["“”]|★|stars?|webinar|workshop|program|course/i;

/**
 * Cuts a page's words down to what's worth paying to read: drops empty and
 * menu/cookie/footer lines, removes lines that repeat, and when the page is
 * still too long keeps the opening plus the lines that talk about prices,
 * results and testimonials. Plain code, no AI. Works on pasted text too.
 */
export function condenseText(raw: string, max = 9000): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const piece of raw.split(/\n+/)) {
    const line = decode(piece);
    if (line.length < 3) continue;
    if (line.length < 60 && BOILERPLATE.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  const all = lines.join("\n");
  if (all.length <= max) return all;

  const headBudget = Math.floor(max * 0.6);
  const kept = new Set<number>();
  let used = 0;
  for (let i = 0; i < lines.length; i++) {
    if (used + lines[i].length + 1 > headBudget) break;
    kept.add(i);
    used += lines[i].length + 1;
  }
  for (let i = 0; i < lines.length && used < max; i++) {
    if (kept.has(i) || !KEEPERS.test(lines[i])) continue;
    const take = lines[i].slice(0, 600);
    if (used + take.length + 1 > max) continue;
    kept.add(i);
    lines[i] = take;
    used += take.length + 1;
  }
  return [...kept].sort((a, b) => a - b).map((i) => lines[i]).join("\n");
}

/** A page's HTML as readable lines (one per block), without menus, footers and code. */
export function pageToLines(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(nav|footer|aside|svg|select|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6]|tr|blockquote|figure|header|main)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

/** The same page always gives the same key: no www, no #hash, no tracking params, no trailing slash. */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|mc_)/i.test(k)) u.searchParams.delete(k);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    const q = u.searchParams.toString();
    return `${host}${path}${q ? `?${q}` : ""}`;
  } catch {
    return url.trim().toLowerCase();
  }
}
