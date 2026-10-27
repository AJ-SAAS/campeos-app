"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { Mascot } from "@/components/mascot/Mascot";
import { SettingUp } from "@/components/onboarding/SettingUp";
import "@/components/onboarding/onboarding.css";
import { AGENT_NAME } from "@/lib/brand";
import { burstConfetti } from "@/lib/confetti";
import type { OrbMood } from "@/lib/mascot/orb";
import type { OfferContext } from "@/lib/ai/prompts";
import { Offer, createOffer, listOffers } from "@/lib/firebase/offers";
import {
  BILLING_OPTIONS,
  WHO_EXAMPLES,
  defaultCurrency,
  launchDateInDays,
  launchDateToEvent,
  whoIsThin,
} from "@/lib/onboarding/answers";
import { remainingDwell } from "@/lib/onboarding/setupSteps";
import {
  WIZARD_STEPS,
  WizardAnswers,
  applySavedOffer,
  campaignStages,
  goLiveSummary,
  hasAmount,
  offerFromAnswers,
  wizardCanContinue,
  wizardHint,
  wizardProgress,
} from "@/lib/builder/wizard";

// The questions for a new campaign: which offer, who it's for, and when it
// goes live. Same look as onboarding (and the same currency picker), minus
// the preview panel. A timeline across the top shows where you are; the
// arrow always goes back one screen, and from the first screen back to the
// list of campaigns. When the last answer is in, Eos "sets up" the campaign
// on a full-screen view, and only then does the builder open, with the
// offer and the go-live date already in place.

const GREETER: { mood: OrbMood; say: string }[] = [
  { mood: "idle", say: "Which offer is this campaign for? Pick one you've saved, or tell me about a new one." },
  { mood: "happy", say: "Now tell me who it's for and what they get. Plain words work best." },
  { mood: "wink", say: "Last one! When does it go live? I'll lay out every post around that day." },
];

const TONES = ["Friendly", "Bold", "Calm"];
const LEVELS = ["5th grade", "7th grade", "9th grade", "Professional"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CampaignWizardDefaults {
  currency?: string;
  fromName?: string;
  /** yyyy-mm-dd, e.g. from a "Plan it" link on a big sales date. */
  goLive?: string;
}

export function CampaignWizard({
  uid,
  templateName,
  defaults,
  backHref,
  onDone,
}: {
  uid: string;
  /** "48 Hour Flash Sale": named on the screen so you know what you're setting up. */
  templateName: string;
  defaults: CampaignWizardDefaults;
  /** Where the arrow on the first screen goes. */
  backHref: string;
  onDone: (offer: OfferContext, goLive: Date) => void;
}) {
  const [step, setStep] = useState(0);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  // Typing in a new offer. Starts on when there is nothing saved to pick.
  const [creating, setCreating] = useState(false);
  const [a, setA] = useState<WizardAnswers>(() => ({
    savedOfferId: null,
    name: "",
    currency: defaults.currency || defaultCurrency(typeof navigator !== "undefined" ? navigator.language : ""),
    price: "",
    billing: null,
    audience: "",
    whatTheyGet: "",
    fromName: defaults.fromName ?? "",
    tone: "Friendly",
    readingLevel: "5th grade",
    goLive: defaults.goLive ?? "",
  }));
  const set = <K extends keyof WizardAnswers>(k: K, v: WizardAnswers[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const [finishing, setFinishing] = useState(false);
  const [stage, setStage] = useState(0);
  const [done, setDone] = useState(false);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    listOffers(uid)
      .then((list) => {
        if (!live) return;
        setOffers(list);
        if (list.length === 0) setCreating(true);
      })
      .catch(() => {
        if (!live) return;
        setOffers([]);
        setCreating(true);
      });
    return () => {
      live = false;
    };
  }, [uid]);

  const nothingChosen = step === 0 && !a.savedOfferId && !creating;
  const canContinue = !nothingChosen && wizardCanContinue(step, a);
  const last = step === WIZARD_STEPS.length - 1;
  const greeter = GREETER[Math.min(step, GREETER.length - 1)];

  function next() {
    if (!canContinue || finishing) return;
    if (last) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      next();
    }
  }

  function pickSaved(o: Offer) {
    setCreating(false);
    setA((prev) => applySavedOffer(prev, o));
  }

  function startNew() {
    setCreating(true);
    setA((prev) => ({ ...prev, savedOfferId: null, name: "", price: "", billing: null, audience: "", whatTheyGet: "" }));
  }

  // Each stage names real work, and stays up long enough to read.
  async function finish() {
    const offer = offerFromAnswers(a);
    const date = launchDateToEvent(a.goLive);
    if (!date) return;
    const newOffer = !a.savedOfferId;
    setStage(0);
    setDone(false);
    setFinishing(true);
    const run = async (i: number, work: () => Promise<void>) => {
      setStage(i);
      const started = Date.now();
      await work();
      const wait = remainingDwell(started, Date.now());
      if (wait > 0) await sleep(wait);
    };
    // A new offer is saved to their list too. If that fails, the campaign still goes ahead.
    await run(0, async () => {
      if (!newOffer) return;
      try {
        // Don't wait forever on a bad connection: the campaign goes ahead either way.
        await Promise.race([createOffer(uid, offer), sleep(4000)]);
      } catch {}
    });
    await run(1, async () => {});
    await run(2, async () => {});
    await run(3, async () => {});
    setDone(true);
    burstConfetti(orbRef.current);
    await sleep(1300);
    onDone(offer, date);
  }

  const stages = campaignStages({ templateName, offerName: a.name, newOffer: !a.savedOfferId });
  const goLiveText = goLiveSummary(a.goLive);

  return (
    <div className="cob-root" style={{ display: "block", height: "100dvh", overflowY: "auto" }}>
      {finishing && (
        <SettingUp
          ref={orbRef}
          stages={stages}
          active={stage}
          done={done}
          title={`${AGENT_NAME} is building your campaign`}
          sub="Sit tight while I get everything in place."
          doneTitle="Your campaign is ready"
          doneSub="Opening your schedule..."
        />
      )}
      <div className="cob-left" style={{ minHeight: "100%", padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1040, width: "100%", margin: "0 auto" }}>
          <Link href="/dashboard" aria-label="Campeos home">
            {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
            <img src="/logo-lockup.png" alt="Campeos" style={{ height: 26, width: "auto" }} />
          </Link>
          <Link href="/dashboard" className="cob-link" style={{ fontSize: 15, display: "inline-flex", alignItems: "center" }}>
            Cancel
          </Link>
        </div>

        <div className="cob-center" style={{ alignItems: "flex-start", paddingTop: 36 }}>
          <div style={{ width: "100%", maxWidth: 520 }}>
            {/* Back, always visible: one screen back, or out to the list of campaigns. */}
            {step === 0 ? (
              <Link href={backHref} className="cob-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, minHeight: 32 }}>
                <BackArrow />
                Choose a different campaign
              </Link>
            ) : (
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="cob-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, minHeight: 32 }}>
                <BackArrow />
                Back
              </button>
            )}

            <div style={{ marginTop: 18 }}>
              <div
                className="cob-tl"
                role="progressbar"
                aria-label={`Step ${step + 1} of ${WIZARD_STEPS.length}`}
                aria-valuemin={1}
                aria-valuemax={WIZARD_STEPS.length}
                aria-valuenow={step + 1}
              >
                <div className="cob-tl-track" aria-hidden="true">
                  <div className="cob-tl-fill" style={{ transform: `scaleX(${wizardProgress(step, finishing)})` }} />
                </div>
                {WIZARD_STEPS.map((s, i) => {
                  const state = finishing || i < step ? "done" : i === step ? "now" : "";
                  return (
                    <div key={s.id} className="cob-tl-node">
                      <div className={`cob-tl-dot ${state}`}>
                        {state === "done" ? (
                          <svg className="cob-tl-check" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className="cob-tl-label">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14 }}>
              <Mascot size={144} fit={1.05} glow={false} mood={greeter.mood} hopKey={step} follow label={AGENT_NAME} style={{ margin: "-50px -22px -18px -34px" }} />
              <div
                aria-live="polite"
                style={{ position: "relative", flex: 1, minWidth: 0, padding: "11px 15px", borderRadius: 16, background: "#F6F1FF", border: "1px solid #E4D9FA", color: "#2A1F4D", fontSize: 15, lineHeight: 1.4 }}
              >
                <span
                  aria-hidden="true"
                  style={{ position: "absolute", left: -6, top: "50%", width: 11, height: 11, marginTop: -6, background: "#F6F1FF", borderLeft: "1px solid #E4D9FA", borderBottom: "1px solid #E4D9FA", transform: "rotate(45deg)" }}
                />
                {greeter.say}
              </div>
            </div>

            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: "#7C3AED" }}>{templateName}</div>

            {step === 0 && (
              <div key="s0" className="cob-rise" style={{ marginTop: 14 }}>
                <h1 className="cob-h1">Which offer is this for?</h1>
                <p className="cob-sub">Campeos writes every post from these details.</p>

                {offers === null && (
                  <div style={{ display: "grid", gap: 10, marginTop: 26 }} aria-label="Loading your saved offers">
                    <div className="cob-skel" />
                    <div className="cob-skel" style={{ minHeight: 56 }} />
                  </div>
                )}

                {offers !== null && offers.length > 0 && (
                  <div role="radiogroup" aria-label="Saved offers" className="cob-opts" style={{ gridTemplateColumns: "1fr", marginTop: 26 }}>
                    {offers.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={a.savedOfferId === o.id}
                        className={`cob-opt ${a.savedOfferId === o.id ? "on" : ""}`}
                        onClick={() => pickSaved(o)}
                      >
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{o.name || "Untitled offer"}</span>
                        <div style={{ fontSize: 13, color: "#6B6577", marginTop: 2 }}>{[o.price, o.audience].filter(Boolean).join(" · ")}</div>
                      </button>
                    ))}
                    <button type="button" className={`cob-opt add ${creating ? "on" : ""}`} onClick={startNew} aria-pressed={creating} style={{ minHeight: 56 }}>
                      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                      New offer
                    </button>
                  </div>
                )}

                {creating && (
                  <div className="cob-rise">
                    <label htmlFor="w-name" className="cob-label">Product or offer name</label>
                    <input
                      id="w-name"
                      autoFocus
                      className="cob-field"
                      value={a.name}
                      onChange={(e) => set("name", e.target.value)}
                      onKeyDown={onEnter}
                      placeholder="Beginner Yoga Course"
                      style={{ minHeight: 56, fontSize: 17 }}
                    />
                    <p className="cob-hint">The name you give it, like a course title. It shows at the top of your campaign.</p>
                    <label htmlFor="w-price" className="cob-label" style={{ marginTop: 18 }}>
                      Price <span className="cob-opt-tag">optional</span>
                    </label>
                    <div style={{ display: "flex", gap: 8, maxWidth: 320 }}>
                      <div style={{ width: 132, flexShrink: 0 }}>
                        <CurrencyPicker value={a.currency} onChange={(v) => set("currency", v)} className="cob-field" />
                      </div>
                      <input id="w-price" className="cob-field" inputMode="decimal" value={a.price} onChange={(e) => set("price", e.target.value)} onKeyDown={onEnter} placeholder="997" style={{ minWidth: 0 }} />
                    </div>
                    {hasAmount(a.price) && (
                      <div className="cob-rise">
                        <div className="cob-label" style={{ marginTop: 16, marginBottom: 8 }}>How do they pay?</div>
                        <div role="radiogroup" aria-label="How do they pay?" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {BILLING_OPTIONS.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              role="radio"
                              aria-checked={a.billing === o.id}
                              className={`cob-chipbtn ${a.billing === o.id ? "on" : ""}`}
                              onClick={() => set("billing", o.id)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div key="s1" className="cob-rise" style={{ marginTop: 14 }}>
                <h1 className="cob-h1">Who&apos;s it for?</h1>
                <p className="cob-sub">One line is all it takes. Plain words are perfect.</p>
                <label htmlFor="w-who" className="cob-label" style={{ marginTop: 22, marginBottom: 6 }}>Your ideal customer, in one line</label>
                <textarea
                  id="w-who"
                  autoFocus
                  rows={2}
                  className="cob-area"
                  value={a.audience}
                  onChange={(e) => set("audience", e.target.value.replace(/\n/g, " "))}
                  onKeyDown={onEnter}
                  placeholder={WHO_EXAMPLES[0]}
                  style={{ minHeight: 76, resize: "none" }}
                />
                {whoIsThin(a.audience) ? (
                  <p className="cob-hint" role="status" style={{ color: "#9A3412" }}>
                    A bit short. Add what they want and what&apos;s in the way, like: &ldquo;{WHO_EXAMPLES[0]}&rdquo;.
                  </p>
                ) : (
                  !a.audience.trim() && <p className="cob-hint">For example: &ldquo;{WHO_EXAMPLES[1]}&rdquo;.</p>
                )}
                <label htmlFor="w-what" className="cob-label" style={{ marginTop: 20 }}>What they get</label>
                <input id="w-what" className="cob-field" value={a.whatTheyGet} onChange={(e) => set("whatTheyGet", e.target.value)} onKeyDown={onEnter} placeholder="Done-for-you ads, or we keep working free" />

                <div className="cob-label" style={{ marginTop: 20, marginBottom: 8 }}>How should it sound?</div>
                <div role="radiogroup" aria-label="Tone" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TONES.map((t) => (
                    <button key={t} type="button" role="radio" aria-checked={a.tone === t} className={`cob-chipbtn ${a.tone === t ? "on" : ""}`} onClick={() => set("tone", t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <div role="radiogroup" aria-label="Reading level" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {LEVELS.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={a.readingLevel === l} className={`cob-chipbtn ${a.readingLevel === l ? "on" : ""}`} onClick={() => set("readingLevel", l)}>
                      {l}
                    </button>
                  ))}
                </div>

                <label htmlFor="w-from" className="cob-label" style={{ marginTop: 20 }}>
                  Sign emails as <span className="cob-opt-tag">optional</span>
                </label>
                <input id="w-from" className="cob-field" value={a.fromName} onChange={(e) => set("fromName", e.target.value)} onKeyDown={onEnter} placeholder="Your first name, or your brand" style={{ maxWidth: 320 }} />
              </div>
            )}

            {step === 2 && (
              <div key="s2" className="cob-rise" style={{ marginTop: 14 }}>
                <h1 className="cob-h1">When does it go live?</h1>
                <p className="cob-sub">Every post is scheduled around this day, before and after.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 26 }}>
                  {[
                    { label: "Next week", days: 8 },
                    { label: "In 2 weeks", days: 15 },
                    { label: "In a month", days: 30 },
                  ].map((o) => {
                    const v = launchDateInDays(o.days);
                    return (
                      <button key={o.label} type="button" className={`cob-chipbtn ${a.goLive === v ? "on" : ""}`} onClick={() => set("goLive", v)}>
                        {o.label}
                      </button>
                    );
                  })}
                  <input
                    type="date"
                    aria-label="Pick a date"
                    className="cob-field"
                    min={launchDateInDays(0)}
                    value={a.goLive}
                    onChange={(e) => set("goLive", e.target.value)}
                    style={{ width: "auto", minHeight: 44, fontSize: 15 }}
                  />
                </div>

                {goLiveText && (
                  <div className="cob-rise" role="status" style={{ marginTop: 22, padding: "16px 18px", borderRadius: 16, background: "linear-gradient(135deg,#F4EEFE,#FDEFF8)", border: "1px solid #E4D6FA" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#7C3AED" }}>Go-live</div>
                    <div style={{ fontFamily: "Newsreader,serif", fontSize: 26, fontWeight: 500, letterSpacing: "-.02em", marginTop: 2 }}>{goLiveText}</div>
                    <div style={{ fontSize: 14, color: "#5B5566", marginTop: 6, lineHeight: 1.5 }}>
                      Your {templateName} for <b style={{ color: "#17131F" }}>{a.name || "your offer"}</b> gets laid out around this day.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 26 }}>
              <button
                className={`cob-btn ${last ? "cob-btn-grad" : ""}`}
                onClick={next}
                disabled={!canContinue || finishing}
                style={{ width: "100%", maxWidth: 520 }}
              >
                {last ? "Build my campaign" : "Continue"}
                <Arrow />
              </button>
              {!canContinue && !nothingChosen && wizardHint(step, a) && (
                <p className="cob-hint" role="status">
                  {wizardHint(step, a)}
                </p>
              )}
              {nothingChosen && offers !== null && (
                <p className="cob-hint" role="status">Pick an offer, or add a new one, to continue.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
