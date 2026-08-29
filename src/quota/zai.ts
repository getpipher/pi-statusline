// src/quota/zai.ts
import { readFileSync } from "node:fs";

const QUOTA_API = "https://api.z.ai/api/monitor/usage/quota/limit";

export interface QuotaLimit {
  unit: number;
  number: number;
  usage: number;
  currentValue: number;
  remaining: number;
  percentage: number;
  nextResetTime: number; // ms-epoch UTC
}

export interface QuotaResult {
  tier: "lite" | "pro" | "max";
  fiveHour: QuotaLimit | null;
  weekly: QuotaLimit | null;
  fetchedAt: number; // Date.now() of the fetch
}

export function readZaiKey(authJsonPath: string): string | null {
  let raw: string;
  try {
    raw = readFileSync(authJsonPath, "utf8");
  } catch {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const zai = parsed.zai as Record<string, unknown> | undefined;
  if (!zai || typeof zai.key !== "string") return null;
  return zai.key;
}

export function parseQuotaResponse(body: string): QuotaResult | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.code !== 200 || parsed.success !== true) return null;

  const data = parsed.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const limits = data.limits as Array<Record<string, number>> | undefined;
  if (!Array.isArray(limits) || limits.length === 0) return null;

  const level = data.level as string;
  if (level !== "lite" && level !== "pro" && level !== "max") return null;

  let fiveHour: QuotaLimit | null = null;
  let weekly: QuotaLimit | null = null;

  for (const lim of limits) {
    const ql: QuotaLimit = {
      unit: lim.unit,
      number: lim.number,
      usage: lim.usage,
      currentValue: lim.currentValue,
      remaining: lim.remaining,
      percentage: lim.percentage,
      nextResetTime: lim.nextResetTime,
    };
    // unit 3 = 5-hour window, unit 6 = weekly window
    if (lim.unit === 3) fiveHour = ql;
    else if (lim.unit === 6) weekly = ql;
  }

  return { tier: level, fiveHour, weekly, fetchedAt: Date.now() };
}

export async function fetchQuota(apiKey: string): Promise<QuotaResult | null> {
  try {
    const res = await fetch(QUOTA_API, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    return parseQuotaResponse(body);
  } catch {
    return null;
  }
}

export interface QuotaPollerOpts {
  apiKey: string;
  intervalMs: number;
  onRefresh?: () => void;
  /** Injection seam for tests (defaults to the real fetchQuota). */
  fetchFn?: (apiKey: string) => Promise<QuotaResult | null>;
}

export interface QuotaPoller {
  get(): QuotaResult | null;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
}

export function createQuotaPoller(opts: QuotaPollerOpts): QuotaPoller {
  let cache: QuotaResult | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let polling = false;

  async function doPoll(): Promise<void> {
    if (polling) return;
    polling = true;
    try {
      const doFetch = opts.fetchFn ?? fetchQuota;
      const result = await doFetch(opts.apiKey);
      if (result) {
        cache = result;
        try {
          opts.onRefresh?.();
        } catch {
          /* render hook failures must not crash the host */
        }
      }
    } finally {
      polling = false;
    }
  }

  return {
    get: () => cache,
    start: () => {
      if (timer) return;
      // Fetch errors degrade to null inside doPoll; this swallows anything unexpected
      // so a fire-and-forget rejection can never escape as an unhandled rejection.
      void doPoll().catch(() => {}); // fire immediately on start
      timer = setInterval(() => void doPoll().catch(() => {}), opts.intervalMs);
    },
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    refresh: doPoll,
  };
}
