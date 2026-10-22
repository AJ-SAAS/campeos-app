"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile, hasOnboarded, saveBusinessProfile } from "@/lib/firebase/businessProfile";
import { createOffer } from "@/lib/firebase/offers";
import { addWinningCopy } from "@/lib/firebase/library";
import {
  PLATFORMS,
  DEFAULT_PLATFORMS,
  FREQUENCIES,
  PlatformId,
  FrequencyId,
  suggestedPlan,
  LAUNCH_TYPE_IDS,
  LIVE_LAUNCH_TYPE,
  BILLING_OPTIONS,
  BillingId,
  WHO_EXAMPLES,
  billingFromPrice,
  priceLabel,
  whoIsThin,
  defaultCurrency,
  splitPrice,
  joinPrice,
  launchDateInDays,
  launchDateToEvent,
  daysUntil,
} from "@/lib/onboarding/answers";
import { catalog } from "@/lib/templates/catalog";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import "@/components/onboarding/onboarding.css";
import { firstName } from "@/lib/signOff";
import { authFetch } from "@/lib/firebase/authFetch";

// New-user onboarding: five plain-English questions on the left, and on
// the right the user's first email filling itself in as they answer
// (approved "Campeos Onboarding" design).
//
//   1. What do you sell?                      -> name
//   2. Do you have a sales page?              -> link OR pasted words,
//                                                scanned to pre-fill 3
//   3. Who's your ideal customer?             -> audience, whatTheyGet, price
//   4. Where do you reach your customers?     -> channels
//   5. What are you launching, and when?      -> campaign type + date
//   6. How often do you run a sale or promo?  -> frequency -> suggested plan
//
// Finishing writes businessProfiles/{uid} (which is what marks onboarding
// as done for useRequireAccess), saves the offer to offers/ so it shows
// up in the offer switcher, saves any testimonials found on their page as
// winning copy, then opens the builder on the first campaign
// (/builder?first=1), where the channels answer decides which steps get
// written. Nothing is ever invented: anything the scan doesn't find is
// left blank for the user to fill.

const STEP_COUNT = 6;

const EXAMPLES = ["Beginner Yoga Course", "Business Coaching", "Summer Candle Sale", "10 Clients in 30 Days"];

type ScanState = "idle" | "scanning" | "failed";
type FieldKey = "name" | "who" | "what" | "price";

const SCAN_ROWS: { label: string; missing: string; field: FieldKey | null }[] = [
  { label: "Opening your page", missing: "Opening your page", field: null },
  { label: "Found what you sell", missing: "No name found. You already gave one", field: "name" },
  { label: "Found your ideal customer", missing: "No customer found. Add it next", field: "who" },
  { label: "Found what they get", missing: "Not clear what they get. Add it next", field: "what" },
  { label: "Found the price", missing: "No price on the page. Add it next", field: "price" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function OnboardingPage() {
  const { user, loading: authLoading, signOut, needsVerification } = useAuth();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [page, setPage] = useState("");
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  // "Sign emails as": starts as the first name on their login, which is
  // usually right, so most people just leave it.
  const [signOff, setSignOff] = useState("");
  const signOffTouched = useRef(false);
  const [channels, setChannels] = useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [frequency, setFrequency] = useState<FrequencyId | null>(null);
  // Price is typed as a number with the currency picked beside it.
  const [currency, setCurrency] = useState("$");
  // One-time, monthly or yearly. They have to pick when there's a price.
  const [billing, setBilling] = useState<BillingId | null>(null);
  // What they're launching and when it goes live (yyyy-mm-dd).
  const [launchType, setLaunchType] = useState<string>(LIVE_LAUNCH_TYPE);
  // Live once its real template exists (catalog status "available").
  const launchIsLive = catalog.find((c) => c.id === launchType)?.status === "available";
  const [notifyMe, setNotifyMe] = useState(true);
  const [launchDate, setLaunchDate] = useState("");
  const [dateGuess, setDateGuess] = useState(false);

  const [scan, setScan] = useState<ScanState>("idle");
  const [scanRow, setScanRow] = useState(0);
  const [missingRows, setMissingRows] = useState<Set<number>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [scanReason, setScanReason] = useState<string>("");
  // The words copied from their page, when the link couldn't be read.
  const [pasted, setPasted] = useState("");
  const [popped, setPopped] = useState<Set<FieldKey>>(new Set());
  const [testimonials, setTestimonials] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const scanToken = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth?signup");
      return;
    }
    // Email sign-ups confirm their address first (the /auth screen).
    if (needsVerification) {
      router.replace("/auth");
      return;
    }
    getBusinessProfile(user.uid)
      .then((profile) => {
        if (hasOnboarded(profile)) router.replace("/dashboard");
        else setCheckingProfile(false);
      })
      .catch(() => setCheckingProfile(false));
  }, [authLoading, user, needsVerification, router]);

  // Step 1's placeholder types out example offers, so a beginner sees
  // what kind of answer we mean. Mirrored in the preview headline.
  useEffect(() => {
    if (step !== 0 || name) return;
    let ex = 0;
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = EXAMPLES[ex];
      if (!deleting) {
        i++;
        setTyped(word.slice(0, i));
        if (i === word.length) {
          deleting = true;
          timer = setTimeout(tick, 1500);
          return;
        }
        timer = setTimeout(tick, 70);
      } else {
        i--;
        setTyped(word.slice(0, i));
        if (i === 0) {
          deleting = false;
          ex = (ex + 1) % EXAMPLES.length;
          timer = setTimeout(tick, 300);
          return;
        }
        timer = setTimeout(tick, 35);
      }
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [step, name]);

  // A real amount (not "Free") means we need to know how they pay.
  const hasAmount = /\d/.test(price);

  function canContinue(s = step): boolean {
    if (s === 0) return name.trim().length > 0;
    if (s === 1) return true;
    if (s === 2) return who.trim().length > 0 && what.trim().length > 0 && (!hasAmount || billing !== null);
    if (s === 3) return channels.length > 0;
    if (s === 4) return !!launchDateToEvent(launchDate);
    if (s === 5) return frequency !== null;
    return true;
  }

  function next() {
    if (saving || scan === "scanning") return;
    if (!canContinue()) return;
    if (step === STEP_COUNT - 1) {
      finish();
      return;
    }
    if (step === 2) setPopped(new Set());
    setStep((s) => s + 1);
  }

  function back() {
    if (scan === "scanning") {
      scanToken.current++;
      setScan("idle");
    }
    setStep((s) => Math.max(0, s - 1));
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      next();
    }
  }

  async function runScan(override?: string) {
    const input = (override ?? page).trim();
    if (!input) return;
    const token = ++scanToken.current;
    setScan("scanning");
    setScanRow(0);
    setMissingRows(new Set());
    setPopped(new Set());

    let data: {
      ok?: boolean;
      reason?: string;
      name?: string;
      whatTheyGet?: string;
      audience?: string;
      price?: string;
      billing?: string;
      testimonials?: string[];
    } = {};
    try {
      const [res] = await Promise.all([
        authFetch("/api/analyze-offer-page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        }),
        sleep(900),
      ]);
      data = await res.json();
      if (!res.ok) data = { ok: false, reason: "error" };
    } catch {
      data = { ok: false };
    }
    if (token !== scanToken.current) return;

    if (!data.ok) {
      setScanReason(data.reason ?? "");
      setScan("failed");
      return;
    }

    const found: Record<FieldKey, string> = {
      name: (data.name ?? "").trim(),
      who: (data.audience ?? "").trim(),
      what: (data.whatTheyGet ?? "").trim(),
      price: (data.price ?? "").trim(),
    };
    const missing = new Set<number>();

    // Fill the preview one field at a time, so the user watches their
    // email write itself. The name they typed in step 1 always wins.
    for (let row = 1; row < SCAN_ROWS.length; row++) {
      await sleep(550);
      if (token !== scanToken.current) return;
      const field = SCAN_ROWS[row].field!;
      const value = found[field];
      setScanRow(row);
      if (field === "name") {
        if (value && !name.trim()) setName(value);
        if (!value) missing.add(row);
      } else if (value) {
        if (field === "who") setWho(value);
        if (field === "what") setWhat(value);
        if (field === "price") {
          const sp = splitPrice(value);
          if (sp.currency) setCurrency(sp.currency);
          // "$97/mo" -> 97, and billing is monthly. The page's own words win.
          const b = (["once", "monthly", "yearly"].includes(data.billing ?? "") ? data.billing : billingFromPrice(value)) as BillingId | null;
          if (b) setBilling(b);
          setPrice(b ? sp.amount.replace(/\s?\/\s?(mo|month|yr|year)s?$/i, "").trim() : sp.amount);
        }
      } else {
        missing.add(row);
      }
      if (value) setPopped((p) => new Set(p).add(field));
      setMissingRows(new Set(missing));
    }
    await sleep(500);
    if (token !== scanToken.current) return;
    setScanRow(SCAN_ROWS.length);
    if (Array.isArray(data.testimonials)) setTestimonials(data.testimonials.slice(0, 10));
    const anyFound = found.who || found.what || found.price || found.name;
    setScanned(!!anyFound);
    await sleep(700);
    if (token !== scanToken.current) return;
    setScan("idle");
    setStep(2);
  }

  function toggleChannel(id: PlatformId) {
    setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  useEffect(() => {
    try {
      setCurrency(defaultCurrency(navigator.language));
    } catch {}
  }, []);

  useEffect(() => {
    if (!signOffTouched.current && user?.displayName) setSignOff(firstName(user.displayName));
  }, [user]);

  async function finish() {
    if (!user || !frequency) return;
    setSaving(true);
    setError(null);
    const offer = {
      name: name.trim(),
      whatTheyGet: what.trim(),
      audience: who.trim(),
      price: joinPrice(currency, price),
      billing: hasAmount && billing ? billing : undefined,
      tone: "Friendly",
      readingLevel: "5th grade",
      fromName: signOff.trim() || undefined,
    };
    try {
      await saveBusinessProfile(user.uid, {
        ...offer,
        signOffName: signOff.trim() || undefined,
        channels,
        frequency,
        suggestedPlan: suggestedPlan(frequency),
        campaignType: launchIsLive ? launchType : LIVE_LAUNCH_TYPE,
        wantedType: !launchIsLive ? launchType : undefined,
        notifyWhenLive: !launchIsLive ? notifyMe : undefined,
        launchDate,
        launchDateGuess: dateGuess || undefined,
        currency,
        salesPage: page.trim().slice(0, 2000) || undefined,
        onboardedAt: new Date().toISOString(),
      });
      // Best-effort extras: a failure here shouldn't stop them launching.
      try {
        await createOffer(user.uid, offer);
      } catch {}
      for (const t of testimonials) {
        try {
          await addWinningCopy(user.uid, t);
        } catch {}
      }
      // Home first: one clear card and button, then the builder.
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      setSaving(false);
    }
  }

  if (authLoading || checkingProfile) {
    return <LoadingScreen />;
  }

  // ---- preview values ----
  // Never show the login's name or email prefix ("tester22") as the sender:
  // it isn't what they'll sign emails as. Placeholder until they type one.
  const fromName = signOff.trim() || "Your name";
  const initials = signOff.trim()
    ? signOff
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    : "Y";
  const demoTyping = step === 0 && !name;
  const nameShow = name.trim() || (demoTyping ? typed : "Your offer");
  const whoShow = who.trim() || "your ideal customer";
  const whatShow = what.trim() || "What they get";
  const priceShow = price.trim()
    ? priceLabel(joinPrice(currency, price), hasAmount && billing && billing !== "once" ? billing : undefined)
    : "your price";
  const hl = (field: FieldKey, active: boolean) =>
    `cob-hl ${popped.has(field) ? "pop" : active ? "on" : ""}`;
  const ph = (empty: boolean) => (empty ? "cob-ph" : "");
  const picked = PLATFORMS.filter((p) => channels.includes(p.id));

  return (
    <div className="cob-root">
      <div className="cob-left" style={{ flexBasis: 540 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" style={{ height: 26, width: "auto" }} />
          <button onClick={() => signOut()} className="cob-link" style={{ fontSize: 15 }}>
            Sign out
          </button>
        </div>

        <div className="cob-center">
          <div style={{ width: "100%", maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, height: 28 }}>
              {step > 0 && (
                <button
                  onClick={back}
                  aria-label="Back"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, marginLeft: -6, border: 0, background: "none", color: "#6B6577", cursor: "pointer" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 12H5M11 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
              <div style={{ flex: 1, display: "flex", gap: 8 }} aria-label={`Step ${step + 1} of ${STEP_COUNT}`}>
                {Array.from({ length: STEP_COUNT }).map((_, i) => (
                  <span key={i} className={`cob-seg ${i <= step ? "on" : ""}`}>
                    <i />
                  </span>
                ))}
              </div>
            </div>

            {step === 0 && (
              <div key="s0" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">What do you sell?</h1>
                <p className="cob-sub">A course, coaching, a product or a service. Just give it a name. You can change it later.</p>
                <label htmlFor="f-name" className="cob-label">What it&apos;s called</label>
                <input
                  id="f-name"
                  autoFocus
                  className="cob-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder={typed || " "}
                  style={{ minHeight: 56, fontSize: 17 }}
                />
                <p className="cob-hint">For example: &ldquo;Beginner Yoga Course&rdquo;, &ldquo;Business Coaching&rdquo; or &ldquo;Summer Candle Sale&rdquo;.</p>
                <button className="cob-btn" onClick={next} disabled={!canContinue()} style={{ marginTop: 24 }}>
                  Continue
                  <Arrow />
                </button>
              </div>
            )}

            {step === 1 && (
              <div key="s1" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">Do you have a sales page?</h1>
                <p className="cob-sub">Or a website, or even your link in bio. Paste the link, or copy and paste the words. We&apos;ll fill in the rest.</p>
                <label htmlFor="f-page" className="cob-label">Link, or words from the page</label>
                <textarea
                  id="f-page"
                  autoFocus
                  className="cob-area"
                  value={page}
                  disabled={scan === "scanning"}
                  onChange={(e) => {
                    setPage(e.target.value);
                    if (scan === "failed") setScan("idle");
                  }}
                  onKeyDown={(e) => {
                    // A single line (a link) submits on Enter; pasted words
                    // need Enter for new lines, so use Cmd/Ctrl+Enter.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (!e.shiftKey && page.trim() && !/\s/.test(page.trim())))) {
                      e.preventDefault();
                      runScan();
                    }
                  }}
                  placeholder="yoursite.com/your-offer"
                />

                {scan === "failed" && (
                  <div className="cob-rise" role="status" style={{ marginTop: 14, padding: "16px 18px", borderRadius: 14, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: "#7C2D12" }}>
                      <b>
                        {scanReason === "unreachable"
                          ? "We couldn't open that address."
                          : scanReason === "too_short"
                            ? "That's too short to read."
                            : "We couldn't read that page by link."}
                      </b>{" "}
                      {scanReason === "unreachable"
                        ? "Check the spelling, or use the quick way below."
                        : "Some sites keep their words hidden from us. The quick way below always works."}
                    </div>
                    <ol style={{ margin: "12px 0 0", paddingLeft: 20, fontSize: 15, lineHeight: 1.6, color: "#7C2D12" }}>
                      <li>Open your sales page in another tab.</li>
                      <li>Select everything: <b>Ctrl+A</b> (Mac: <b>Cmd+A</b>), then copy: <b>Ctrl+C</b> (Mac: <b>Cmd+C</b>).</li>
                      <li>Paste it here: <b>Ctrl+V</b> (Mac: <b>Cmd+V</b>).</li>
                    </ol>
                    <textarea
                      id="f-pasted"
                      className="cob-area"
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      placeholder="Paste the words from your page here"
                      style={{ marginTop: 12, minHeight: 130, background: "#FFFFFF" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
                      <button className="cob-btn" onClick={() => runScan(pasted)} disabled={pasted.trim().length < 40}>
                        Fill it in from this
                        <Arrow />
                      </button>
                      <button type="button" onClick={() => setStep(2)} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: 700, color: "#7C2D12", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
                        Continue without it
                      </button>
                    </div>
                  </div>
                )}

                {scan !== "scanning" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24, flexWrap: "wrap" }}>
                    <button className="cob-btn" onClick={() => runScan()} disabled={!page.trim()}>
                      Fill it in for me
                      <Arrow />
                    </button>
                    <button className="cob-link" onClick={() => setStep(2)}>
                      I don&apos;t have one
                    </button>
                  </div>
                )}

                {scan === "scanning" && (
                  <div className="cob-rise" role="status" aria-live="polite" style={{ marginTop: 22, padding: "16px 18px", borderRadius: 16, border: "1px solid #ECEAF0", background: "#FAF9FC", display: "grid", gap: 10 }}>
                    {SCAN_ROWS.map((r, i) => {
                      const done = i < scanRow || (i === scanRow && scanRow === SCAN_ROWS.length);
                      const active = i === scanRow;
                      const miss = missingRows.has(i);
                      return (
                        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, color: done || active ? (miss ? "#6B6577" : "#17131F") : "#A39DAD" }}>
                          {done || (active && miss) ? (
                            miss ? (
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #D4D1DB", color: "#A39DAD", fontSize: 12, fontWeight: 700 }}>–</span>
                            ) : (
                              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)", color: "#FFFFFF" }}>
                                <Check size={11} />
                              </span>
                            )
                          ) : active ? (
                            <SpinIcon size={20} />
                          ) : (
                            <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #D4D1DB" }} />
                          )}
                          <span>{miss ? r.missing : r.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div key="s2" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">Who&apos;s your ideal customer?</h1>
                <p className="cob-sub">One line is all it takes. Plain words are perfect.</p>
                {scanned && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, padding: "6px 12px", borderRadius: 999, background: "#F1EAFD", color: "#5B21B6", fontSize: 13, fontWeight: 600 }}>
                    <Check size={13} />
                    Found on your page. Change anything.
                  </div>
                )}
                <label htmlFor="f-who" className="cob-label" style={{ marginTop: 22, marginBottom: 6 }}>Your ideal customer, in one line</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }} aria-hidden="true">
                  {["Who they are", "What they want", "What's in the way"].map((t, i) => (
                    <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && <span style={{ color: "#B5B0BF", fontSize: 13 }}>{i === 2 ? "but" : "who want"}</span>}
                      <span style={{ padding: "3px 10px", borderRadius: 999, background: "#F1EAFD", color: "#5B21B6", fontSize: 12.5, fontWeight: 600 }}>{t}</span>
                    </span>
                  ))}
                </div>
                <textarea
                  id="f-who"
                  autoFocus
                  rows={2}
                  className="cob-area"
                  value={who}
                  onChange={(e) => setWho(e.target.value.replace(/\n/g, " "))}
                  onKeyDown={onEnter}
                  placeholder={WHO_EXAMPLES[0]}
                  style={{ minHeight: 76, resize: "none" }}
                />
                {whoIsThin(who) ? (
                  <p className="cob-hint" role="status" style={{ color: "#9A3412" }}>
                    A bit short. Add what they want and what&apos;s in the way, like: &ldquo;{WHO_EXAMPLES[0]}&rdquo;.
                  </p>
                ) : (
                  !who.trim() && <p className="cob-hint">For example: &ldquo;{WHO_EXAMPLES[1]}&rdquo;.</p>
                )}
                <label htmlFor="f-what" className="cob-label" style={{ marginTop: 20 }}>What they get</label>
                <input id="f-what" className="cob-field" value={what} onChange={(e) => setWhat(e.target.value)} onKeyDown={onEnter} placeholder="Done-for-you ads, or we keep working free" />
                <label htmlFor="f-price" className="cob-label" style={{ marginTop: 16 }}>
                  Price <span className="cob-opt-tag">optional</span>
                </label>
                <div style={{ display: "flex", gap: 8, maxWidth: 320 }}>
                  <div style={{ width: 132, flexShrink: 0 }}>
                    <CurrencyPicker value={currency} onChange={setCurrency} className="cob-field" />
                  </div>
                  <input id="f-price" className="cob-field" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={onEnter} placeholder="997" style={{ minWidth: 0 }} />
                </div>
                {hasAmount && (
                  <div className="cob-rise">
                    <div className="cob-label" style={{ marginTop: 16, marginBottom: 8 }}>How do they pay?</div>
                    <div role="radiogroup" aria-label="How do they pay?" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {BILLING_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={billing === o.id}
                          className={`cob-chipbtn ${billing === o.id ? "on" : ""}`}
                          onClick={() => setBilling(o.id)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label htmlFor="f-signoff" className="cob-label" style={{ marginTop: 16 }}>
                  Sign emails as <span className="cob-opt-tag">optional</span>
                </label>
                <input
                  id="f-signoff"
                  className="cob-field"
                  value={signOff}
                  onChange={(e) => {
                    signOffTouched.current = true;
                    setSignOff(e.target.value);
                  }}
                  onKeyDown={onEnter}
                  placeholder="Your first name, or your brand"
                  style={{ maxWidth: 320 }}
                />
                <div>
                  <button className="cob-btn" onClick={next} disabled={!canContinue()} style={{ marginTop: 24 }}>
                    Continue
                    <Arrow />
                  </button>
                  {!canContinue() && (
                    <p className="cob-hint" role="status">
                      {!who.trim() && !what.trim()
                        ? "Fill in your ideal customer and what they get to continue."
                        : !who.trim()
                          ? "Fill in your ideal customer to continue."
                          : !what.trim()
                            ? "Fill in what they get to continue."
                            : "Pick how they pay to continue."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div key="s3" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">Where do you reach your customers?</h1>
                <p className="cob-sub">Pick all that apply. We&apos;ll write for each one.</p>
                <div className="cob-tiles">
                  {PLATFORMS.map((p) => {
                    const on = channels.includes(p.id);
                    return (
                      <button key={p.id} type="button" className={`cob-tile ${on ? "on" : ""}`} onClick={() => toggleChannel(p.id)} aria-pressed={on}>
                        <span className="cob-tick">
                          <Check size={10} />
                        </span>
                        <span className="cob-ic">
                          <PlatformIcon icon={p.icon} size={36} />
                        </span>
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
                  <button className="cob-btn" onClick={next} disabled={!canContinue()}>
                    Continue
                    <Arrow />
                  </button>
                  <span style={{ fontSize: 14, color: "#6B6577" }}>
                    {channels.length === 0 ? "Pick at least one" : `${channels.length} picked`}
                  </span>
                </div>
              </div>
            )}

            {step === 4 && (
              <div key="s4" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">What are you launching?</h1>
                <p className="cob-sub">Pick the one that fits. You can run more later.</p>
                <div className="cob-opts" style={{ gridTemplateColumns: "1fr" }}>
                  {LAUNCH_TYPE_IDS.map((id) => {
                    const entry = catalog.find((c) => c.id === id);
                    if (!entry) return null;
                    const live = entry.status === "available";
                    return (
                      <button key={id} type="button" className={`cob-opt ${launchType === id ? "on" : ""}`} onClick={() => setLaunchType(id)} aria-pressed={launchType === id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16, fontWeight: 600 }}>{id === LIVE_LAUNCH_TYPE ? "Webinar or live training" : entry.title}</span>
                          <span className={live ? "cob-badge live" : "cob-badge"}>{live ? "Live now" : "Coming soon"}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#6B6577", marginTop: 2 }}>
                          {id === LIVE_LAUNCH_TYPE ? "A free training, call or live demo that leads to a sale. Works for courses, coaching and services." : entry.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {!launchIsLive && (
                  <div className="cob-rise" role="status" style={{ marginTop: 14, padding: "14px 16px", borderRadius: 14, background: "#F6F1FE", border: "1px solid #E4D6FA", fontSize: 15, lineHeight: 1.5, color: "#3D2A66" }}>
                    <b>We&apos;re still building this one.</b> To get you started today, we&apos;ll set you up with a webinar launch. It works for any offer you sell with a free training or call.
                    <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, fontSize: 14, cursor: "pointer" }}>
                      <input type="checkbox" checked={notifyMe} onChange={(e) => setNotifyMe(e.target.checked)} style={{ width: 18, height: 18 }} />
                      Tell me when it&apos;s ready
                    </label>
                  </div>
                )}

                <label className="cob-label" style={{ marginTop: 26 }}>When does it go live?</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Next week", days: 8 },
                    { label: "In 2 weeks", days: 15 },
                    { label: "In a month", days: 30 },
                  ].map((o) => {
                    const v = launchDateInDays(o.days);
                    return (
                      <button
                        key={o.label}
                        type="button"
                        className={`cob-chipbtn ${launchDate === v && !dateGuess ? "on" : ""}`}
                        onClick={() => {
                          setLaunchDate(v);
                          setDateGuess(false);
                        }}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                  <input
                    type="date"
                    aria-label="Pick a date"
                    className="cob-field"
                    min={launchDateInDays(0)}
                    value={launchDate}
                    onChange={(e) => {
                      setLaunchDate(e.target.value);
                      setDateGuess(false);
                    }}
                    style={{ width: 170, minHeight: 44 }}
                  />
                </div>
                <button
                  type="button"
                  className="cob-link"
                  style={{ marginTop: 8, fontSize: 15, minHeight: 36 }}
                  onClick={() => {
                    setLaunchDate(launchDateInDays(15));
                    setDateGuess(true);
                  }}
                >
                  I&apos;m not sure yet
                </button>
                {launchDate && launchDateToEvent(launchDate) && (
                  <p className="cob-hint" role="status">
                    {dateGuess ? "We'll plan for " : "Goes live "}
                    <b>{launchDateToEvent(launchDate)!.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, 7:00 PM</b>
                    {dateGuess ? ". You can change it any time." : "."}
                    {daysUntil(launchDate) < 7 && " That's soon. The first posts would be dated in the past, so a date a week or more away works best."}
                  </p>
                )}

                <button className="cob-btn" onClick={next} disabled={!canContinue()} style={{ marginTop: 22 }}>
                  Continue
                  <Arrow />
                </button>
                {!canContinue() && <p className="cob-hint" role="status">Pick a date, or tap &ldquo;I&apos;m not sure yet&rdquo;.</p>}
              </div>
            )}

            {step === 5 && (
              <div key="s5" className="cob-rise" style={{ marginTop: 36 }}>
                <h1 className="cob-h1">How often do you run a sale or promo?</h1>
                <p className="cob-sub">We&apos;ll suggest the plan that fits. You can change it anytime.</p>
                <div className="cob-opts">
                  {FREQUENCIES.map((f) => (
                    <button key={f.id} type="button" className={`cob-opt ${frequency === f.id ? "on" : ""}`} onClick={() => setFrequency(f.id)} aria-pressed={frequency === f.id}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{f.label}</div>
                      <div style={{ fontSize: 13, color: "#6B6577", marginTop: 2 }}>{f.sub}</div>
                    </button>
                  ))}
                </div>
                {error && (
                  <div role="alert" style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#7C2D12", fontSize: 15 }}>
                    {error}
                  </div>
                )}
                <button className="cob-btn cob-btn-grad" onClick={next} disabled={!canContinue() || saving} style={{ marginTop: 24 }}>
                  {saving && <SpinIcon size={18} color="#FFFFFF" />}
                  {saving ? "Setting up..." : "Finish setup"}
                  {!saving && <Arrow />}
                </button>
                <p className="cob-hint" style={{ marginTop: 12 }}>
                  Takes about a minute. Your emails, texts and posts write themselves while you watch.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- live preview ---- */}
      <div className="cob-right" style={{ padding: "112px 56px 56px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 16, color: "#6B6577" }}>Your first email, as your customers see it</span>
            {scan === "scanning" && (
              <span className="cob-rise" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#6D28D9" }}>
                <SpinIcon size={13} color="currentColor" />
                Filling in
              </span>
            )}
          </div>

          <div style={{ marginTop: 18, background: "#FFFFFF", border: "1px solid #ECEAF0", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #F0EEF4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 500 }}>
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, border: "1px solid #ECEAF0" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                Inbox
              </div>
              <span className="cob-bump" style={{ fontSize: 14, color: "#6B6577" }}>3</span>
            </div>
            <div className="cob-arrive" style={{ display: "flex", gap: 14, padding: "18px 20px", borderBottom: "1px solid #F0EEF4" }}>
              <Avatar initials={initials} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className={signOff.trim() ? "" : "cob-ph"} style={{ fontWeight: 700, fontSize: 15 }}>{fromName}</span>
                  <span style={{ fontSize: 13, color: "#6B6577" }}>9:00 AM</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  You&apos;re invited: <span className={`${hl("name", step === 0)} ${ph(!name.trim())}`}>{nameShow}</span>
                </div>
                <div style={{ fontSize: 14, color: "#6B6577", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span className={`${hl("who", step === 2)} ${ph(!who.trim())}`}>For {whoShow}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: "1px solid #F0EEF4", opacity: 0.7 }}>
              <span style={{ width: 42, height: 42, borderRadius: "50%", background: "#F2F1F5" }} />
              <div style={{ flex: 1, display: "grid", gap: 8, alignContent: "center" }}>
                <span style={{ height: 9, width: "40%", borderRadius: 5, background: "#F2F1F5" }} />
                <span style={{ height: 9, width: "75%", borderRadius: 5, background: "#F2F1F5" }} />
              </div>
            </div>
            <div style={{ height: 70 }} />
          </div>

          <div className="cob-floatin" style={{ position: "relative", margin: "-86px 0 0 48px", background: "#FFFFFF", border: "1px solid #ECEAF0", borderRadius: 20, boxShadow: "0 40px 80px -40px rgba(23,19,31,.35)", padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid #F0EEF4" }}>
              <Avatar initials={initials} size={36} />
              <span className={signOff.trim() ? "" : "cob-ph"} style={{ fontSize: 15, fontWeight: 500 }}>{fromName}</span>
            </div>
            <div style={{ fontFamily: "Newsreader, serif", fontWeight: 500, fontSize: 34, letterSpacing: "-.025em", lineHeight: 1.1, marginTop: 18, minHeight: 38 }}>
              <span className={`${hl("name", step === 0)} ${ph(!name.trim())}`}>{nameShow}</span>
              {demoTyping && <span className="cob-caret" />}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3D3747", margin: "12px 0 0" }}>Hey there,</p>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3D3747", margin: "6px 0 0" }}>
              <span className={`${hl("what", step === 2)} ${ph(!what.trim())}`}>{whatShow}</span>. All for{" "}
              <span className={`${hl("price", step === 2)} ${ph(!price.trim())}`}>{priceShow}</span>.
            </p>
            <span style={{ display: "inline-flex", alignItems: "center", marginTop: 16, padding: "10px 16px", borderRadius: 10, background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)", color: "#FFFFFF", fontSize: 14, fontWeight: 700 }}>
              Save my seat
            </span>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#3D3747", margin: "14px 0 0" }}>
              Talk soon,
              <br />
              <span className={`cob-hl ${step === 2 ? "on" : ""} ${signOff.trim() ? "" : "cob-ph"}`}>{signOff.trim() || "Your name"}</span>
            </p>
            <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
              <span style={{ height: 8, width: "100%", borderRadius: 4, background: "#F2F1F5" }} />
              <span style={{ height: 8, width: "82%", borderRadius: 4, background: "#F2F1F5" }} />
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #F0EEF4" }}>
              <div style={{ fontSize: 12, color: "#6B6577", marginBottom: 8 }}>Also going out on</div>
              <div className={`cob-chips ${step === 3 ? "on" : ""}`} style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 26 }}>
                {picked.map((p) => (
                  <span key={p.id} className="cob-chip cob-rise">
                    <PlatformIcon icon={p.icon} size={15} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformIcon({ icon, size }: { icon: string | null; size: number }) {
  if (!icon) {
    // SMS has no brand logo, so a green message bubble.
    return (
      <span className="cob-sms" style={{ width: size, height: size, borderRadius: size > 20 ? 10 : 4 }}>
        {size > 20 && (
          <svg width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 4C7 4 3 7.4 3 11.5c0 2.2 1.1 4.1 2.9 5.5L5 20.5l4-2c.9.3 1.9.4 3 .4 5 0 9-3.4 9-7.5S17 4 12 4z" />
          </svg>
        )}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local /public asset
  return <img src={icon} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0, borderRadius: "50%", background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)", color: "#FFFFFF", fontSize: Math.round(size * 0.33), fontWeight: 700 }}>
      {initials}
    </span>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Check({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function SpinIcon({ size, color = "#9B1FD6" }: { size: number; color?: string }) {
  return (
    <svg className="cob-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}
