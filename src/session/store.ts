// src/session/store.ts
import { basename } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

// Minimal structural view of pi session entries (ground truth: SessionEntryBase has
// id: string + timestamp: string; assistant messages carry Usage with cost.total).
export interface SessionEntry {
  type: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      reasoning?: number;
      totalTokens?: number;
      cost?: { total?: number };
    };
  };
}

export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  count: number;
}

export interface SessionSnapshot {
  sessionName: string | undefined;
  repoName: string;
  branch: string | null;
  modelId: string | undefined;
  provider: string | undefined;
  usage: UsageTotals;
  contextTokens: number | null;
  contextWindow: number;
  contextPercent: number | null;
  spanMs: number;
}

export interface SessionStoreDeps {
  now?: () => number;
  cwd?: () => string;
}

export interface SessionStore {
  update(ctx: ExtensionContext, branch: string | null): void;
  getSnapshot(): SessionSnapshot;
}

export function aggregateUsage(entries: SessionEntry[]): UsageTotals {
  const totals: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 };
  for (const e of entries) {
    if (e.type !== "message" || e.message?.role !== "assistant") continue;
    const u = e.message.usage;
    if (!u) continue;
    totals.input += u.input ?? 0;
    totals.output += u.output ?? 0;
    totals.cacheRead += u.cacheRead ?? 0;
    totals.cacheWrite += u.cacheWrite ?? 0;
    totals.cost += u.cost?.total ?? 0;
    totals.count += 1;
  }
  return totals;
}

export function createSessionStore(deps: SessionStoreDeps = {}): SessionStore {
  const now = deps.now ?? Date.now;
  const cwd = deps.cwd ?? (() => process.cwd());
  let snapshot: SessionSnapshot | null = null;
  const createdAt = now();

  return {
    update(ctx: ExtensionContext, branch: string | null): void {
      // getEntries() (ALL entries) is pi's complete accessor — the native footer uses it
      // too; getBranch() truncates totals after branch points and is never used here.
      const entries = (ctx.sessionManager.getEntries() ?? []) as SessionEntry[];
      const sessionName = ctx.sessionManager.getSessionName?.();
      const usage = aggregateUsage(entries);
      const contextUsage = ctx.getContextUsage();
      const firstTs = entries
        .map((e) => (e.timestamp ? Date.parse(e.timestamp) : Number.NaN))
        .find((t) => Number.isFinite(t));
      const spanStart = firstTs ?? createdAt;
      snapshot = {
        sessionName,
        repoName: basename(cwd()),
        branch,
        modelId: ctx.model?.id,
        provider: ctx.model?.provider,
        usage,
        contextTokens: contextUsage?.tokens ?? null,
        contextWindow: contextUsage?.contextWindow ?? 0,
        contextPercent: contextUsage?.percent ?? null,
        spanMs: Math.max(0, now() - spanStart),
      };
    },
    getSnapshot(): SessionSnapshot {
      return (
        snapshot ?? {
          sessionName: undefined,
          repoName: basename(cwd()),
          branch: null,
          modelId: undefined,
          provider: undefined,
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
          contextTokens: null,
          contextWindow: 0,
          contextPercent: null,
          spanMs: 0,
        }
      );
    },
  };
}
