// src/quota/project.ts

export const FIVE_HOUR_MS = 5 * 3_600_000;
export const WEEK_MS = 7 * 24 * 3_600_000; // z.ai weekly window (console "Weekly limit")

// Window-clock percent for the quota row's `usage%/elapsed%` segment (v0.4.1, RECTOR):
// how much of the window's TIME has been consumed. Clamped 0–100 — a stale nextResetTime
// (window already reset) reads 100%, a not-yet-started one reads 0%.
export function windowElapsedPercent(nextResetTime: number, lengthMs: number, now: number): number {
  const elapsed = (now - (nextResetTime - lengthMs)) / lengthMs;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.round(Math.min(1, Math.max(0, elapsed)) * 100);
}
