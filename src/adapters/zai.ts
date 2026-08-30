// src/adapters/zai.ts
import { createQuotaPoller, fetchQuota, readZaiKey, type QuotaResult } from "../quota/zai.ts";
import { formatTokenCount, formatReset, renderBar } from "../format.ts";
import type { ProviderRowAdapter } from "./types.ts";

export interface ZaiAdapterDeps {
  authJsonPath: string;
  readKey: typeof readZaiKey;
  pollIntervalMs: () => number; // live from config (re-read on restartAdapters)
  fetchFn?: typeof fetchQuota;  // test seam
  onRefresh?: () => void;
}

// Pure formatter (spec §5 exact format): `zai ▕██████████░░░▏ 75% 1.5k/2.0k 5h · wk 12% · reset 2h55m`
export function renderZaiQuota(data: QuotaResult, now: number): string {
  const window = data.fiveHour ?? data.weekly;
  const parts: string[] = [];
  if (window) {
    if (data.fiveHour) {
      // Spec §5: bar+percent and the 5h tokens form ONE segment (space-joined, no ·).
      parts.push(`${renderBar(window.percentage / 100)} ${window.percentage}% ${formatTokenCount(data.fiveHour.currentValue)}/${formatTokenCount(data.fiveHour.usage)} 5h`);
    } else {
      parts.push(`${renderBar(window.percentage / 100)} ${window.percentage}%`);
    }
  }
  if (data.weekly) parts.push(`wk ${data.weekly.percentage}%`);
  const resets = [data.fiveHour?.nextResetTime, data.weekly?.nextResetTime].filter(
    (t): t is number => typeof t === "number",
  );
  if (resets.length > 0) parts.push(`reset ${formatReset(Math.min(...resets), now)}`);
  return `zai ${parts.join(" · ")}`;
}

export function createZaiAdapter(deps: ZaiAdapterDeps): ProviderRowAdapter<QuotaResult> {
  let poller: ReturnType<typeof createQuotaPoller> | null = null;

  function ensurePoller(): boolean {
    if (poller) return true;
    const apiKey = deps.readKey(deps.authJsonPath);
    if (!apiKey) return false; // key absent → adapter inert, row omitted
    poller = createQuotaPoller({
      apiKey,
      intervalMs: deps.pollIntervalMs(),
      onRefresh: deps.onRefresh,
      ...(deps.fetchFn ? { fetchFn: deps.fetchFn } : {}),
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
