// src/adapters/zai.ts
import { createQuotaPoller, fetchQuota, readZaiKey, type QuotaLimit, type QuotaPoller, type QuotaResult } from "../quota/zai.ts";
import { FIVE_HOUR_MS, WEEK_MS, windowElapsedPercent } from "../quota/project.ts";
import { formatTokenCount, formatReset } from "../format.ts";
import type { AdapterSegment, ProviderRowAdapter } from "./types.ts";

export interface ZaiAdapterDeps {
  authJsonPath: string;
  readKey: typeof readZaiKey;
  pollIntervalMs: () => number; // live from config (re-read on restartAdapters)
  fetchFn?: typeof fetchQuota;  // test seam
  onRefresh?: () => void;
}

// Window segment pieces (v0.4.1, RECTOR format): `usage%/window-elapsed%` + ceiling —
// e.g. `3%/50% 5h (28k)`. usage% from the API; elapsed% from the window clock; ceiling =
// the plan's max credits for that window (console "Credits x / 28K"), NOT current burn.
// Label placement differs per window: `5h` suffixes (window duration), `7DAY` prefixes
// (CCS money-label style, RECTOR: drop our `wk`).
// Usage percent display: z.ai reports >100 when usage exceeds the window ceiling (GLM
// allows throttled overage) — cap at `100%+` so the segment never reads like a bug
// (RECTOR pick, v0.4.5). Raw magnitude still lives in the `est` projection; heat uses
// the RAW percentage, so >100 keeps error-red.
function usagePercent(w: QuotaLimit): string {
  return w.percentage > 100 ? "100%+" : `${w.percentage}%`;
}

function windowPercents(w: QuotaLimit, lengthMs: number, now: number): string {
  return `${usagePercent(w)}/${windowElapsedPercent(w.nextResetTime, lengthMs, now)}%`;
}

function windowCeiling(w: QuotaLimit): string {
  return `(${formatTokenCount(w.usage)})`;
}

// Pure segment list (preferred by the quota row — per-window heat tints). Weekly uses the
// CCS label `7DAY` (RECTOR: drop our `wk`); reset is its own dim periphery segment.
export function zaiSegments(data: QuotaResult, now: number): AdapterSegment[] {
  const segs: AdapterSegment[] = [];
  // The first rendered segment carries the `zai` label; later ones own the " | " separator
  // (weekly-only data → `zai 7DAY …`, never an orphan leading separator).
  const prefix = (text: string): string => (segs.length === 0 ? `zai ${text}` : ` | ${text}`);
  if (data.fiveHour) {
    segs.push({ text: prefix(`${windowPercents(data.fiveHour, FIVE_HOUR_MS, now)} 5h ${windowCeiling(data.fiveHour)}`), heat: data.fiveHour.percentage });
  }
  if (data.weekly) {
    segs.push({ text: prefix(`7DAY ${windowPercents(data.weekly, WEEK_MS, now)} ${windowCeiling(data.weekly)}`), heat: data.weekly.percentage });
  }
  const resets = [data.fiveHour?.nextResetTime, data.weekly?.nextResetTime].filter(
    (t): t is number => typeof t === "number",
  );
  if (resets.length > 0) {
    segs.push({ text: prefix(`reset ${formatReset(Math.min(...resets), now)}`), heat: null, color: "dim" });
  }
  return segs;
}

// Single-string form of the segments (contract fallback; dim handled by the row).
export function renderZaiQuota(data: QuotaResult, now: number): string {
  return zaiSegments(data, now).map((s) => s.text).join("");
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
