// src/adapters/openrouter.ts
import { readFileSync } from "node:fs";
import { createQuotaPoller, type QuotaPoller } from "../quota/zai.ts";
import { formatMoney } from "../format.ts";
import type { ProviderRowAdapter } from "./types.ts";
import type { LedgerStore } from "../ledger/store.ts";

const CREDITS_API = "https://openrouter.ai/api/v1/credits";

export interface CreditsData {
  totalCredits: number;
  totalUsage: number;
  fetchedAt: number;
}

export function readOrKey(authJsonPath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(authJsonPath, "utf8")) as Record<string, unknown>;
    const or = parsed.openrouter as Record<string, unknown> | undefined;
    return or && typeof or.key === "string" ? or.key : null;
  } catch {
    return null;
  }
}

export function parseCreditsResponse(body: string): { totalCredits: number; totalUsage: number } | null {
  try {
    const parsed = JSON.parse(body) as { data?: { total_credits?: unknown; total_usage?: unknown } };
    const d = parsed?.data;
    if (!d || typeof d !== "object") return null;
    const { total_credits: c, total_usage: u } = d;
    if (typeof c !== "number" || !Number.isFinite(c) || typeof u !== "number" || !Number.isFinite(u)) return null;
    return { totalCredits: c, totalUsage: u };
  } catch {
    return null;
  }
}

export async function fetchCredits(apiKey: string): Promise<CreditsData | null> {
  try {
    const res = await fetch(CREDITS_API, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const parsed = parseCreditsResponse(await res.text());
    return parsed ? { ...parsed, fetchedAt: Date.now() } : null;
  } catch {
    return null;
  }
}

export interface OpenRouterAdapterDeps {
  authJsonPath: string;
  readKey: typeof readOrKey;
  pollIntervalMs: () => number;
  fetchFn?: typeof fetchCredits; // test seam
  ledger: () => LedgerStore | null; // provider-scoped today/top (honest local data)
  onRefresh?: () => void;
}

// OpenRouter credits row (spec §6 / locked D7): `or $7.66 left · $1.24 today · top: <model> $0.90`.
// today + top come from OUR ledger (the credits API has no window/model breakdown);
// both omitted when the ledger has no openrouter spend today.
export function createOpenRouterAdapter(deps: OpenRouterAdapterDeps): ProviderRowAdapter<CreditsData> {
  let poller: QuotaPoller<CreditsData> | null = null;

  function ensurePoller(): boolean {
    if (poller) return true;
    const apiKey = deps.readKey(deps.authJsonPath);
    if (!apiKey) return false;
    poller = createQuotaPoller<CreditsData>({
      apiKey,
      intervalMs: deps.pollIntervalMs(),
      onRefresh: deps.onRefresh,
      fetchFn: deps.fetchFn ?? fetchCredits,
    });
    return true;
  }

  return {
    id: "openrouter",
    matches: (provider) => provider === "openrouter",
    current: () => poller?.get() ?? null,
    async fetch() {
      if (!ensurePoller()) return null;
      await poller!.refresh();
      return poller!.get();
    },
    render(data, _dim) {
      const left = Math.max(0, data.totalCredits - data.totalUsage);
      let line = `or $${formatMoney(left)} left`;
      const ledger = deps.ledger();
      if (ledger) {
        const today = ledger.providerTodayCost("openrouter");
        if (today > 0) {
          line += ` · $${formatMoney(today)} today`;
          const top = ledger.providerTodayTopModel("openrouter");
          if (top) line += ` · top: ${top.model} $${formatMoney(top.cost)}`;
        }
      }
      return line;
    },
    heat: (data) => (data.totalCredits > 0 ? (data.totalUsage / data.totalCredits) * 100 : null),
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
