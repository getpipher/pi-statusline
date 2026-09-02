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
  if (!parsed || typeof parsed !== "object") return null;

  const zai = parsed.zai as Record<string, unknown> | undefined;
  if (!zai || typeof zai.key !== "string") return null;
  return zai.key;
}

function parseQuotaLimit(value: unknown): QuotaLimit | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  const fields = [
    "unit",
    "number",
    "usage",
    "currentValue",
    "remaining",
    "percentage",
    "nextResetTime",
  ] as const;
  if (!fields.every((field) => typeof entry[field] === "number" && Number.isFinite(entry[field]))) {
    return null;
  }
  return {
    unit: entry.unit as number,
    number: entry.number as number,
    usage: entry.usage as number,
    currentValue: entry.currentValue as number,
    remaining: entry.remaining as number,
    percentage: entry.percentage as number,
    nextResetTime: entry.nextResetTime as number,
  };
}

export function parseQuotaResponse(body: string): QuotaResult | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null; // literal JSON null / primitives

  if (parsed.code !== 200 || parsed.success !== true) return null;

  const data = parsed.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const limits = data.limits;
  if (!Array.isArray(limits) || limits.length === 0) return null;

  const level = data.level as string;
  if (level !== "lite" && level !== "pro" && level !== "max") return null;

  let fiveHour: QuotaLimit | null = null;
  let weekly: QuotaLimit | null = null;

  for (const limit of limits) {
    const parsedLimit = parseQuotaLimit(limit);
    if (!parsedLimit) continue;
    // unit 3 = 5-hour window, unit 6 = weekly window
    if (parsedLimit.unit === 3) fiveHour = parsedLimit;
    else if (parsedLimit.unit === 6) weekly = parsedLimit;
  }

  if (!fiveHour && !weekly) return null;
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

export interface QuotaPollerOpts<T = unknown> {
  apiKey: string;
  intervalMs: number;
  onRefresh?: () => void;
  /** Typed fetch — REQUIRED since the poller genericized (Task 8). */
  fetchFn: (apiKey: string) => Promise<T | null>;
}

export interface QuotaPoller<T = unknown> {
  get(): T | null;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
}

export function createQuotaPoller<T>(opts: QuotaPollerOpts<T>): QuotaPoller<T> {
  let cache: T | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let polling = false;

  async function doPoll(): Promise<void> {
    if (polling) return;
    polling = true;
    try {
      const doFetch = opts.fetchFn;
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
      // The poller must not hold the host process open — interactive sessions keep
      // the loop alive via the TUI (polling cadence unaffected); print mode exits.
      timer.unref?.();
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
