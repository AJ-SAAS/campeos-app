"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/firebase/businessProfile";
import { addWinningCopy, addSalesCall } from "@/lib/firebase/library";

// The mailcheap.ai-style onboarding wizard — one short question at a
// time, right after sign-up, before the dashboard. Mirrors their step
// list (newsletter name -> what it's about -> who it's from -> existing
// subscribers + where to import them) mapped onto Campeos's own offer
// fields (OfferContext, see lib/ai/prompts.ts): name -> what they get ->
// audience -> price -> optional winning-copy/sales-call import, using
// the same library.ts functions the builder's "What already works" /
// "Why people buy" panels already use.
//
// Finishing writes a businessProfiles/{uid} doc (lib/firebase/businessProfile.ts).
// useRequireAccess treats that doc's existence as "onboarding done" —
// that's the only thing gating a page, not a subscription (see that
// file's comment).
const STEPS = ["name", "whatTheyGet", "audience", "price", "import"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState("");
  const [whatTheyGet, setWhatTheyGet] = useState("");
  const [audience, setAudience] = useState("");
  const [price, setPrice] = useState("");
  const [importKind, setImportKind] = useState<"copy" | "call">("copy");
  const [importText, setImportText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    // Already finished onboarding (e.g. came back here by hand) -> the
    // dashboard is where this goes, not another round of questions.
    getBusinessProfile(user.uid).then((profile) => {
      if (profile) {
        router.replace("/dashboard");
      } else {
        setCheckingProfile(false);
      }
    });
  }, [authLoading, user, router]);

  const step: Step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  function canContinue(): boolean {
    if (step === "name") return name.trim().length > 0;
    if (step === "whatTheyGet") return whatTheyGet.trim().length > 0;
    if (step === "audience") return audience.trim().length > 0;
    if (step === "price") return price.trim().length > 0;
    return true;
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await saveBusinessProfile(user.uid, {
        name: name.trim(),
        whatTheyGet: whatTheyGet.trim(),
        audience: audience.trim(),
        price: price.trim(),
        tone: "Friendly",
        readingLevel: "5th grade",
      });

      const text = importText.trim();
      if (text) {
        if (importKind === "copy") {
          await addWinningCopy(user.uid, text);
        } else {
          const res = await fetch("/api/analyze-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: text }),
          });
          const data = await res.json();
          if (res.ok) {
            await addSalesCall(user.uid, text, data.themes ?? []);
          }
          // A failed analysis here isn't worth blocking onboarding over —
          // they can paste it again from /buyer-insights any time.
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Try again.");
      setSaving(false);
    }
  }

  function handleContinue() {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  if (authLoading || checkingProfile) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="min-h-screen bg-paper text-slate font-body flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" className="h-6 w-auto object-contain" />
        </div>
        <button onClick={() => signOut()} className="text-xs text-muted font-medium">
          Sign out
        </button>
      </div>

      <div className="flex-grow flex items-start sm:items-center justify-center px-6 py-10">
        <div className="w-full max-w-[460px] flex flex-col gap-7">
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                aria-label="Back"
                className="text-muted shrink-0"
              >
                <BackArrow />
              </button>
            )}
            <div className="flex-grow flex gap-1.5">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-grow rounded-full ${i <= stepIndex ? "bg-slate" : "bg-line"}`}
                />
              ))}
            </div>
          </div>

          {step === "name" && (
            <QuestionStep
              title="What's your offer called?"
              hint="You can change it later."
              value={name}
              onChange={setName}
              placeholder="Fall Reset Program"
              multiline={false}
            />
          )}

          {step === "whatTheyGet" && (
            <QuestionStep
              title="What do they get?"
              hint="What's actually included — the thing you're selling."
              value={whatTheyGet}
              onChange={setWhatTheyGet}
              placeholder="A guided 3-step plan and weekly coaching calls"
              multiline
            />
          )}

          {step === "audience" && (
            <QuestionStep
              title="Who's it for?"
              hint="Who you're writing to — be specific."
              value={audience}
              onChange={setAudience}
              placeholder="People who want a fresh start this fall"
              multiline
            />
          )}

          {step === "price" && (
            <QuestionStep
              title="What's the price?"
              hint="Campeos writes the offer the way you'll actually sell it."
              value={price}
              onChange={setPrice}
              placeholder="$3,000"
              multiline={false}
            />
          )}

          {step === "import" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-[26px] font-extrabold tracking-tight">
                  Have anything that already works?
                </h1>
                <p className="text-sm text-muted">
                  A headline, ad, or email that converted, or a sales call transcript. Optional —
                  every campaign draws on this automatically once it's in your library.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportKind("copy")}
                  className={`flex-1 text-sm font-semibold py-2.5 rounded-xl border ${
                    importKind === "copy" ? "border-clay bg-agentWash" : "border-line bg-paper"
                  }`}
                >
                  Winning copy
                </button>
                <button
                  type="button"
                  onClick={() => setImportKind("call")}
                  className={`flex-1 text-sm font-semibold py-2.5 rounded-xl border ${
                    importKind === "call" ? "border-clay bg-agentWash" : "border-line bg-paper"
                  }`}
                >
                  Sales call
                </button>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder={
                  importKind === "copy"
                    ? "Paste a headline, subject line, or ad line that already worked..."
                    : "Paste the call transcript here..."
                }
                className="px-3.5 py-3 rounded-xl border border-line bg-paper text-sm resize-none focus-visible:outline-clay"
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm leading-snug">{error}</div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleContinue}
              disabled={!canContinue() || saving}
              className="min-h-12 px-6 rounded-xl bg-gradient-to-r from-clay to-pink text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? "Setting up..." : isLast ? "Go to dashboard" : "Continue"}
            </button>
            {isLast && !importText.trim() && (
              <span className="text-sm text-muted">Nothing to add — that&apos;s fine, skip ahead.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionStep({
  title,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {multiline ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="px-3.5 py-3 rounded-xl border border-line bg-paper text-base resize-none focus-visible:outline-clay"
        />
      ) : (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 px-3.5 rounded-xl border border-line bg-paper text-base focus-visible:outline-clay"
        />
      )}
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
