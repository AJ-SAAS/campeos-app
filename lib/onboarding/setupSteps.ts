// The checklist shown on the "setting up" screen after the last onboarding
// question. Every line matches a real thing finish() does, so the screen
// never shows a fake progress bar. Pure, so it is easy to test.

export interface SetupStage {
  id: "profile" | "offer" | "insights" | "plan" | "home";
  /** Shown while it is happening ("Saving your business"). */
  label: string;
  /** Shown once it is finished. */
  doneLabel: string;
}

export function setupStages(opts: { testimonialCount: number; offerName?: string }): SetupStage[] {
  const n = Math.max(0, Math.floor(opts.testimonialCount));
  const offer = opts.offerName?.trim();
  const stages: SetupStage[] = [
    { id: "profile", label: "Saving your business", doneLabel: "Business saved" },
    {
      id: "offer",
      label: offer ? `Learning about ${offer}` : "Learning about your offer",
      doneLabel: offer ? `Learned about ${offer}` : "Offer learned",
    },
  ];
  if (n > 0) {
    stages.push({
      id: "insights",
      label: n === 1 ? "Keeping 1 testimonial from your page" : `Keeping ${n} testimonials from your page`,
      doneLabel: n === 1 ? "1 testimonial kept" : `${n} testimonials kept`,
    });
  }
  stages.push(
    { id: "plan", label: "Shaping your launch plan", doneLabel: "Launch plan ready" },
    { id: "home", label: "Getting your home ready", doneLabel: "Home ready" }
  );
  return stages;
}

/** Shortest time a stage stays on screen, so quick saves are still readable. */
export const MIN_STAGE_MS = 550;

/** How much longer to wait so a stage lasts at least MIN_STAGE_MS. */
export function remainingDwell(startedAt: number, now: number, min = MIN_STAGE_MS): number {
  return Math.max(0, min - (now - startedAt));
}
