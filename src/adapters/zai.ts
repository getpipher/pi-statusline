// src/adapters/zai.ts
import { createQuotaPoller, fetchQuota, readZaiKey, type QuotaLimit, type QuotaPoller, type QuotaResult } from "../quota/zai.ts";
import { FIVE_HOUR_MS, WEEK_MS, windowElapsedPercent } from "../quota/project.ts";
import { formatReset } from "../format.ts";
import type { AdapterSegment, ProviderRowAdapter } from "./types.ts";

export interface ZaiAdapterDeps {
  authJsonPath: string;
  readKey: typeof readZaiKey;
  pollIntervalMs: () => number; // live from config (re-read on restartAdapters)
  fetchFn?: typeof fetchQuota;  // test seam
  onRefresh?: () => void;
}

// Window segment pieces (v0.4.7, RECTOR format): `LABEL usage%/window-elapsed% (reset)` —
// no provider prefix, no credits ceiling; the parenthetical is the window's reset
// countdown (pomodoro time), per window.
// Usage percent display: z.ai reports >100 when usage exceeds the window ceiling (GLM
// allows throttled overage) — cap at `100%+` so the segment never reads like a bug
// (RECTOR pick, v0.4.5). Heat uses the RAW percentage, so >100 keeps error-red.
function usagePercent(w: QuotaLimit): string {
  return w.percentage > 100 ? "100%+" : `${w.percentage}%`;
}

function windowPercents(w: QuotaLimit, lengthMs: number, now: number): string {
  return `${usagePercent(w)}/${windowElapsedPercent(w.nextResetTime, lengthMs, now)}%`;
}

function windowReset(w: QuotaLimit, now: number): string {
  return typeof w.nextResetTime === "number" && Number.isFinite(w.nextResetTime)
    ? ` (${formatReset(w.nextResetTime, now)})`
    : "";
}

// Pure segment list (preferred by the quota row — per-window heat tints). Labels are
// CCS-style uppercase (`5HRS`/`7DAY`); the reset countdown rides its own window segment
// as the parenthetical (v0.4.7).
export function zaiSegments(data: QuotaResult, now: number): AdapterSegment[] {
  const segs: AdapterSegment[] = [];
  // Later segments own the " | " separator (weekly-only data → `7DAY …`, never an
  // orphan leading separator).
  const prefix = (text: string): string => (segs.length === 0 ? text : ` | ${text}`);
  if (data.fiveHour) {
    segs.push({
      text: prefix(`5HRS ${windowPercents(data.fiveHour, FIVE_HOUR_MS, now)}${windowReset(data.fiveHour, now)}`),
      heat: data.fiveHour.percentage,
    });
  }
  if (data.weekly) {
    segs.push({
      text: prefix(`7DAY ${windowPercents(data.weekly, WEEK_MS, now)}${windowReset(data.weekly, now)}`),
      heat: data.weekly.percentage,
    });
  }
  return segs;
}

// Single-string form of the segments (contract fallback; dim handled by the row).
export function renderZaiQuota(data: QuotaResult, now: number): string {
  return zaiSegments(data, now).map((s) => s.text).join("");
}

// /statusline status: source freshness + the two window percentages (raw — no cap).
export function zaiStatusDetail(data: QuotaResult, now: number): string {
  const parts: string[] = [];
  if (data.fiveHour) parts.push(`5h ${data.fiveHour.percentage}%`);
  if (data.weekly) parts.push(`weekly ${data.weekly.percentage}%`);
  parts.push(`fetched ${Math.max(0, Math.floor((now - data.fetchedAt) / 60_000))}m ago`);
  return parts.join(" · ");
}

export function createZaiAdapter(deps: ZaiAdapterDeps): ProviderRowAdapter<QuotaResult> {
  let poller: QuotaPoller<QuotaResult> | null = null;

  function ensurePoller(): boolean {
    if (poller) return true;
    const apiKey = deps.readKey(deps.authJsonPath);
    if (!apiKey) return false; // key absent → adapter inert, row omitted
    poller = createQuotaPoller<QuotaResult>({
      apiKey,
      intervalMs: deps.pollIntervalMs(),
      onRefresh: deps.onRefresh,
      fetchFn: deps.fetchFn ?? fetchQuota,
    });
    return true;
  }

  return {
    id: "zai",
    matches: (provider) => provider === "zai",
    current: () => poller?.get() ?? null,
    async fetch() {
      if (!ensurePoller()) return null;
      await poller!.refresh();
      return poller!.get();
    },
    render: (data, _dim) => renderZaiQuota(data, Date.now()),
    segments: (data, now) => zaiSegments(data, now),
    // Heat = 5h window usage (weekly fallback) — mirrors the ctx row's escalation bands.
    heat: (data) => data.fiveHour?.percentage ?? data.weekly?.percentage ?? null,
    statusDetail: (data, now) => zaiStatusDetail(data, now),
    start() {
      if (!ensurePoller()) return;
      poller!.start();
    },
    stop() {
      poller?.stop();
      poller = null;
    },
  };
}
