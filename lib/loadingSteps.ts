// The words on the loading screen people see when a page loads. They walk
// through what Campeos is getting ready, then stay on the last one until the
// page is ready. They run on a short timer (about a second each); they don't
// measure the real loading. The order matches what the home page needs.

export const LOADING_STEPS = ["Analyzing your offers", "Loading your campaigns", "Prepping today's tasks"];

/** How long each line stays up before the next one. */
export const LOADING_STEP_MS = 1100;

/** The step after `current`. Stops on the last one instead of looping. */
export function nextLoadingStep(current: number, count: number): number {
  return Math.min(Math.max(0, count - 1), current + 1);
}
