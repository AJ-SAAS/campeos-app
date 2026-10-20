"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { PlanModal } from "@/components/PlanModal";
import { SubscribeBanner } from "@/components/SubscribeBanner";
import { OfferPicker } from "@/components/builder/OfferPicker";
import { SetupPanel } from "@/components/builder/SetupPanel";
import { UIStep } from "@/components/builder/Timeline";
import { SequenceView, statusOf } from "@/components/builder/SequenceView";
import { StepPreview } from "@/components/builder/StepPreview";
import { channelInfo, LogoStack, PlatformLogo } from "@/components/builder/channels";
import { needsInput } from "@/lib/dashboard";
import { StepEditor } from "@/components/builder/StepEditor";
import { AgentLauncher } from "@/components/agent/AgentLauncher";
import { AgentPanelCampaignStep } from "@/components/agent/AgentPanel";
import { buildTimeline, ScheduledStep } from "@/lib/engine/buildTimeline";
import { getTemplate } from "@/lib/templates";
import { OfferContext, formatForPrompt } from "@/lib/ai/prompts";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { getSubscription, isActive } from "@/lib/firebase/subscription";
import {
  createCampaign,
  getCampaignWithSteps,
  saveCampaignSkips,
  saveStepCopy,
  CampaignStepDoc,
} from "@/lib/firebase/campaigns";
import {
  addWinningCopy,
  addSalesCall,
  listWinningCopy,
  listCallThemes,
} from "@/lib/firebase/library";
import { checkAndIncrementUsage } from "@/lib/firebase/usage";
import { getBusinessProfile, saveFirstCampaignId } from "@/lib/firebase/businessProfile";
import { templateChannelsFor, CHANNEL_LABELS } from "@/lib/onboarding/answers";
import type { Channel } from "@/lib/templates/types";
import { authFetch } from "@/lib/firebase/authFetch";

// The Campaign Builder — Builder.dc.html, wired to the real engine, the
// real /api/generate-step route, and real Firestore persistence.
// New campaign: /builder — starts from the webinar template, nothing
// saved until you click "Generate campaign copy."
// Existing campaign: /builder?id=<campaignId> — loads saved steps and
// copy instead of starting fresh.
// A new campaign's event defaults to 7 PM, 8 days from today: the
// webinar template's earliest step goes out 6 days before the event, so
// this puts every step in the future with a day to spare. (This used to
// be a fixed date, which put every new campaign in the past.)
function defaultEventDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  d.setHours(19, 0, 0, 0);
  return d;
}

function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// How many steps a free account gets written. Must match FREE_STEP_LIMIT
// in lib/access.ts (the server is what actually enforces it).
const FREE_STEPS = 3;

// No more default offer. A brand-new campaign now starts with an empty
// one and waits for the OfferPicker screen (below) to fill it in — the
// old hardcoded "Fall Reset Program" placeholder was never meant to be
// real campaign content, but nothing forced it to be replaced, which is
// also what was producing near-identical draft rows.
const EMPTY_OFFER: OfferContext = {
  name: "",
  price: "",
  audience: "",
  whatTheyGet: "",
  tone: "Friendly",
  readingLevel: "5th grade",
};

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-paper text-muted">
          Loading...
        </div>
      }
    >
      <BuilderInner />
    </Suspense>
  );
}

type MobilePanel = "setup" | "timeline";

function BuilderInner() {
  const { user } = useAuth();
  const { ready } = useRequireAccess();
  const { loading: subLoading, active } = useSubscription();
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingId = searchParams.get("id");
  // New campaign: which template to start from, e.g. /builder?template=cart-close.
  // Defaults to the webinar template (the original /builder behavior).
  const templateParam = searchParams.get("template");
  // /builder?first=1 is where onboarding lands: the offer they just
  // described is already picked, so skip the OfferPicker entirely.
  const isFirst = searchParams.get("first") === "1" && !existingId;

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [offer, setOffer] = useState<OfferContext>(EMPTY_OFFER);
  const [eventDate, setEventDate] = useState<Date>(defaultEventDate);
  const [loadedSteps, setLoadedSteps] = useState<CampaignStepDoc[] | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(!!existingId);
  // A brand-new campaign (no ?id=) shows the OfferPicker until an offer
  // is actually chosen or created; a loaded campaign already has one.
  const [offerPicked, setOfferPicked] = useState(!!existingId);
  // Once a saved campaign loads, its own templateId wins over whatever
  // was in the URL — a saved campaign always rebuilds from the template
  // it was actually created with.
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

  // Onboarding's "Where do you reach your customers?" answer, mapped onto
  // template channels (lib/onboarding/answers.ts). null = no answer saved
  // (older accounts), which keeps every step like before.
  const [allowedChannels, setAllowedChannels] = useState<Set<Channel> | null>(null);
  const [profileLoading, setProfileLoading] = useState(!existingId);
  const [showFirstRun, setShowFirstRun] = useState(isFirst);
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  // Messages and whole channels switched off in the sequence. Saved on
  // the campaign doc (lib/firebase/campaigns.ts), local until it exists.
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());
  const [skippedChannels, setSkippedChannels] = useState<Set<string>>(new Set());
  // The platforms they picked in onboarding, for the real logos.
  const [userPlatforms, setUserPlatforms] = useState<string[]>([]);
  // Set once the first auto-generate has been kicked off, so a re-render
  // can't start a second one.
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!user) return;
    getBusinessProfile(user.uid)
      .then((profile) => {
        if (!profile) return;
        setUserPlatforms(profile.channels ?? []);
        if (existingId) return;
        setAllowedChannels(templateChannelsFor(profile.channels));
        // Came back to /builder?first=1 after the first campaign already
        // exists: open that one instead of starting a duplicate.
        if (isFirst && profile.firstCampaignId) {
          router.replace(`/builder?id=${profile.firstCampaignId}`);
          return;
        }
        if (isFirst && profile.name) {
          setOffer({
            name: profile.name,
            price: profile.price ?? "",
            audience: profile.audience ?? "",
            whatTheyGet: profile.whatTheyGet ?? "",
            tone: profile.tone || "Friendly",
            readingLevel: profile.readingLevel || "5th grade",
          });
          setOfferPicked(true);
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [existingId, isFirst, user, router]);

  // Load an existing campaign's saved steps and copy when ?id= is present.
  useEffect(() => {
    if (!existingId) return;
    setLoadingCampaign(true);
    getCampaignWithSteps(existingId)
      .then((result) => {
        if (!result) return;
        setCampaignId(result.campaign.id);
        setOffer(result.campaign.offer);
        setEventDate(new Date(result.campaign.eventDate));
        setLoadedSteps(result.steps);
        setLoadedTemplateId(result.campaign.templateId);
        setSkippedSteps(new Set(result.campaign.skippedSteps ?? []));
        setSkippedChannels(new Set(result.campaign.skippedChannels ?? []));
      })
      .finally(() => setLoadingCampaign(false));
  }, [existingId]);

  // Unknown/missing template id (bad link, old bookmark) falls back to
  // webinar rather than throwing and blanking the page.
  const activeTemplate = useMemo(() => {
    const id = loadedTemplateId ?? templateParam ?? "webinar";
    try {
      return getTemplate(id);
    } catch {
      return getTemplate("webinar");
    }
  }, [loadedTemplateId, templateParam]);

  // A brand-new campaign's schedule comes from the engine; a loaded one
  // uses the dates already saved on each step.
  // Steps on channels the user said they don't use are left out. If that
  // would leave nothing (a template with none of their channels), keep
  // the full template rather than show an empty timeline.
  const freshSteps = useMemo(() => {
    const all = buildTimeline(activeTemplate, { event: eventDate });
    if (!allowedChannels) return all;
    const kept = all.filter((s) => allowedChannels.has(s.channel as Channel));
    return kept.length > 0 ? kept : all;
  }, [activeTemplate, eventDate, allowedChannels]);

  const scheduledSteps: ScheduledStep[] = loadedSteps
    ? loadedSteps.map((s) => ({ ...s, scheduledAt: new Date(s.scheduledAt) }))
    : freshSteps;

  const [copyByStep, setCopyByStep] = useState<Record<string, Record<string, string>>>({});

  // Direct, in-panel editing of a step's own fields (separate from the
  // "Ask Campeos" variation flow below) — Google Docs-style: no Save
  // button, just autosave shortly after typing stops, and a flush the
  // instant the panel closes so the last keystroke or two is never
  // stranded in a timer that never got to fire. copyByStepRef mirrors
  // copyByStep so the debounced save, which fires well after the
  // keystroke that scheduled it, always writes the latest value rather
  // than whatever was current when the timer was set.
  const copyByStepRef = useRef(copyByStep);
  useEffect(() => {
    copyByStepRef.current = copyByStep;
  }, [copyByStep]);
  const fieldSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [fieldSaveStatus, setFieldSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function flushFieldSave(templateStepId: string) {
    const timer = fieldSaveTimersRef.current[templateStepId];
    if (timer) {
      clearTimeout(timer);
      delete fieldSaveTimersRef.current[templateStepId];
    }
    // Nothing to write yet for a brand-new, unsaved campaign — same
    // "local state only until the first Generate" rule the variation
    // flow below already follows.
    if (!campaignId) return;
    const copy = copyByStepRef.current[templateStepId];
    if (!copy) return;
    setFieldSaveStatus("saving");
    try {
      await saveStepCopy(campaignId, templateStepId, copy);
      setFieldSaveStatus("saved");
      setTimeout(() => setFieldSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setFieldSaveStatus("idle");
    }
  }

  function handleFieldEdit(templateStepId: string, fieldKey: string, value: string) {
    setCopyByStep((prev) => ({
      ...prev,
      [templateStepId]: { ...prev[templateStepId], [fieldKey]: value },
    }));
    if (!campaignId) return;
    clearTimeout(fieldSaveTimersRef.current[templateStepId]);
    fieldSaveTimersRef.current[templateStepId] = setTimeout(() => {
      flushFieldSave(templateStepId);
    }, 800);
  }

  useEffect(() => {
    if (!loadedSteps) return;
    const copy: Record<string, Record<string, string>> = {};
    for (const s of loadedSteps) {
      if (s.copy) copy[s.templateStepId] = s.copy;
    }
    setCopyByStep(copy);
  }, [loadedSteps]);

  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    if (!selectedId && scheduledSteps[0]) setSelectedId(scheduledSteps[0].templateStepId);
  }, [scheduledSteps, selectedId]);

  // The step editor is a near-fullscreen pop-open panel (StepEditor),
  // not a third column — it opens only when a step is actually clicked,
  // closed otherwise. selectedId still tracks which step it shows once
  // open, same as before.
  const [stepModalOpen, setStepModalOpen] = useState(false);

  // Below lg, the Setup/Timeline desktop columns don't fit side by side
  // — shown one at a time instead, picked with the tab row in the mobile
  // header. Starts on "timeline" since that's the main view. The step
  // panel itself isn't one of these tabs — it pops open over whichever
  // tab is showing, on both mobile and desktop.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("timeline");

  const [generating, setGenerating] = useState(false);
  const [variationPending, setVariationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The user's own library of proven copy and sales-call themes — scoped
  // to their account, reused across every campaign they build. See
  // lib/firebase/library.ts.
  const [winningCopy, setWinningCopy] = useState<string[]>([]);
  const [callThemes, setCallThemes] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setWinningCopy([]);
      setCallThemes([]);
      return;
    }
    listWinningCopy(user.uid).then(setWinningCopy);
    listCallThemes(user.uid).then(setCallThemes);
  }, [user]);

  async function handleAddWinningCopy(text: string) {
    if (!user) throw new Error("Sign in first to save winning copy.");
    await addWinningCopy(user.uid, text);
    setWinningCopy(await listWinningCopy(user.uid));
  }

  async function handleAddSalesCall(transcript: string) {
    if (!user) throw new Error("Sign in first to save a sales call.");
    const res = await authFetch("/api/analyze-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Couldn't analyze that call.");
    await addSalesCall(user.uid, transcript, data.themes);
    setCallThemes(await listCallThemes(user.uid));
  }

  const steps: UIStep[] = scheduledSteps.map((s) => ({
    ...s,
    copy: copyByStep[s.templateStepId],
  }));
  const selected = steps.find((s) => s.templateStepId === selectedId);
  const selectedIndex = steps.findIndex((s) => s.templateStepId === selectedId);

  function isOn(s: { templateStepId: string; channel: string }) {
    return !skippedSteps.has(s.templateStepId) && !skippedChannels.has(s.channel);
  }

  function persistSkips(steps: Set<string>, channels: Set<string>) {
    if (campaignId) saveCampaignSkips(campaignId, Array.from(steps), Array.from(channels)).catch(() => {});
  }

  function toggleStep(id: string) {
    const next = new Set(skippedSteps);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSkippedSteps(next);
    persistSkips(next, skippedChannels);
  }

  function toggleChannel(ch: string) {
    const next = new Set(skippedChannels);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    setSkippedChannels(next);
    persistSkips(skippedSteps, next);
  }

  async function generateCampaign() {
    if (!user) {
      setError("Sign in first. Campaigns are saved to your account.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      // No plan: write just the first FREE_STEPS steps (by send time) so
      // they see their own launch. The server enforces this and says no
      // once the free steps are used (see lib/access.ts).
      // Only messages that are switched on and not written yet, so
      // writing again never overwrites copy you've already edited.
      const sub = await getSubscription(user.uid);
      const paid = isActive(sub);
      const todo = [...scheduledSteps]
        .filter((s) => isOn(s) && !copyByStep[s.templateStepId])
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
      const stepsToWrite = paid ? todo : todo.slice(0, Math.max(0, FREE_STEPS - Object.keys(copyByStep).length));
      if (stepsToWrite.length === 0) {
        if (!paid && todo.length > 0) setPlanOpen(true);
        setGenerating(false);
        return;
      }

      // Same daily cap the agent's build path already enforces (see
      // lib/firebase/usage.ts) — this was the one way to burn through
      // the OpenAI budget with no limit at all, since it's a manual
      // click a user can hit repeatedly.
      const allowed = await checkAndIncrementUsage(user.uid, stepsToWrite.length);
      if (!allowed) {
        setError(
          "You've hit today's generation limit for your account. Try again tomorrow, or generate fewer steps at a time."
        );
        setGenerating(false);
        return;
      }

      const eventAt = formatForPrompt(eventDate);
      const res = await authFetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate",
          uid: user.uid,
          offer: { ...offer, fromName: user.displayName ?? undefined },
          steps: stepsToWrite.map((s) => ({
            templateStepId: s.templateStepId,
            step: {
              channel: s.channel,
              title: s.title,
              purpose: s.purpose,
              angle: s.angle,
              goals: s.goals,
              persuasionElements: s.persuasionElements,
              phaseName: s.phaseName,
              phaseObjective: s.phaseObjective,
              scheduledAt: formatForPrompt(s.scheduledAt),
              eventAt,
              fields: s.fields,
            },
          })),
          source: { winningCopy, callThemes },
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setPlanOpen(true);
        throw new Error(data.error ?? "Pick a plan to write the rest of your campaign.");
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");

      const next: Record<string, Record<string, string>> = { ...copyByStep };
      for (const r of data.results as { templateStepId: string; copy: Record<string, string> }[]) {
        next[r.templateStepId] = r.copy;
      }
      setCopyByStep(next);

      // Save to Firestore: create the campaign the first time, or update
      // each step's copy if it already exists.
      if (!campaignId) {
        const stepDocs: CampaignStepDoc[] = scheduledSteps.map((s) => ({
          templateStepId: s.templateStepId,
          channel: s.channel,
          title: s.title,
          purpose: s.purpose,
          angle: s.angle,
          goals: s.goals,
          persuasionElements: s.persuasionElements,
          phaseName: s.phaseName,
          phaseObjective: s.phaseObjective,
          fields: s.fields,
          scheduledAt: s.scheduledAt.toISOString(),
          copy: next[s.templateStepId] ?? null,
        }));
        const newId = await createCampaign(
          user.uid,
          offer.name || "Untitled campaign",
          activeTemplate.id,
          offer,
          eventDate,
          stepDocs
        );
        setCampaignId(newId);
        if (isFirst) saveFirstCampaignId(user.uid, newId).catch(() => {});
        if (skippedSteps.size || skippedChannels.size) {
          saveCampaignSkips(newId, Array.from(skippedSteps), Array.from(skippedChannels)).catch(() => {});
        }
        // Bake the new campaign into the URL so browser back/forward and
        // refresh don't lose it — without this, forward-navigating here
        // reloads a blank /builder with nothing to load (the page only
        // knows to load an existing campaign from ?id= on mount).
        router.replace(`/builder?id=${newId}`);
      } else {
        await Promise.all(
          Object.entries(next).map(([templateStepId, copy]) =>
            saveStepCopy(campaignId, templateStepId, copy)
          )
        );
      }

      if (data.failed?.length) {
        const failedList = (data.failed as { templateStepId: string; error: string }[])
          .map((f) => {
            const title = scheduledSteps.find((s) => s.templateStepId === f.templateStepId)?.title;
            return title ? `"${title}" (${f.error})` : f.error;
          })
          .join(", ");
        setError(`${data.failed.length} step(s) failed to generate: ${failedList}. Try again.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function requestVariation(instruction: string) {
    if (!selected) return;
    if (!user) {
      setError("Sign in first. Campaigns are saved to your account.");
      return;
    }
    setVariationPending(true);
    setError(null);
    try {
      const allowed = await checkAndIncrementUsage(user.uid, 1);
      if (!allowed) {
        setError(
          "You've hit today's generation limit for your account. Try again tomorrow."
        );
        setVariationPending(false);
        return;
      }

      const res = await authFetch("/api/generate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "variation",
          uid: user.uid,
          offer: { ...offer, fromName: user.displayName ?? undefined },
          step: {
            channel: selected.channel,
            title: selected.title,
            purpose: selected.purpose,
            angle: selected.angle,
            goals: selected.goals,
            persuasionElements: selected.persuasionElements,
            phaseName: selected.phaseName,
            phaseObjective: selected.phaseObjective,
            scheduledAt: formatForPrompt(selected.scheduledAt),
            eventAt: formatForPrompt(eventDate),
            fields: selected.fields,
          },
          currentCopy: selected.copy ?? {},
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Variation failed.");

      const { changed, ...rest } = data.result;
      const updatedCopy = { ...copyByStep[selected.templateStepId], ...rest };
      setCopyByStep((prev) => ({ ...prev, [selected.templateStepId]: updatedCopy }));

      if (campaignId) {
        await saveStepCopy(campaignId, selected.templateStepId, updatedCopy);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setVariationPending(false);
    }
  }

  // Onboarding promised "your emails, texts and posts write themselves
  // while you watch", so the first campaign starts writing on arrival.
  useEffect(() => {
    if (!isFirst || autoStarted.current || !offerPicked || !user || campaignId || generating) return;
    if (!offer.name || subLoading) return;
    autoStarted.current = true;
    generateCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirst, offerPicked, user, campaignId, offer.name, subLoading]);

  // Free accounts: everything past the free first steps is locked.
  const lockedIds = useMemo(() => {
    if (subLoading || active) return undefined;
    const written = new Set(Object.keys(copyByStep));
    const unwritten = [...scheduledSteps]
      .filter((s) => !written.has(s.templateStepId) && isOn(s))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    // Whatever's left of the free steps isn't locked yet.
    const freeLeft = Math.max(0, FREE_STEPS - written.size);
    return new Set(unwritten.slice(freeLeft).map((s) => s.templateStepId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subLoading, active, copyByStep, scheduledSteps, skippedSteps, skippedChannels]);

  const onSteps = scheduledSteps.filter((s) => isOn(s));
  const writtenCount = onSteps.filter((s) => copyByStep[s.templateStepId]).length;
  const readyCount = onSteps.filter((s) => copyByStep[s.templateStepId] && !needsInput(copyByStep[s.templateStepId])).length;
  const unwrittenCount = onSteps.filter((s) => !copyByStep[s.templateStepId]).length;
  const writableCount = unwrittenCount - (lockedIds ? Array.from(lockedIds).filter((id) => onSteps.some((s) => s.templateStepId === id)).length : 0);
  const channelsInUse = (Object.keys(CHANNEL_LABELS) as Channel[]).filter((c) =>
    scheduledSteps.some((s) => s.channel === c)
  );

  async function copyCampaign() {
    const text = scheduledSteps
      .filter((s) => copyByStep[s.templateStepId] && isOn(s))
      .map((s) => {
        const when = s.scheduledAt.toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const fields = s.fields
          .map((f) => {
            const v = copyByStep[s.templateStepId]?.[f.key];
            return v ? `${f.label}:\n${v}` : null;
          })
          .filter(Boolean)
          .join("\n\n");
        return `${s.title.toUpperCase()} (${CHANNEL_LABELS[s.channel as Channel] ?? s.channel}, ${when})\n\n${fields}`;
      })
      .join("\n\n---\n\n");
    if (!text) {
      setError("Nothing to copy yet. Write the campaign first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser blocked copying. Open a step to copy it by hand.");
    }
  }

  if (!ready) {
    return <div className="h-screen bg-paper" />;
  }

  if (loadingCampaign || (profileLoading && !offerPicked)) {
    return (
      <div className="h-screen flex items-center justify-center bg-paper text-muted">
        Loading campaign...
      </div>
    );
  }

  if (!offerPicked) {
    if (!user) {
      return (
        <div className="h-screen flex items-center justify-center bg-paper text-muted text-sm">
          Sign in first. Campaigns are saved to your account.
        </div>
      );
    }
    return (
      <OfferPicker
        uid={user.uid}
        onPick={(picked) => {
          setOffer(picked);
          setOfferPicked(true);
        }}
      />
    );
  }

  const channelKeys = Array.from(new Set(scheduledSteps.map((s) => s.channel)));
  const selectedStatus = selected
    ? statusOf(selected, isOn(selected), !!lockedIds?.has(selected.templateStepId), generating)
    : "Not written";
  const fromName = user?.displayName ?? "You";

  function select(id: string) {
    setSelectedId(id);
    // Phones don't have room for the preview column: open the editor.
    if (typeof window !== "undefined" && window.innerWidth < 1024) setStepModalOpen(true);
  }

  return (
    <div className="h-screen flex flex-col bg-paper text-slate font-body">
      {!subLoading && !active && <SubscribeBanner />}
      <div className="flex-grow min-h-0 flex">
        <Sidebar active={null} inBuilder />

        <div className="flex-grow min-w-0 flex flex-col min-h-0">
          {/* Header: what this campaign is, in one line, plus progress */}
          <header className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 sm:px-7 py-4 border-b border-[#F0F0F0]">
            <Link
              href="/dashboard"
              aria-label="Back to home"
              className="shrink-0 w-10 h-10 rounded-xl border border-[#ECEAF0] flex items-center justify-center hover:bg-[#FAFAFA]"
            >
              <BackIcon />
            </Link>
            <div className="flex-[1_1_320px] min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="font-serif text-[26px] sm:text-[30px] font-medium tracking-tight leading-tight truncate">
                  {offer.name || "Untitled campaign"}
                </h1>
                <span
                  className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    !campaignId ? "bg-[#F2F1F5] text-muted" : writtenCount > 0 ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F2F1F5] text-muted"
                  }`}
                >
                  {!campaignId ? "Draft" : writtenCount > 0 ? "Saved" : "Draft"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted mt-1">
                <span>{activeTemplate.name}</span>
                <span>·</span>
                {campaignId ? (
                  <span>
                    Goes live{" "}
                    <b className="text-slate font-semibold">
                      {eventDate.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </b>
                  </span>
                ) : (
                  <label className="inline-flex items-center gap-1.5">
                    Goes live
                    <input
                      type="date"
                      value={toDateInput(eventDate)}
                      min={toDateInput(new Date())}
                      onChange={(e) => {
                        const [y, m, d] = e.target.value.split("-").map(Number);
                        if (!y || !m || !d) return;
                        const next = new Date(eventDate);
                        next.setFullYear(y, m - 1, d);
                        setEventDate(next);
                      }}
                      className="h-7 px-1.5 rounded-lg border border-[#E3E1E8] bg-paper text-slate text-[13px]"
                    />
                  </label>
                )}
                {offer.price && (
                  <>
                    <span>·</span>
                    <span>{offer.price}</span>
                  </>
                )}
                <span>·</span>
                <span>
                  {offer.readingLevel ?? "5th grade"}, {offer.tone || "Friendly"}
                </span>
                <span>·</span>
                <button onClick={() => setSetupOpen(true)} className="font-semibold text-[#5B21B6] hover:underline">
                  Edit setup
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onSteps.length > 0 && (
                <div className="text-right">
                  <div className="text-[13px] font-semibold">
                    {readyCount} of {onSteps.length} ready
                  </div>
                  <div className="w-[140px] h-[5px] rounded-full bg-[#F0EEF4] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-slate transition-[width] duration-500" style={{ width: `${onSteps.length ? Math.round((readyCount / onSteps.length) * 100) : 0}%` }} />
                  </div>
                </div>
              )}
              {unwrittenCount > 0 && writableCount > 0 && (
                <button
                  onClick={generateCampaign}
                  disabled={generating}
                  className="h-11 px-4 rounded-xl text-white text-[15px] font-bold disabled:opacity-60 inline-flex items-center gap-2"
                  style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                >
                  {generating ? "Writing..." : `Write ${writableCount} ${writableCount === 1 ? "message" : "messages"}`}
                </button>
              )}
              {unwrittenCount > 0 && writableCount === 0 && lockedIds && lockedIds.size > 0 && (
                <button
                  onClick={() => setPlanOpen(true)}
                  className="h-11 px-4 rounded-xl text-white text-[15px] font-bold"
                  style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                >
                  Unlock {unwrittenCount} more
                </button>
              )}
              <button
                onClick={copyCampaign}
                disabled={writtenCount === 0}
                className="h-11 px-4 rounded-xl bg-slate text-white text-[15px] font-semibold disabled:opacity-40 inline-flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                {copied ? "Copied" : "Copy all"}
              </button>
            </div>
          </header>

          {error && (
            <div className="shrink-0 px-4 sm:px-7 py-2.5 bg-[#FFF7ED] border-b border-[#FED7AA] text-sm text-[#7C2D12] flex items-center gap-3">
              <span className="flex-grow">{error}</span>
              <button onClick={() => setError(null)} className="text-xs font-semibold">
                Dismiss
              </button>
            </div>
          )}

          {showFirstRun && (generating || writtenCount > 0) && (
            <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-7 py-2.5 bg-agentWash border-b border-[#F0F0F0] text-sm">
              <span className="font-semibold">
                {generating
                  ? "Writing your first campaign. Watch the messages fill in."
                  : lockedIds && lockedIds.size > 0
                    ? `Your first ${writtenCount} messages are written.`
                    : "Your first campaign is written."}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {!generating && lockedIds && lockedIds.size > 0 && (
                  <button onClick={() => setPlanOpen(true)} className="h-8 px-3 rounded-lg bg-slate text-white text-xs font-bold">
                    Unlock my launch
                  </button>
                )}
                {!generating && (
                  <Link href="/dashboard" className="h-8 px-3 inline-flex items-center rounded-lg border border-[#E3E1E8] bg-paper text-xs font-semibold">
                    Go to dashboard
                  </Link>
                )}
                <button onClick={() => setShowFirstRun(false)} className="text-muted text-xs font-semibold px-1">
                  Hide
                </button>
              </span>
            </div>
          )}

          {/* Channels: real logos, tap one to leave all its messages out */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 sm:px-7 py-3 border-b border-[#F0F0F0] bg-[#FCFCFD]">
            <span className="text-[13px] text-muted mr-1">Going out on</span>
            {channelKeys.map((ch) => {
              const info = channelInfo(ch, userPlatforms);
              const off = skippedChannels.has(ch);
              const count = scheduledSteps.filter((s) => s.channel === ch).length;
              return (
                <button
                  key={ch}
                  onClick={() => toggleChannel(ch)}
                  aria-pressed={!off}
                  title={off ? `Put ${info.short} back` : `Leave ${info.short} out`}
                  className={`inline-flex items-center gap-2 h-[38px] pl-2 pr-3 rounded-full text-sm font-semibold bg-paper ${
                    off ? "border border-dashed border-[#D4D1DB] text-faint" : "border-[1.5px] border-slate text-slate"
                  }`}
                >
                  {info.platforms.length > 1 ? (
                    <LogoStack platforms={info.platforms.slice(0, 3)} size={14} />
                  ) : (
                    <PlatformLogo platform={info.platforms[0]} size={20} muted={off} />
                  )}
                  {info.short}
                  <span className="font-mono text-xs text-muted font-medium">{count}</span>
                </button>
              );
            })}
            <span className="flex-grow" />
            <span className="hidden sm:inline text-[13px] text-muted">Tap a channel to leave it out</span>
          </div>

          <div className="flex-grow min-h-0 flex overflow-y-auto lg:overflow-hidden">
            <section aria-label="Sequence" className="flex-[1.15_1_520px] min-w-0 px-4 sm:px-7 py-6 pb-28 lg:overflow-y-auto">
              <SequenceView
                steps={steps}
                phases={activeTemplate.phases}
                eventDate={eventDate}
                selectedId={selectedId}
                onSelect={(id) => (lockedIds?.has(id) && !copyByStep[id] ? setPlanOpen(true) : select(id))}
                isOn={isOn}
                onToggleStep={toggleStep}
                lockedIds={lockedIds}
                generating={generating}
                userPlatforms={userPlatforms}
              />
            </section>
            <section
              aria-label="Preview"
              className="hidden lg:block flex-[1_1_400px] min-w-0 bg-[#F8F8F8] border-l border-[#F0F0F0] px-7 py-6 overflow-y-auto"
            >
              <StepPreview
                step={selected}
                status={selectedStatus}
                fromName={fromName}
                userPlatforms={userPlatforms}
                pending={variationPending}
                onAsk={requestVariation}
                onEditByHand={() => setStepModalOpen(true)}
                onUnlock={() => setPlanOpen(true)}
                onWrite={generateCampaign}
                canWrite={writableCount > 0 && !generating}
              />
            </section>
          </div>

          <StepEditor
            step={selected}
            stepNumber={selectedIndex + 1}
            totalSteps={steps.length}
            onRequestVariation={requestVariation}
            variationPending={variationPending}
            isOpen={stepModalOpen}
            onClose={() => {
              if (selected) flushFieldSave(selected.templateStepId);
              setStepModalOpen(false);
            }}
            onFieldChange={(fieldKey, value) => {
              if (!selected) return;
              handleFieldEdit(selected.templateStepId, fieldKey, value);
            }}
            saveStatus={fieldSaveStatus}
          />
        </div>

        {/* Edit setup: the old left panel, now a drawer you open when needed */}
        {setupOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,19,31,0.35)] animate-step-in" onClick={() => setSetupOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Campaign setup"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[400px] h-full bg-paper shadow-[0_0_60px_-10px_rgba(23,19,31,.35)] flex flex-col"
            >
              <button
                onClick={() => setSetupOpen(false)}
                aria-label="Close setup"
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full border border-[#ECEAF0] bg-paper flex items-center justify-center"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <div className="flex-grow min-h-0 flex">
                <SetupPanel
                  offer={offer}
                  onOfferChange={setOffer}
                  winningCopy={winningCopy}
                  callThemes={callThemes}
                  onAddWinningCopy={handleAddWinningCopy}
                  onAddSalesCall={handleAddSalesCall}
                  onGenerate={() => {
                    setSetupOpen(false);
                    generateCampaign();
                  }}
                  generating={generating}
                />
              </div>
            </div>
          </div>
        )}

        <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />

        <AgentLauncher
          campaign={
            campaignId
              ? {
                  campaignId,
                  offer: { ...offer, fromName: user?.displayName ?? undefined },
                  steps: steps.map(
                    (st): AgentPanelCampaignStep => ({
                      templateStepId: st.templateStepId,
                      channel: st.channel,
                      title: st.title,
                      purpose: st.purpose,
                      angle: st.angle,
                      goals: st.goals,
                      persuasionElements: st.persuasionElements,
                      phaseName: st.phaseName,
                      phaseObjective: st.phaseObjective,
                      scheduledAt: formatForPrompt(st.scheduledAt),
                      eventAt: formatForPrompt(eventDate),
                      fields: st.fields,
                      copy: st.copy ?? null,
                    })
                  ),
                  onStepUpdated: (templateStepId, copy) =>
                    setCopyByStep((prev) => ({ ...prev, [templateStepId]: copy })),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
