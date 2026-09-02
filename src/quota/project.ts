// src/quota/project.ts
import type { QuotaResult } from "./zai.ts";

export const FIVE_HOUR_MS = 5 * 3_600_000;
export const WEEK_MS = 7 * 24 * 3_600_000; // z.ai weekly window (console "Weekly limit")

export interface BlockProjection {
  units: number;  // projected quota credits consumed at window reset
  percent: number; // projected % of the window ceiling (may exceed 100 — honest)
}

// Window-clock percent for the quota row's `usage%/elapsed%` segment (v0.4.1, RECTOR):
// how much of the window's TIME has been consumed. Clamped 0–100 — a stale nextResetTime
// (window already reset) reads 100%, a not-yet-started one reads 0%.
export function windowElapsedPercent(nextResetTime: number, lengthMs: number, now: number): number {
  const elapsed = (now - (nextResetTime - lengthMs)) / lengthMs;
  if (!Number.isFinite(elapsed)) return 0;
  return Math.round(Math.min(1, Math.max(0, elapsed)) * 100);
}

// CC formula (block_projection.sh): current + rate_per_hour × remaining/60, anchored
// to the 5h block start. pi adaptation: z.ai quota credits (we hold currentValue /
// nextResetTime from the poller). Weekly-only data → null: a week is not a block.
export function projectBlock(d: QuotaResult, now: number): BlockProjection | null {
  const w = d.fiveHour;
  if (!w) return null;
  const { currentValue, usage, nextResetTime } = w;
  if (![currentValue, usage, nextResetTime].every((n) => Number.isFinite(n))) return null;
  if (usage <= 0) return null;
  const remainingMs = nextResetTime - now;
  if (remainingMs <= 0) return null; // window already reset — stale fetch
  const elapsedMs = now - (nextResetTime - FIVE_HOUR_MS);
  if (elapsedMs < 60_000) return null; // first minute: rate too unstable to project
  const ratePerHour = currentValue / (elapsedMs / 3_600_000);
  const projected = currentValue + ratePerHour * (remainingMs / 3_600_000);
  return { units: projected, percent: Math.round((projected / usage) * 100) };
}
