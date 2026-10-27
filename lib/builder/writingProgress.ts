// Numbers for the "writing your campaign" banner. The percent is real:
// posts that have appeared out of posts that are going to be written.
// Posts locked behind a plan are never written, so they don't count.

/** How many posts this run is going to have written in the end. */
export function writingTarget(onCount: number, lockedCount: number): number {
  return Math.max(0, onCount - Math.max(0, lockedCount));
}

/** 0 to 100, whole number. */
export function writingPercent(written: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((written / target) * 100)));
}
