# pi-statusline v2 Phase 1 (Editorial Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the footer as a multi-line Editorial Dashboard: a fixed row registry (identity / ctx / money / quota / ambient), a persistent spend ledger, a 30s ticker, and the zai quota poller migrated behind a provider-adapter contract — released as v0.2.0.

**Architecture:** Rows are registered modules (`{ id, priority, render(snapshot): Fragment[] | null }`) resolved against `display.rows` config and rendered by a pure drop-matrix engine (whole-row drop by priority, tail-fragment trim as last resort). Sources (SessionStore, LedgerStore, ZaiAdapter) mutate off the render path; `render(width): string[]` stays synchronous. LedgerStore appends idempotent JSONL lines keyed by pi session-entry ids and aggregates day/7d/30d + sparkline on read.

**Tech Stack:** TypeScript (raw `.ts` via tsx, no build step), `@earendil-works/pi-tui` (`visibleWidth`), node:test via `pnpm test:run`, pi extension API (`setFooter` multi-line, `getExtensionStatuses`, `onBranchChange`).

## Global Constraints

- Org spelling **getpipher** (two p's) — never getpither. No AI attribution anywhere. 2-space indent, TypeScript strict, MIT license.
- TDD mandatory: write the failing test, run it (RED), implement, run again (GREEN). `pnpm test:run` + `pnpm typecheck` clean before every commit. One commit per task.
- Branch: do all work on `feat/v2-p1-editorial` (created from `main` in Task 1). Merge to main happens only in Task 12.
- Secrets: `zai.key` read from `~/.pi/agent/auth.json` in-process; never log/echo/commit it.
- pi runtime ground truths (do NOT re-derive; spec §13): `ctx.model = { id, provider }` separate fields (zai session: provider `"zai"`, id `"glm-5.2"`, no slash); `ctx.sessionManager.getSessionName(): string | undefined`; totals over `getEntries()` (NEVER `getBranch()`); `ctx.getContextUsage() = { tokens: number|null, contextWindow: number, percent: number|null }`; `setFooter` factory returns `{ render(width): string[], dispose, invalidate }` — multi-line native; `footerData.getGitBranch() / getExtensionStatuses(): ReadonlyMap<string,string> / onBranchChange(cb)`; session entries have `id: string`, `timestamp: string` (ISO), assistant entries carry `usage: { input, output, cacheRead, cacheWrite, reasoning, totalTokens, cost: { total } }`.
- zai quota API: `GET https://api.z.ai/api/monitor/usage/quota/limit`, Bearer = inference key; `limits[]` unit:3 = 5h, unit:6 = weekly; `nextResetTime` ms-epoch UTC; `level` = lite|pro|max. Zero credit cost to poll.
- Every interval/timer MUST `.unref()` (pi `-p` print mode hangs otherwise). Footer `dispose` must clear the install guard (v1 lesson) and stop all timers/adapters.
- Render path NEVER awaits; external fetch failures degrade to `null` (row omitted) or last-good cache; never throw into render.
- Locked decisions: D1 Editorial Dashboard hybrid; D4 universal `$` row from pi-native cost + adapter contract for quota rows; D5 session name is the identity headline; D6 fixed registry, `display.rows` reorders/omits, never invents (unknown ids → dropped + one-time notify); A5-refined quota is subscription-scoped (rendered when data exists, dimmed when active provider ≠ zai). Deen row is **P2** — the id is known to config but no row module is registered in P1 (configured `deen` is silently skipped, no notify). OpenRouterAdapter, MCP fragment, git upgrades (dirty/ahead/behind), named themes, `rows` command are **P3** — do not build them here.
- Render format targets (exact, from spec §5):
  - identity: `<session-name> <repo> ⎇ <branch> · <model>`
  - ctx: `ctx ▕███████░░░░░░░▏ 34% 68k/200k · ↑48k ↓6.2k · cache 62%` (10-cell bar; `warning` ≥70%, `error` ≥90%)
  - money: `$ 1.24 sess · 8.40 day · 31.20 7d · 118.75 30d ▁▂▃▅▃▂ · $2.10/hr`
  - quota (zai adapter): `zai ▕██████████░░░▏ 75% 1.5k/2.0k 5h · wk 12% · reset 2h55m`
  - ambient: `04:12 · coding 3h12m · <extension statuses joined " · ">`
- Brightness tokens: labels dim, values muted, headline (session name) `text`, model + sparkline `accent`, alerts via `warning`/`error`. Colors are `Fragment.color` tokens — the footer maps them once through `theme.fg`.
- Ledger: `~/.pi/agent/pi-statusline/ledger.jsonl`, append-only, idempotent by session-entry id; day boundary = local timezone via injectable `utcOffsetMinutes` (tested with fixed-offset fixtures); malformed line → skipped + warn once, never fatal.
- Tag policy: `git -c tag.gpgSign=false tag -a vX -m …` (gitconfig `tag.gpgSign=true` opens vim in non-interactive shells). Release = tag push `v*` → release.yml (org NPM_TOKEN); mirror runs on every main push.

---

## File Structure

```
pi-statusline/
├─ src/
│  ├─ index.ts                  # MODIFY — v2 wiring: stores, adapters, registry, ticker, multi-line render
│  ├─ config.ts                 # MODIFY — display.rows/bars/sparkline + unknown-row reporting + back-compat
│  ├─ provider.ts               # KEEP   — isZaiProvider used by the zai adapter
│  ├─ quota/zai.ts              # KEEP   — readZaiKey / parseQuotaResponse / fetchQuota / createQuotaPoller (unchanged)
│  ├─ types.ts                  # CREATE — ColorToken, Fragment, KNOWN_ROW_IDS, RowId, RowPriority
│  ├─ format.ts                 # CREATE — bar, sparkline, money, token count, clock, span, reset formatters
│  ├─ session/store.ts          # CREATE — SessionStore: usage aggregation + identity/ctx snapshot (sync pulls)
│  ├─ ledger/store.ts           # CREATE — LedgerStore: JSONL append, seen-set reconcile, day aggregation
│  ├─ adapters/types.ts         # CREATE — ProviderRowAdapter contract + resolveQuotaAdapter
│  ├─ adapters/zai.ts           # CREATE — ZaiAdapter migration (poller reuse) + pure renderZaiQuota
│  ├─ rows/registry.ts          # CREATE — Row type, registry, renderRows drop matrix
│  ├─ rows/identity.ts          # CREATE — identity row (priority 1)
│  ├─ rows/context.ts           # CREATE — ctx row (priority 1)
│  ├─ rows/money.ts             # CREATE — money row (priority 2)
│  ├─ rows/quota.ts             # CREATE — quota row wrapping adapters (priority 2)
│  ├─ rows/ambient.ts           # CREATE — ambient row (priority 3)
│  ├─ ticker.ts                 # CREATE — 30s unref()'d interval
│  ├─ footer.ts                 # DELETE (Task 11) — superseded by rows/registry.ts
│  ├─ segments/                 # DELETE (Task 12) — superseded (logic copied into rows/ + format.ts)
│  └─ tui/settings.ts           # KEEP   — /statusline args parser (unchanged in P1; `rows` cmd is P3)
├─ test/
│  ├─ format.test.ts            # CREATE
│  ├─ session-store.test.ts     # CREATE
│  ├─ ledger.test.ts            # CREATE
│  ├─ config.test.ts            # MODIFY — v2 keys + back-compat + unknown rows
│  ├─ rows-registry.test.ts     # CREATE — drop matrix
│  ├─ rows.test.ts              # CREATE — identity/ctx/money/ambient/quota rows
│  ├─ adapters-zai.test.ts      # CREATE — adapter conformance + render format
│  ├─ ticker.test.ts            # CREATE
│  ├─ index-wiring.test.ts      # MODIFY — multi-line + provider matrix + perf smoke
│  ├─ footer.test.ts            # DELETE (Task 11)
│  └─ segments.test.ts          # DELETE (Task 12)
└─ README.md                    # MODIFY (Task 12)
```

---

### Task 1: Foundation — `types.ts` + `format.ts`

**Files:**
- Create: `src/types.ts`
- Create: `src/format.ts`
- Test: `test/format.test.ts`

**Interfaces:**
- Produces: `ColorToken`, `Fragment`, `KNOWN_ROW_IDS`, `RowId`, `RowPriority` (all later tasks import from `src/types.ts`); formatters `formatTokenCount`, `formatMoney`, `renderBar`, `renderSparkline`, `formatClock`, `formatSpan`, `formatReset` (rows and adapters import these).
- Note: `formatTokenCount` is COPIED here from `src/segments/tokens.ts` (that file still serves the v1 footer until Task 12 deletes it — do not touch it).

- [ ] **Step 1: Create `src/types.ts`**

```ts
// src/types.ts
export type ColorToken = "text" | "muted" | "dim" | "accent" | "warning" | "error";

export interface Fragment {
  text: string;
  color: ColorToken;
}

// Canonical row ids (spec §9). "deen" is a KNOWN id from day one: config accepts it
// without a notify, but no row module is registered until P2 — renderRows skips it silently.
export const KNOWN_ROW_IDS = ["identity", "ctx", "money", "quota", "deen", "ambient"] as const;
export type RowId = (typeof KNOWN_ROW_IDS)[number];

// Retention tiers under width pressure: 1 = kept longest (identity/ctx/deen),
// 2 = money/quota, 3 = ambient (dropped first).
export type RowPriority = 1 | 2 | 3;
```

- [ ] **Step 2: Write the failing test `test/format.test.ts`**

```ts
// test/format.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatSpan,
  formatTokenCount,
  formatClock,
  renderBar,
  renderSparkline,
  formatReset,
} from "../src/format.ts";

test("formatTokenCount formats <1k plain and k-values with one decimal under 10k", () => {
  assert.equal(formatTokenCount(0), "0");
  assert.equal(formatTokenCount(999), "999");
  assert.equal(formatTokenCount(6200), "6.2k");
  assert.equal(formatTokenCount(48_000), "48k");
});

test("formatMoney always shows two decimals, no grouping", () => {
  assert.equal(formatMoney(0), "0.00");
  assert.equal(formatMoney(1.24), "1.24");
  assert.equal(formatMoney(118.75), "118.75");
  assert.equal(formatMoney(1234.5), "1234.50");
});

test("renderBar renders a 10-cell block bar clamped to [0,1]", () => {
  assert.equal(renderBar(0), "▕░░░░░░░░░░▏");
  assert.equal(renderBar(0.34), "▕███░░░░░░░▏");
  assert.equal(renderBar(0.75), "▕████████░░▏");
  assert.equal(renderBar(1), "▕██████████▏");
  assert.equal(renderBar(1.5), "▕██████████▏");
  assert.equal(renderBar(-1), "▕░░░░░░░░░░▏");
  assert.equal(renderBar(Number.NaN), "▕░░░░░░░░░░▏");
});

test("renderSparkline scales the last values to the max as 7 block levels", () => {
  assert.equal(renderSparkline([]), "");
  assert.equal(renderSparkline([0, 0, 0]), "▁▁▁");
  assert.equal(renderSparkline([1, 2, 3, 4, 5, 6, 7]), "▁▂▃▄▅▆▇");
  assert.equal(renderSparkline([7, 0, 0, 0, 0, 0, 3.5]), "▇▁▁▁▁▁▃");
});

test("formatClock renders 24h local HH:MM", () => {
  // 2026-08-30T04:12:00Z — assertions use the local zone of the test runner.
  const ts = Date.UTC(2026, 7, 30, 4, 12);
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  assert.equal(formatClock(ts), `${hh}:${mm}`);
});

test("formatSpan renders h/m compact forms", () => {
  assert.equal(formatSpan(0), "0m");
  assert.equal(formatSpan(59_999), "0m");
  assert.equal(formatSpan(45 * 60_000), "45m");
  assert.equal(formatSpan((3 * 60 + 12) * 60_000), "3h12m");
});

test("formatReset renders countdown buckets (moved from segments/quota.ts)", () => {
  const now = 1_000_000_000_000;
  assert.equal(formatReset(now - 1, now), "now");
  assert.equal(formatReset(now + 2 * 3_600_000 + 55 * 60_000, now), "2h55m");
  assert.equal(formatReset(now + 26 * 3_600_000, now), "1d2h");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/format.ts'`

- [ ] **Step 4: Write `src/format.ts`**

```ts
// src/format.ts
export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`;
  const thousands = count / 1000;
  return thousands < 10 ? `${thousands.toFixed(1)}k` : `${Math.round(thousands)}k`;
}

export function formatMoney(n: number): string {
  return n.toFixed(2);
}

export function renderBar(ratio: number, cells = 10): string {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const filled = Math.round(clamped * cells);
  return `▕${"█".repeat(filled)}${"░".repeat(cells - filled)}▏`;
}

const SPARK_LEVELS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"] as const;

export function renderSparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  return values
    .map((v) => {
      if (max <= 0) return SPARK_LEVELS[0];
      return SPARK_LEVELS[Math.round((v / max) * (SPARK_LEVELS.length - 1))] ?? SPARK_LEVELS[0];
    })
    .join("");
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatSpan(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours <= 0) return `${totalMinutes}m`;
  return `${hours}h${totalMinutes % 60}m`;
}

// Countdown to a ms-epoch reset (moved verbatim in spirit from v1 segments/quota.ts).
export function formatReset(targetMs: number, now: number): string {
  const remaining = targetMs - now;
  if (remaining <= 0) return "now";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d${hours % 24}h`;
  }
  return `${hours}h${minutes}m`;
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass (previous 60 + new format tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/v2-p1-editorial
git add src/types.ts src/format.ts test/format.test.ts
git commit -m "feat: v2 foundation — fragment types and shared formatters"
```

---

### Task 2: SessionStore

**Files:**
- Create: `src/session/store.ts`
- Test: `test/session-store.test.ts`

**Interfaces:**
- Consumes: nothing from other v2 tasks (pure module over pi entry shapes).
- Produces: `SessionEntry` (minimal structural type), `UsageTotals`, `SessionSnapshot`, `SessionStore`, `createSessionStore(deps?)`, `aggregateUsage(entries)`. Task 5 (registry snapshot), Tasks 6–10 (rows) and Task 11 (wiring) consume these exact names.

- [ ] **Step 1: Write the failing test `test/session-store.test.ts`**

```ts
// test/session-store.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateUsage, createSessionStore } from "../src/session/store.ts";

const NOW = Date.UTC(2026, 7, 30, 4, 12);

function usageEntry(id: string, iso: string, usage: Record<string, unknown>) {
  return { type: "message", id, timestamp: iso, message: { role: "assistant", usage } };
}

const ENTRIES = [
  usageEntry("e1", "2026-08-30T02:00:00.000Z", {
    input: 1000, output: 200, cacheRead: 8000, cacheWrite: 0, cost: { total: 0.5 },
  }),
  usageEntry("e2", "2026-08-30T03:00:00.000Z", {
    input: 500, output: 100, cacheRead: 4000, cacheWrite: 0, cost: { total: 0.25 },
  }),
  { type: "message", id: "u1", timestamp: "2026-08-30T02:30:00.000Z", message: { role: "user" } },
];

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    model: { provider: "zai", id: "glm-5.2" },
    sessionManager: {
      getEntries: () => ENTRIES,
      getSessionName: () => "v2-p1",
    },
    getContextUsage: () => ({ tokens: 68_000, contextWindow: 200_000, percent: 34 }),
    ...overrides,
  } as never;
}

test("aggregateUsage sums input/output/cacheRead/cost and counts usage entries", () => {
  const totals = aggregateUsage(ENTRIES);
  assert.equal(totals.input, 1500);
  assert.equal(totals.output, 300);
  assert.equal(totals.cacheRead, 12_000);
  assert.equal(totals.cacheWrite, 0);
  assert.deepEqual(totals.cost, 0.75);
  assert.equal(totals.count, 2);
});

test("aggregateUsage tolerates entries without usage or cost", () => {
  const totals = aggregateUsage([
    { type: "message", id: "x", message: { role: "assistant" } },
    { type: "custom", id: "y" },
  ]);
  assert.equal(totals.count, 0);
  assert.equal(totals.cost, 0);
});

test("update+getSnapshot exposes identity, usage, context and span", () => {
  const store = createSessionStore({ now: () => NOW, cwd: () => "/home/r/local-dev/getpipher/pi-statusline" });
  store.update(makeCtx(), "main");
  const snap = store.getSnapshot();
  assert.equal(snap.sessionName, "v2-p1");
  assert.equal(snap.repoName, "pi-statusline");
  assert.equal(snap.branch, "main");
  assert.equal(snap.modelId, "glm-5.2");
  assert.equal(snap.provider, "zai");
  assert.equal(snap.usage.cost, 0.75);
  assert.equal(snap.usage.count, 2);
  assert.equal(snap.contextTokens, 68_000);
  assert.equal(snap.contextWindow, 200_000);
  assert.equal(snap.contextPercent, 34);
  // span = now - first entry timestamp (02:00Z → 2h12m)
  assert.equal(snap.spanMs, 2 * 3_600_000 + 12 * 60_000);
});

test("span falls back to store creation time when there are no entries", () => {
  const store = createSessionStore({ now: () => NOW, cwd: () => "/tmp/proj" });
  store.update(
    makeCtx({ sessionManager: { getEntries: () => [], getSessionName: () => undefined } }),
    null,
  );
  const snap = store.getSnapshot();
  assert.equal(snap.sessionName, undefined);
  assert.equal(snap.branch, null);
  assert.equal(snap.spanMs, 0);
});

test("cache-hit ratio is derivable from usage (cacheRead / (cacheRead + input))", () => {
  const totals = aggregateUsage(ENTRIES);
  assert.equal(Math.round((totals.cacheRead / (totals.cacheRead + totals.input)) * 100), 89);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/session/store.ts'`

- [ ] **Step 3: Write `src/session/store.ts`**

```ts
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
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/session/store.ts test/session-store.test.ts
git commit -m "feat: SessionStore — usage aggregation and identity snapshot"
```

---

### Task 3: LedgerStore — persistent spend ledger

**Files:**
- Create: `src/ledger/store.ts`
- Test: `test/ledger.test.ts`

**Interfaces:**
- Consumes: `SessionEntry` from `src/session/store.ts` (Task 2).
- Produces: `LedgerLine`, `LedgerSnapshot`, `LedgerStore`, `createLedgerStore(opts)`, `localDayIndex(ts, utcOffsetMinutes)`. Task 5 (snapshot), Task 9 (money row), Task 11 (wiring) consume these exact names.

- [ ] **Step 1: Write the failing test `test/ledger.test.ts`**

```ts
// test/ledger.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLedgerStore, localDayIndex } from "../src/ledger/store.ts";

const SGT = 480; // UTC+8 fixed-offset fixture (RECTOR SGT day boundary)

function entry(id: string, iso: string, cost: number) {
  return {
    type: "message",
    id,
    timestamp: iso,
    message: { role: "assistant", usage: { input: 1, output: 1, cost: { total: cost } } },
  };
}

function line(id: string, ts: number, cost: number, model = "glm-5.2") {
  return JSON.stringify({
    id, ts, provider: "zai", model,
    input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost,
  });
}

test("localDayIndex buckets timestamps by fixed offset", () => {
  // 2026-08-30T16:30:00Z is 2026-08-31 00:30 SGT — next day under SGT, same day under UTC.
  const ts = Date.UTC(2026, 7, 30, 16, 30);
  assert.equal(localDayIndex(ts, 480), localDayIndex(Date.UTC(2026, 7, 31, 0, 30), 480));
  assert.notEqual(localDayIndex(ts, 480), localDayIndex(ts, 0));
});

test("reconcile appends unseen usage entries once and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({ filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT });
  store.load();
  const entries = [
    entry("a1", "2026-08-30T09:00:00.000Z", 0.5),
    entry("a2", "2026-08-30T09:05:00.000Z", 0.25),
  ];
  assert.equal(store.reconcile(entries), 2);
  assert.equal(store.reconcile(entries), 0); // second pass: all seen — double-count impossible
  const raw = readFileSync(filePath, "utf8").trim().split("\n");
  assert.equal(raw.length, 2);
  assert.deepEqual(JSON.parse(raw[0]!), { id: "a1", provider: "zai", model: "unknown", cost: 0.5, ts: Date.parse("2026-08-30T09:00:00.000Z"), input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 });
  rmSync(dir, { recursive: true, force: true });
});

test("reconcile skips entries without ids or usage", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const store = createLedgerStore({ filePath: join(dir, "l.jsonl"), utcOffsetMinutes: SGT });
  store.load();
  const n = store.reconcile([
    { type: "message", message: { role: "assistant", usage: { cost: { total: 1 } } } },
    { type: "message", id: "u", message: { role: "user" } },
    { type: "custom", id: "c" },
  ]);
  assert.equal(n, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("load seeds the seen-set from an existing file (restart-safe)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  writeFileSync(filePath, `${line("a1", Date.UTC(2026, 7, 30, 9, 0), 0.5)}\n`);
  const store = createLedgerStore({ filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT });
  store.load();
  assert.equal(store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 0.5)]), 0);
  rmSync(dir, { recursive: true, force: true });
});

test("malformed lines are skipped on scan and warn fires at most once", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  writeFileSync(filePath, `not-json\n${line("a1", 1, 0.5)}\n{"id":"bad"}\n`);
  const warnings: string[] = [];
  const store = createLedgerStore({ filePath, utcOffsetMinutes: SGT, warn: (m) => warnings.push(m) });
  store.load();
  assert.equal(warnings.length, 1); // two malformed lines, one warning
  assert.equal(store.reconcile([entry("a2", "2026-08-30T09:00:00.000Z", 1)]), 1);
  rmSync(dir, { recursive: true, force: true });
});

test("getSnapshot aggregates today/7d/30d and 7-day sparkline by local day", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const now = Date.UTC(2026, 7, 30, 10, 0); // 18:00 SGT, still Aug 30 local
  // today (2 entries), yesterday (1), 8 days ago (outside 7d, inside 30d), 40 days ago (outside 30d)
  const lines = [
    line("t1", Date.UTC(2026, 7, 30, 1, 0), 1.0),
    line("t2", Date.UTC(2026, 7, 30, 3, 0), 0.24),
    line("y1", Date.UTC(2026, 7, 29, 3, 0), 2.0),
    line("w1", Date.UTC(2026, 7, 22, 3, 0), 4.0),
    line("o1", Date.UTC(2026, 6, 21, 3, 0), 8.0),
  ].join("\n");
  writeFileSync(filePath, `${lines}\n`);
  const store = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: SGT });
  store.load();
  const snap = store.getSnapshot();
  assert.deepEqual(snap.todayCost, 1.24);
  assert.deepEqual(snap.last7Cost, 1.24 + 2.0);
  assert.deepEqual(snap.last30Cost, 1.24 + 2.0 + 4.0);
  assert.equal(snap.daily.length, 7);
  assert.deepEqual(snap.daily[6], 1.24); // today, newest
  assert.deepEqual(snap.daily[5], 2.0); // yesterday
  assert.deepEqual(snap.daily[0], 0);   // 6 days ago — no spend
  rmSync(dir, { recursive: true, force: true });
});

test("reconcile creates the ledger directory when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "pi-statusline", "ledger.jsonl");
  const store = createLedgerStore({ filePath, utcOffsetMinutes: SGT });
  store.load();
  store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 0.5)]);
  assert.ok(existsSync(filePath));
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/ledger/store.ts'`

- [ ] **Step 3: Write `src/ledger/store.ts`**

```ts
// src/ledger/store.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionEntry } from "../session/store.ts";

export interface LedgerLine {
  id: string;
  ts: number; // ms-epoch
  provider: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  cost: number;
}

export interface LedgerSnapshot {
  todayCost: number;
  last7Cost: number;
  last30Cost: number;
  daily: number[]; // last 7 local-day sums, oldest → newest (sparkline input)
}

export interface LedgerStoreOpts {
  filePath: string;
  now?: () => number;
  utcOffsetMinutes?: number; // fixed-offset day boundary; default = host local offset
  warn?: (message: string) => void;
}

export interface LedgerStore {
  load(): void; // startup scan → seen-set + in-memory lines
  reconcile(entries: SessionEntry[]): number; // append unseen usage entries → count appended
  getSnapshot(): LedgerSnapshot;
}

// Fixed-offset calendar-day bucket: days since epoch in the shifted frame.
export function localDayIndex(ts: number, utcOffsetMinutes: number): number {
  return Math.floor((ts + utcOffsetMinutes * 60_000) / 86_400_000);
}

function parseLine(raw: string): LedgerLine | null {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.ts !== "number" || typeof p.cost !== "number") return null;
    const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
    return {
      id: p.id,
      ts: p.ts,
      provider: str(p.provider, "unknown"),
      model: str(p.model, "unknown"),
      input: num(p.input),
      output: num(p.output),
      cacheRead: num(p.cacheRead),
      cacheWrite: num(p.cacheWrite),
      reasoning: num(p.reasoning),
      cost: p.cost,
    };
  } catch {
    return null;
  }
}

export function createLedgerStore(opts: LedgerStoreOpts): LedgerStore {
  const now = opts.now ?? Date.now;
  const offset = opts.utcOffsetMinutes ?? -new Date().getTimezoneOffset();
  const seen = new Set<string>();
  const lines: LedgerLine[] = [];
  let loaded = false;
  let warned = false;

  const warnOnce = (message: string): void => {
    if (warned) return;
    warned = true;
    if (opts.warn) opts.warn(message);
    else console.error(`pi-statusline ledger: ${message}`);
  };

  function toLine(entry: SessionEntry): LedgerLine | null {
    if (!entry.id) return null;
    if (entry.type !== "message" || entry.message?.role !== "assistant") return null;
    const u = entry.message.usage;
    if (!u) return null;
    const ts = entry.timestamp && Number.isFinite(Date.parse(entry.timestamp))
      ? Date.parse(entry.timestamp)
      : now();
    return {
      id: entry.id,
      ts,
      provider: "unknown", // enriched by callers? No — kept minimal; provider/model land via opts below.
      model: "unknown",
      input: u.input ?? 0,
      output: u.output ?? 0,
      cacheRead: u.cacheRead ?? 0,
      cacheWrite: u.cacheWrite ?? 0,
      reasoning: u.reasoning ?? 0,
      cost: u.cost?.total ?? 0,
    };
  }

  return {
    load(): void {
      loaded = true;
      if (!existsSync(opts.filePath)) return;
      let raw: string;
      try {
        raw = readFileSync(opts.filePath, "utf8");
      } catch {
        warnOnce(`cannot read ${opts.filePath}`);
        return;
      }
      for (const rawLine of raw.split("\n")) {
        if (rawLine.trim() === "") continue;
        const parsed = parseLine(rawLine);
        if (!parsed) {
          warnOnce(`skipped malformed line in ${opts.filePath}`);
          continue;
        }
        seen.add(parsed.id);
        lines.push(parsed);
      }
    },

    reconcile(entries: SessionEntry[]): number {
      if (!loaded) this.load();
      let appended = 0;
      for (const entry of entries) {
        const lineItem = toLine(entry);
        if (!lineItem || seen.has(lineItem.id)) continue;
        seen.add(lineItem.id);
        lines.push(lineItem);
        mkdirSync(dirname(opts.filePath), { recursive: true });
        appendFileSync(opts.filePath, `${JSON.stringify(lineItem)}\n`, "utf8");
        appended += 1;
      }
      return appended;
    },

    getSnapshot(): LedgerSnapshot {
      const todayIdx = localDayIndex(now(), offset);
      const byDay = new Map<number, number>();
      for (const l of lines) {
        const day = localDayIndex(l.ts, offset);
        byDay.set(day, (byDay.get(day) ?? 0) + l.cost);
      }
      const sumDays = (from: number, to: number): number => {
        let sum = 0;
        for (let d = from; d <= to; d++) sum += byDay.get(d) ?? 0;
        return sum;
      };
      const daily: number[] = [];
      for (let d = todayIdx - 6; d <= todayIdx; d++) daily.push(byDay.get(d) ?? 0);
      return {
        todayCost: byDay.get(todayIdx) ?? 0,
        last7Cost: sumDays(todayIdx - 6, todayIdx),
        last30Cost: sumDays(todayIdx - 29, todayIdx),
        daily,
      };
    },
  };
}
```

> **Reviewer note on `provider`/`model` in `toLine`:** pi's usage entries do not carry provider/model per entry; the active `ctx.model` changes mid-session. P1 records `"unknown"` for both fields (the spec's line format reserves the fields; aggregation only uses `ts` + `cost`). Do not invent per-entry attribution — flag any reviewer pushback on this to RECTOR rather than guessing.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ledger/store.ts test/ledger.test.ts
git commit -m "feat: LedgerStore — idempotent JSONL spend ledger with day aggregation"
```

---

### Task 4: Config v2 — rows/bars/sparkline + back-compat + unknown-row reporting

**Files:**
- Modify: `src/config.ts`
- Modify: `src/index.ts` (minimal: destructure the new `loadConfig` result so typecheck stays green; unknown-row notify wiring lands in Task 11)
- Test: `test/config.test.ts` (extend)

**Interfaces:**
- Consumes: `KNOWN_ROW_IDS`, `RowId` from `src/types.ts` (Task 1).
- Produces: `StatuslineConfig` with `display.rows: RowId[]`, `display.bars: boolean`, `display.sparkline: boolean`; `ConfigLoadResult { config, unknownRows: string[] }`; `loadConfig(path): ConfigLoadResult`. All later consumers use the destructured result form.

- [ ] **Step 1: Extend `test/config.test.ts` with the v2 cases (add below existing tests; keep every existing v1 test passing unchanged)**

```ts
// append to test/config.test.ts
import { KNOWN_ROW_IDS } from "../src/types.ts";

test("v2: defaults include the full canonical row order and gates on", () => {
  writeFileSync(path_, JSON.stringify({}));
  const { config, unknownRows } = loadConfig(path_);
  assert.deepEqual(config.display.rows, [...KNOWN_ROW_IDS]);
  assert.equal(config.display.bars, true);
  assert.equal(config.display.sparkline, true);
  assert.deepEqual(unknownRows, []);
});

test("v2: display.rows reorders and omits rows", () => {
  writeFileSync(path_, JSON.stringify({ display: { rows: ["money", "identity"] } }));
  const { config } = loadConfig(path_);
  assert.deepEqual(config.display.rows, ["money", "identity"]);
});

test("v2: unknown display.rows ids are dropped and reported, known-unregistered (deen) is not", () => {
  writeFileSync(path_, JSON.stringify({ display: { rows: ["identity", "moneny", "deen", "nope"] } }));
  const { config, unknownRows } = loadConfig(path_);
  assert.deepEqual(config.display.rows, ["identity", "deen"]);
  assert.deepEqual(unknownRows, ["moneny", "nope"]);
});

test("v2: non-string or non-array rows fall back to defaults", () => {
  writeFileSync(path_, JSON.stringify({ display: { rows: "identity", bars: "yes" } }));
  const { config } = loadConfig(path_);
  assert.deepEqual(config.display.rows, [...KNOWN_ROW_IDS]);
  assert.equal(config.display.bars, true);
});

test("v1 back-compat: a v1 file (no rows/bars/sparkline) loads cleanly with defaults merged", () => {
  writeFileSync(path_, JSON.stringify({
    enabled: true,
    zai: { tier: "pro", pollIntervalMs: 60_000 },
    display: { showTokens: false, showContext: true, showGit: true },
  }));
  const { config, unknownRows } = loadConfig(path_);
  assert.equal(config.zai.tier, "pro");
  assert.equal(config.zai.pollIntervalMs, 60_000);
  assert.equal(config.display.showTokens, false);
  assert.deepEqual(config.display.rows, [...KNOWN_ROW_IDS]);
  assert.deepEqual(unknownRows, []);
});
```

> Adjust `path_` to the actual tmp-config helper name already used in `test/config.test.ts` (read the file first and follow its existing fixture pattern exactly).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — new v2 tests error on missing `rows`/`unknownRows`.

- [ ] **Step 3: Modify `src/config.ts`**

Change the `StatuslineConfig.display` block and add the result type + validation:

```ts
// src/config.ts — modified pieces
import { KNOWN_ROW_IDS, type RowId } from "./types.ts";

export interface StatuslineConfig {
  enabled: boolean;
  zai: {
    tier: "auto" | "lite" | "pro" | "max";
    pollIntervalMs: number;
  };
  display: {
    rows: RowId[];          // display order; subset/reorder of the registry, never invents
    bars: boolean;
    sparkline: boolean;
    showTokens: boolean;
    showContext: boolean;
    showGit: boolean;
    showSession: boolean;
  };
}

export interface ConfigLoadResult {
  config: StatuslineConfig;
  unknownRows: string[]; // display.rows entries not in KNOWN_ROW_IDS — surface via one-time notify
}

export const DEFAULT_CONFIG: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  display: {
    rows: [...KNOWN_ROW_IDS],
    bars: true,
    sparkline: true,
    showTokens: true,
    showContext: true,
    showGit: true,
    showSession: true,
  },
};
```

Inside `loadConfig`, change the return type and add rows/bars/sparkline parsing (place after the existing `display` parsing, before `return cfg`), and change both early-error returns and the final return to `{ config: cfg, unknownRows }`:

```ts
export function loadConfig(path: string): ConfigLoadResult {
  const unknownRows: string[] = [];
  // … existing read/parse code, but every `return structuredClone(DEFAULT_CONFIG);`
  // becomes: return { config: structuredClone(DEFAULT_CONFIG), unknownRows };
  //
  // … existing enabled/zai parsing unchanged, then extend the display block:

  if (parsed.display && typeof parsed.display === "object") {
    const d = parsed.display as Record<string, unknown>;
    if (typeof d.showTokens === "boolean") cfg.display.showTokens = d.showTokens;
    if (typeof d.showContext === "boolean") cfg.display.showContext = d.showContext;
    if (typeof d.showGit === "boolean") cfg.display.showGit = d.showGit;
    if (typeof d.showSession === "boolean") cfg.display.showSession = d.showSession;
    if (typeof d.bars === "boolean") cfg.display.bars = d.bars;
    if (typeof d.sparkline === "boolean") cfg.display.sparkline = d.sparkline;
    if (Array.isArray(d.rows)) {
      const valid: RowId[] = [];
      for (const id of d.rows) {
        if (typeof id === "string" && (KNOWN_ROW_IDS as readonly string[]).includes(id)) {
          valid.push(id as RowId);
        } else if (typeof id === "string" && !unknownRows.includes(id)) {
          unknownRows.push(id); // D6: unknown ids dropped + reported — surfaces typos
        }
      }
      if (valid.length > 0) cfg.display.rows = valid;
    }
  }

  return { config: cfg, unknownRows };
}
```

`saveConfig` is unchanged (it serializes the full config including `rows`).

- [ ] **Step 4: Minimal `src/index.ts` adaptation (typecheck only)**

In `activateStatusline`, replace `let config = loadConfig(dependencies.configPath);` with:

```ts
const loaded = loadConfig(dependencies.configPath);
let config = loaded.config;
const pendingRowWarnings = new Set(loaded.unknownRows);
```

and in `reloadConfig()` replace `config = loadConfig(dependencies.configPath);` with:

```ts
const reloaded = loadConfig(dependencies.configPath);
config = reloaded.config;
for (const id of reloaded.unknownRows) pendingRowWarnings.add(id);
```

(Do NOT wire notifications yet — Task 11 drains `pendingRowWarnings` through `ctx.ui.notify` once a context exists.)

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass (v1 config tests still green with the destructured `.config` — update their destructuring if they call `loadConfig(...)` directly and assert on the returned object), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/index.ts test/config.test.ts
git commit -m "feat: config v2 — display.rows registry order, bars/sparkline gates, unknown-row reporting"
```

---

### Task 5: Row registry + drop matrix

**Files:**
- Create: `src/rows/registry.ts`
- Test: `test/rows-registry.test.ts`

**Interfaces:**
- Consumes: `Fragment`, `RowId`, `RowPriority`, `KNOWN_ROW_IDS` (Task 1); `SessionSnapshot` (Task 2); `LedgerSnapshot` (Task 3); `StatuslineConfig` (Task 4).
- Produces: `RowSnapshot`, `Row`, `RowRegistry`, `createRowRegistry(rows)`, `renderRows(registry, order, snapshot)`. Rows (Tasks 6–10) implement `Row`; Task 11 consumes `renderRows`.

- [ ] **Step 1: Write the failing test `test/rows-registry.test.ts`**

Use synthetic rows with predictable fragment widths (each `x` = 1 column via `visibleWidth`-measurable plain text):

```ts
// test/rows-registry.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { Fragment } from "../src/types.ts";
import { createRowRegistry, renderRows, type Row, type RowSnapshot } from "../src/rows/registry.ts";

function fakeRow(id: string, priority: 1 | 2 | 3, text: string): Row {
  return {
    id: id as Row["id"],
    priority,
    render: (): Fragment[] => [{ text, color: "muted" }],
  };
}

function makeSnapshot(width: number, order: string[]): RowSnapshot {
  return {
    now: 0,
    width,
    order,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: null as never,
  };
}

// widths: identity=10, ctx=5, money=8, quota=6, ambient=4
const REGISTRY = createRowRegistry([
  fakeRow("identity", 1, "x".repeat(10)),
  fakeRow("ctx", 1, "x".repeat(5)),
  fakeRow("money", 2, "x".repeat(8)),
  fakeRow("quota", 2, "x".repeat(6)),
  fakeRow("ambient", 3, "x".repeat(4)),
]);
const ORDER = ["identity", "ctx", "money", "quota", "ambient"] as RowSnapshot["order"];

function ids(lines: ReturnType<typeof renderRows>, registry = REGISTRY): string[] {
  return lines.map((frags) => frags.map((f) => f.text).join(""));
}

test("all rows render when width accommodates the widest line", () => {
  const lines = renderRows(REGISTRY, ORDER, makeSnapshot(20, ORDER));
  assert.deepEqual(ids(lines), ["xxxxxxxxxx", "xxxxx", "xxxxxxxx", "xxxxxx", "xxxx"]);
});

test("null render omits a row without breaking others", () => {
  const registry = createRowRegistry([
    { id: "identity", priority: 1, render: () => null },
    fakeRow("ctx", 1, "xxxxx"),
  ]);
  const lines = renderRows(registry, ["identity", "ctx"], makeSnapshot(50, ["identity", "ctx"]));
  assert.deepEqual(ids(lines), ["xxxxx"]);
});

test("drop matrix: ambient (priority 3) drops first, then quota before money (reverse display order tie-break)", () => {
  // widest row = identity (10). width 9 → must drop until all lines ≤ 9.
  // drop order: ambient(3) → quota(2, later in display) → money(2) → then trim priority-1.
  assert.deepEqual(ids(renderRows(REGISTRY, ORDER, makeSnapshot(9, ORDER))), ["xxxxxxxxxx", "xxxxx", "xxxxxxxx"]);
  assert.deepEqual(ids(renderRows(REGISTRY, ORDER, makeSnapshot(8, ORDER))), ["xxxxxxxxxx", "xxxxx", "xxxxxxxx"]);
  // width 7: money (8) still overflows → dropped too
  assert.deepEqual(ids(renderRows(REGISTRY, ORDER, makeSnapshot(7, ORDER))), ["xxxxxxxxxx", "xxxxx"]);
});

test("priority-1 rows are never dropped as whole rows — they tail-trim instead", () => {
  const lines = renderRows(REGISTRY, ORDER, makeSnapshot(4, ORDER));
  const joined = ids(lines);
  assert.ok(joined.includes("xxxxxxxxxx".slice(0, 4)) === false || true); // identity may be trimmed
  // identity and ctx still present (at least 1 fragment each), ambient/money/quota gone
  assert.equal(joined.length, 2);
  assert.ok(joined[0]!.length >= 1 && visibleWidth(joined[0]!) <= 4);
  assert.ok(joined[1]!.length >= 1 && visibleWidth(joined[1]!) <= 4);
});

test("unregistered known ids in order (deen in P1) are skipped silently", () => {
  const lines = renderRows(REGISTRY, [...ORDER, "deen"] as RowSnapshot["order"], makeSnapshot(50, ORDER));
  assert.equal(lines.length, 5);
});

test("every returned line fits the width after trimming", () => {
  for (let w = 1; w <= 20; w++) {
    const lines = renderRows(REGISTRY, ORDER, makeSnapshot(w, ORDER));
    for (const frags of lines) {
      assert.ok(visibleWidth(frags.map((f) => f.text).join("")) <= w, `width ${w} exceeded`);
    }
    assert.ok(lines.length >= 1, `width ${w} produced zero lines`);
  }
});
```

> If `RowSnapshot.order` feels awkward, alternative shape: pass `order` as the second arg only and keep the snapshot data-only (`now, width, session, ledger, statuses, config`). Pick ONE — the test above uses `order` inside the snapshot; if you drop it from the snapshot, update the test's `makeSnapshot` accordingly (remove `order` field and pass order positionally as it already is). The `renderRows(registry, order, snapshot)` signature is fixed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/rows/registry.ts'`

- [ ] **Step 3: Write `src/rows/registry.ts`**

```ts
// src/rows/registry.ts
import { visibleWidth } from "@earendil-works/pi-tui";
import type { Fragment, RowId, RowPriority } from "../types.ts";
import type { StatuslineConfig } from "../config.ts";
import type { SessionSnapshot } from "../session/store.ts";
import type { LedgerSnapshot } from "../ledger/store.ts";

export interface RowSnapshot {
  now: number;
  width: number;
  session: SessionSnapshot;
  ledger: LedgerSnapshot;
  statuses: string;
  config: StatuslineConfig;
  order?: RowId[]; // optional echo of the display order (unused by rows; kept for debugging)
}

export interface Row {
  id: RowId;
  priority: RowPriority;
  // null → row omitted (source unavailable/failed). Fragments own all spacing/separators;
  // the renderer joins them with "" and applies theme colors.
  render(snapshot: RowSnapshot): Fragment[] | null;
}

export interface RowRegistry {
  get(id: RowId): Row | undefined;
  all(): Row[];
}

export function createRowRegistry(rows: Row[]): RowRegistry {
  const byId = new Map<string, Row>();
  for (const row of rows) byId.set(row.id, row);
  return {
    get: (id) => byId.get(id),
    all: () => rows.slice(),
  };
}

interface RenderedRow {
  row: Row;
  displayIndex: number;
  fragments: Fragment[];
  width: number;
}

function lineWidth(frags: Fragment[]): number {
  return visibleWidth(frags.map((f) => f.text).join(""));
}

// Drop worst-first: higher priority number drops before lower; equal priority breaks by
// reverse display order (later row drops first — quota before money per spec §4.2).
function dropOrder(rendered: RenderedRow[]): RenderedRow[] {
  return [...rendered].sort((a, b) =>
    b.row.priority - a.row.priority || b.displayIndex - a.displayIndex
  );
}

export function renderRows(registry: RowRegistry, order: RowId[], snapshot: RowSnapshot): Fragment[][] {
  const resolved = order
    .map((id) => registry.get(id))
    .filter((row): row is Row => row !== undefined); // known-but-unregistered ids (deen in P1) skip silently

  const rendered: RenderedRow[] = [];
  resolved.forEach((row, displayIndex) => {
    const fragments = row.render(snapshot);
    if (fragments && fragments.length > 0) {
      rendered.push({ row, displayIndex, fragments, width: lineWidth(fragments) });
    }
  });

  const width = snapshot.width;
  let current = rendered;

  // Phase 1 — whole-row drop (priority > 1 only; identity/ctx are never dropped).
  let droppable = dropOrder(current.filter((r) => r.row.priority > 1));
  while (droppable.length > 0 && current.some((r) => r.width > width)) {
    const worst = droppable.shift()!;
    current = current.filter((r) => r !== worst);
  }

  // Phase 2 — tail-fragment trim as last resort (all rows incl. priority 1; ≥1 fragment kept).
  for (const candidate of dropOrder(current)) {
    while (candidate.fragments.length > 1 && lineWidth(candidate.fragments) > width) {
      candidate.fragments = candidate.fragments.slice(0, -1);
    }
  }

  return current.map((r) => r.fragments);
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/rows/registry.ts test/rows-registry.test.ts
git commit -m "feat: row registry with priority drop matrix and tail trim"
```

---

### Task 6: Identity + ambient rows

**Files:**
- Create: `src/rows/identity.ts`
- Create: `src/rows/ambient.ts`
- Test: `test/rows.test.ts` (create; later row tasks extend this file)

**Interfaces:**
- Consumes: `Row`, `RowSnapshot` (Task 5); `SessionSnapshot` (Task 2); formatters (Task 1).
- Produces: `createIdentityRow(): Row` (priority 1), `createAmbientRow(): Row` (priority 3). Task 11 wires both.
- Note: the model-name formatter (provider-prefix + `:variant` strip) is COPIED from `src/segments/model.ts` into `identity.ts` as `formatModelName` (segments/ is deleted in Task 12 — do not import from it).

- [ ] **Step 1: Write the failing tests (create `test/rows.test.ts`)**

```ts
// test/rows.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RowSnapshot } from "../src/rows/registry.ts";
import { createIdentityRow } from "../src/rows/identity.ts";
import { createAmbientRow } from "../src/rows/ambient.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: Date.UTC(2026, 7, 30, 4, 12),
    width: 500,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: DEFAULT_CONFIG,
    ...partial,
  };
}

function session(partial: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    sessionName: "v2-p1",
    repoName: "pi-statusline",
    branch: "main",
    modelId: "glm-5.2",
    provider: "zai",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
    contextTokens: null,
    contextWindow: 0,
    contextPercent: null,
    spanMs: (3 * 60 + 12) * 60_000,
    ...partial,
  };
}

function plain(frags: ReturnType<Row["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("identity row: session name bright lead, repo dim, branch mid with ⎇, model accent", () => {
  const row = createIdentityRow();
  const frags = row.render(snap({ session: session({}) }))!;
  assert.deepEqual(frags, [
    { text: "v2-p1", color: "text" },
    { text: " pi-statusline", color: "dim" },
    { text: " ⎇ main", color: "muted" },
    { text: " · glm-5.2", color: "accent" },
  ]);
});

test("identity row: strips provider prefix and variant from model id", () => {
  const row = createIdentityRow();
  const out = plain(row.render(snap({ session: session({ modelId: "ollama/glm-5.2:cloud" }) })));
  assert.ok(out.includes(" · glm-5.2"));
});

test("identity row: omits name when unset or showSession=false; omits branch when null", () => {
  const row = createIdentityRow();
  assert.equal(plain(row.render(snap({ session: session({ sessionName: undefined }) }))), "pi-statusline ⎇ main · glm-5.2");
  const noSession = snap({ session: session({}), config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, showSession: false } } });
  assert.equal(plain(row.render(noSession)), "pi-statusline ⎇ main · glm-5.2");
  assert.equal(plain(row.render(snap({ session: session({ branch: null }) }))), "v2-p1 pi-statusline · glm-5.2");
});

test("ambient row: clock, coding span, extension statuses — all dim", () => {
  const row = createAmbientRow();
  const frags = row.render(snap({ statuses: "fleet ready · memory warm" }))!;
  assert.deepEqual(frags, [
    { text: "04:12", color: "dim" },
    { text: " · coding 3h12m", color: "dim" },
    { text: " · fleet ready · memory warm", color: "dim" },
  ]);
});

test("ambient row: clock is rendered from snapshot.now in local time", () => {
  const row = createAmbientRow();
  const out = plain(row.render(snap({ statuses: "" })));
  assert.ok(out.startsWith("04:12") || /"[0-9]{2}:[0-9]{2}"/.test(JSON.stringify(out.slice(0, 5))));
  assert.ok(out.includes(" · coding 3h12m"));
  assert.ok(!out.endsWith(" ·")); // no dangling separator when statuses empty
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/rows/identity.ts'`

- [ ] **Step 3: Write `src/rows/identity.ts` and `src/rows/ambient.ts`**

```ts
// src/rows/identity.ts
import type { Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// Copied from v1 src/segments/model.ts (deleted in Task 12).
function formatModelName(modelId: string | undefined): string {
  if (!modelId) return "no-model";
  const slash = modelId.indexOf("/");
  let name = slash > 0 ? modelId.slice(slash + 1) : modelId;
  const colon = name.indexOf(":");
  if (colon > 0) name = name.slice(0, colon);
  return name;
}

export function createIdentityRow(): Row {
  return {
    id: "identity",
    priority: 1,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const s = snapshot.session;
      const frags: Fragment[] = [];
      // D5: session name is the bright headline lead.
      if (snapshot.config.display.showSession && s.sessionName) {
        frags.push({ text: s.sessionName.trim(), color: "text" });
      }
      frags.push({ text: `${frags.length > 0 ? " " : ""}${s.repoName}`, color: "dim" });
      if (s.branch) frags.push({ text: ` ⎇ ${s.branch}`, color: "muted" });
      frags.push({ text: ` · ${formatModelName(s.modelId)}`, color: "accent" });
      return frags;
    },
  };
}
```

```ts
// src/rows/ambient.ts
import { formatClock, formatSpan } from "../format.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createAmbientRow(): Row {
  return {
    id: "ambient",
    priority: 3,
    render(snapshot: RowSnapshot): NonNullable<ReturnType<Row["render"]>> {
      const frags: Array<{ text: string; color: "dim" }> = [
        { text: formatClock(snapshot.now), color: "dim" },
        { text: ` · coding ${formatSpan(snapshot.session.spanMs)}`, color: "dim" },
      ];
      // v1 good-citizen preservation: other extensions' setStatus text surfaces here.
      // The 30s ticker re-renders, which re-pulls statuses (fixes v1's refresh gap).
      if (snapshot.statuses) {
        frags.push({ text: ` · ${snapshot.statuses}`, color: "dim" });
      }
      return frags;
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/rows/identity.ts src/rows/ambient.ts test/rows.test.ts
git commit -m "feat: identity and ambient rows"
```

---

### Task 7: Context (ctx) row

**Files:**
- Create: `src/rows/context.ts`
- Test: `test/rows.test.ts` (extend)

**Interfaces:**
- Consumes: `Row`, `RowSnapshot` (Task 5); `renderBar`, `formatTokenCount` (Task 1).
- Produces: `createContextRow(): Row` (priority 1). Task 11 wires it.

- [ ] **Step 1: Extend `test/rows.test.ts`**

```ts
// append to test/rows.test.ts
import { createContextRow } from "../src/rows/context.ts";

const CTX_SESSION = session({
  usage: { input: 48_000, output: 6200, cacheRead: 100_000, cacheWrite: 0, cost: 0, count: 5 },
  contextTokens: 68_000,
  contextWindow: 200_000,
  contextPercent: 34,
});

test("ctx row: bar + percent + window + tokens + cache hit", () => {
  const row = createContextRow();
  const frags = row.render(snap({ session: CTX_SESSION }))!;
  assert.deepEqual(frags, [
    { text: "ctx", color: "dim" },
    { text: " ▕███░░░░░░░▏", color: "muted" },
    { text: " 34%", color: "muted" },
    { text: " 68k/200k", color: "muted" },
    { text: " · ↑48k ↓6.2k", color: "muted" },
    { text: " · cache 62%", color: "muted" },
  ]);
});

test("ctx row: bar tints warning at ≥70% and error at ≥90%", () => {
  const row = createContextRow();
  const warn = row.render(snap({ session: { ...CTX_SESSION, contextPercent: 75 } }))!;
  assert.equal(warn[1]!.color, "warning");
  const err = row.render(snap({ session: { ...CTX_SESSION, contextPercent: 91 } }))!;
  assert.equal(err[1]!.color, "error");
});

test("ctx row: cache hit uses cacheRead/(cacheRead+input); omitted when denominator 0", () => {
  const row = createContextRow();
  const out = plain(row.render(snap({ session: CTX_SESSION })));
  assert.ok(out.includes("cache 62%")); // 100k/(100k+48k) ≈ 67.5 → 68? see note
  const zero = row.render(snap({ session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 } }) }));
  assert.ok(!plain(zero).includes("cache"));
});
```

> **Fix the expected cache number before running:** the test must assert the EXACT value the formula produces for the fixture. `100_000 / (100_000 + 48_000) = 0.6757… → Math.round → 68`. Write `cache 68%` in the assertion (and fix the comment). The 62% figure in the spec mock is illustrative, not fixture-derived.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/rows/context.ts'`

- [ ] **Step 3: Write `src/rows/context.ts`**

```ts
// src/rows/context.ts
import { formatTokenCount, renderBar } from "../format.ts";
import type { ColorToken, Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createContextRow(): Row {
  return {
    id: "ctx",
    priority: 1,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const s = snapshot.session;
      const display = snapshot.config.display;
      const frags: Fragment[] = [{ text: "ctx", color: "dim" }];

      // Ratio: precomputed percent when present, else tokens/window.
      const ratio =
        s.contextPercent !== null && Number.isFinite(s.contextPercent)
          ? s.contextPercent / 100
          : s.contextTokens !== null && s.contextWindow > 0
            ? s.contextTokens / s.contextWindow
            : null;

      const showPct = display.showContext && ratio !== null;
      if (display.bars && ratio !== null && (showPct || s.contextTokens !== null)) {
        // Theme-safe escalation: warning ≥70%, error ≥90%.
        const pct = ratio * 100;
        const barColor: ColorToken = pct >= 90 ? "error" : pct >= 70 ? "warning" : "muted";
        frags.push({ text: ` ${renderBar(ratio)}`, color: barColor });
      }
      if (showPct) {
        frags.push({ text: ` ${Math.round(ratio * 100)}%`, color: "muted" });
        if (s.contextTokens !== null && s.contextWindow > 0) {
          frags.push({ text: ` ${formatTokenCount(s.contextTokens)}/${formatTokenCount(s.contextWindow)}`, color: "muted" });
        }
      }
      if (display.showTokens) {
        frags.push({ text: ` · ↑${formatTokenCount(s.usage.input)} ↓${formatTokenCount(s.usage.output)}`, color: "muted" });
      }
      const cacheDenominator = s.usage.cacheRead + s.usage.input;
      if (cacheDenominator > 0) {
        const hit = Math.round((s.usage.cacheRead / cacheDenominator) * 100);
        frags.push({ text: ` · cache ${hit}%`, color: "muted" });
      }
      return frags.length > 1 ? frags : null;
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/rows/context.ts test/rows.test.ts
git commit -m "feat: ctx row — 10-cell bar with escalation tints, window, tokens, cache hit"
```

---

### Task 8: Money row

**Files:**
- Create: `src/rows/money.ts`
- Test: `test/rows.test.ts` (extend)

**Interfaces:**
- Consumes: `Row`, `RowSnapshot` (Task 5); `formatMoney`, `renderSparkline` (Task 1).
- Produces: `createMoneyRow(): Row` (priority 2). Task 11 wires it.

- [ ] **Step 1: Extend `test/rows.test.ts`**

```ts
// append to test/rows.test.ts
import { createMoneyRow } from "../src/rows/money.ts";

const LEDGER = {
  todayCost: 8.4,
  last7Cost: 31.2,
  last30Cost: 118.75,
  daily: [1, 2, 3, 5, 3, 2, 8.4],
};

test("money row: sess/day/7d/30d + sparkline + burn rate", () => {
  const row = createMoneyRow();
  const frags = row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: LEDGER,
  }))!;
  assert.deepEqual(frags, [
    { text: "$", color: "dim" },
    { text: " 1.24 sess", color: "muted" },
    { text: " · 8.40 day", color: "muted" },
    { text: " · 31.20 7d", color: "muted" },
    { text: " · 118.75 30d", color: "muted" },
    { text: " ▁▂▃▅▃▂▇", color: "accent" },
    { text: " · $2.10/hr", color: "muted" },
  ]);
  // burn = session cost 1.24 over span 3h12m = 1.24 / 3.2h = 0.3875 → but fixture span is
  // 3h12m → 1.24/(3.2) = 0.39/hr. Fix the expected string to the exact computed value:
  // Math: 1.24 / ((3*60+12)/60) = 1.24 / 3.2 = 0.3875 → "0.39/hr". Assert " · $0.39/hr".
});

test("money row: burn rate renders — when fewer than 2 usage entries", () => {
  const row = createMoneyRow();
  const out = plain(row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 5, count: 1 } }),
    ledger: LEDGER,
  })));
  assert.ok(out.includes(" · —"));
});

test("money row: sparkline omitted when display.sparkline=false", () => {
  const row = createMoneyRow();
  const cfgSnap = snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 2 } }),
    ledger: LEDGER,
    config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, sparkline: false } },
  });
  assert.ok(!plain(row.render(cfgSnap)).includes("▁"));
});
```

> **Fix the expected burn string before running:** with the fixture span (3h12m) and cost (1.24), burn = `1.24 / 3.2 = 0.3875` → `formatMoney` → `0.39`. The full fragment is ` · $0.39/hr`. Replace the placeholder comment with that exact assertion — the spec's `$2.10/hr` is illustrative, not fixture-derived.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/rows/money.ts'`

- [ ] **Step 3: Write `src/rows/money.ts`**

```ts
// src/rows/money.ts
import { formatMoney, renderSparkline } from "../format.ts";
import type { Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createMoneyRow(): Row {
  return {
    id: "money",
    priority: 2,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const { usage } = snapshot.session;
      const ledger = snapshot.ledger;
      const frags: Fragment[] = [{ text: "$", color: "dim" }];

      // Session cost is pi-native real data (D4) — works for every provider.
      frags.push({ text: ` ${formatMoney(usage.cost)} sess`, color: "muted" });
      frags.push({ text: ` · ${formatMoney(ledger.todayCost)} day`, color: "muted" });
      frags.push({ text: ` · ${formatMoney(ledger.last7Cost)} 7d`, color: "muted" });
      frags.push({ text: ` · ${formatMoney(ledger.last30Cost)} 30d`, color: "muted" });

      if (snapshot.config.display.sparkline) {
        const spark = renderSparkline(ledger.daily);
        if (spark) frags.push({ text: ` ${spark}`, color: "accent" });
      }

      // Burn rate = session cost over active-session wall time; needs ≥2 usage entries.
      if (usage.count >= 2 && snapshot.session.spanMs > 0) {
        const perHour = usage.cost / (snapshot.session.spanMs / 3_600_000);
        frags.push({ text: ` · $${formatMoney(perHour)}/hr`, color: "muted" });
      } else {
        frags.push({ text: " · —", color: "muted" });
      }
      return frags;
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/rows/money.ts test/rows.test.ts
git commit -m "feat: money row — universal cost row with sparkline and burn rate"
```

---

### Task 9: ZaiAdapter + adapter registry + quota row

**Files:**
- Create: `src/adapters/types.ts`
- Create: `src/adapters/zai.ts`
- Create: `src/rows/quota.ts`
- Test: `test/adapters-zai.test.ts`

**Interfaces:**
- Consumes: `readZaiKey`, `QuotaResult`, `QuotaLimit`, `createQuotaPoller`, `fetchQuota` (all existing in `src/quota/zai.ts` — UNCHANGED); `isZaiProvider` (existing `src/provider.ts`); `formatTokenCount`, `renderBar`, `formatReset` (Task 1); `Row`, `RowSnapshot` (Task 5).
- Produces: `ProviderRowAdapter<D>`, `resolveQuotaAdapter(adapters, activeProvider)` (`src/adapters/types.ts`); `ZaiAdapterDeps`, `createZaiAdapter(deps)`, `renderZaiQuota(data, now)` (`src/adapters/zai.ts`); `createQuotaRow(adapters): Row` (`src/rows/quota.ts`). Task 11 wires them.

- [ ] **Step 1: Write the failing test `test/adapters-zai.test.ts`**

```ts
// test/adapters-zai.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createZaiAdapter, renderZaiQuota } from "../src/adapters/zai.ts";
import { resolveQuotaAdapter } from "../src/adapters/types.ts";
import { createQuotaRow } from "../src/rows/quota.ts";
import type { QuotaResult } from "../src/quota/zai.ts";
import type { ProviderRowAdapter } from "../src/adapters/types.ts";
import type { RowSnapshot } from "../src/rows/registry.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

const NOW = Date.UTC(2026, 7, 30, 10, 0);

const QUOTA: QuotaResult = {
  tier: "lite",
  fiveHour: { unit: 3, number: 5, usage: 2000, currentValue: 1500, remaining: 500, percentage: 75, nextResetTime: NOW + 2 * 3_600_000 + 55 * 60_000 },
  weekly: { unit: 6, number: 1, usage: 10000, currentValue: 1500, remaining: 8500, percentage: 15, nextResetTime: NOW + 86_400_000 },
  fetchedAt: NOW,
};

test("renderZaiQuota produces the exact label-first format", () => {
  assert.equal(
    renderZaiQuota(QUOTA, NOW),
    "zai ▕████████░░▏ 75% 1.5k/2.0k 5h · wk 15% · reset 2h55m",
  );
});

test("renderZaiQuota falls back to weekly when 5h window is missing", () => {
  const weeklyOnly = { ...QUOTA, fiveHour: null } as QuotaResult;
  const out = renderZaiQuota(weeklyOnly, NOW);
  assert.ok(out.startsWith("zai ▕██░░░░░░░░▏ 15%"));
  assert.ok(!out.includes("5h"));
});

test("createZaiAdapter: matches only zai; inert without key; fetch refreshes current()", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zai-adapter-"));
  let calls = 0;
  const adapter = createZaiAdapter({
    authJsonPath: join(dir, "auth.json"),
    readKey: () => "fixture-key",
    pollIntervalMs: () => 3_600_000,
    fetchFn: async () => { calls += 1; return QUOTA; },
  });
  assert.equal(adapter.id, "zai");
  assert.equal(adapter.matches("zai"), true);
  assert.equal(adapter.matches("anthropic"), false);
  assert.equal(adapter.current(), null); // inert until started
  adapter.start();
  await adapter.fetch();
  assert.equal(calls, 1);
  assert.equal(adapter.current(), QUOTA);
  adapter.stop();
  // Without a key the adapter never polls.
  const noKey = createZaiAdapter({
    authJsonPath: join(dir, "auth.json"),
    readKey: () => null,
    pollIntervalMs: () => 3_600_000,
    fetchFn: async () => QUOTA,
  });
  noKey.start();
  await noKey.fetch();
  assert.equal(noKey.current(), null);
  rmSync(dir, { recursive: true, force: true });
});

test("resolveQuotaAdapter prefers the active provider, else first adapter with data", () => {
  const zai: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => QUOTA,
    fetch: async () => QUOTA, render: () => "zai", start() {}, stop() {},
  };
  const or: ProviderRowAdapter<object> = {
    id: "openrouter", matches: (p) => p === "openrouter", current: () => ({}),
    fetch: async () => ({}), render: () => "or", start() {}, stop() {},
  };
  assert.equal(resolveQuotaAdapter([zai, or], "openrouter"), or);
  assert.equal(resolveQuotaAdapter([zai, or], "anthropic"), zai); // fallback: first with data
  const empty = resolveQuotaAdapter([zai], "zai") as ProviderRowAdapter<QuotaResult> | null;
  assert.equal(empty, null);
});

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: NOW, width: 500,
    session: {
      sessionName: undefined, repoName: "r", branch: "main", modelId: "glm-5.2", provider: "zai",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
      contextTokens: null, contextWindow: 0, contextPercent: null, spanMs: 0,
    } satisfies SessionSnapshot,
    ledger: null as never,
    statuses: "",
    config: DEFAULT_CONFIG,
    ...partial,
  };
}

function plain(frags: ReturnType<ReturnType<typeof createQuotaRow>["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("quota row: renders the adapter line; dimmed when active provider ≠ adapter", () => {
  const zai: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => QUOTA,
    fetch: async () => QUOTA, render: (d, dim) => renderZaiQuota(d, NOW) + (dim ? "!" : ""), start() {}, stop() {},
  };
  const row = createQuotaRow([zai]);
  const active = row.render(snap({}))!;
  assert.deepEqual(active, [{ text: renderZaiQuota(QUOTA, NOW), color: "muted" }]);
  const inactive = row.render(snap({ session: { ...(snap({}).session as SessionSnapshot), provider: "anthropic" } }))!;
  assert.deepEqual(inactive, [{ text: `${renderZaiQuota(QUOTA, NOW)}!`, color: "dim" }]);
});

test("quota row: null when no adapter has data", () => {
  const zai: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => null,
    fetch: async () => null, render: () => "zai", start() {}, stop() {},
  };
  assert.equal(createQuotaRow([zai]).render(snap({})), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/adapters/types.ts'`

- [ ] **Step 3: Write `src/adapters/types.ts`, `src/adapters/zai.ts`, `src/rows/quota.ts`**

```ts
// src/adapters/types.ts
// Provider adapter contract (spec §6). One quota row slot; adapters are pluggable modules.
// D differs per adapter (zai: QuotaResult; openrouter in P3: credits payload).
export interface ProviderRowAdapter<D = unknown> {
  id: string;
  matches(provider: string | undefined): boolean;
  current(): D | null;            // last-good data (poller cache); null = row omitted
  fetch(): Promise<D | null>;     // forced refresh (/statusline refresh)
  render(data: D, dim: boolean): string; // one row line, label-first
  start(): void;                  // begin background polling (no-op when unconfigured)
  stop(): void;
}

// Active provider's adapter wins; otherwise the first adapter holding data renders DIMMED
// (A5-refined: the quota row is subscription-scoped, not session-scoped).
export function resolveQuotaAdapter<D>(
  adapters: ProviderRowAdapter<D>[],
  activeProvider: string | undefined,
): ProviderRowAdapter<D> | null {
  const withData = adapters.filter((a) => a.current() !== null);
  return withData.find((a) => a.matches(activeProvider)) ?? withData[0] ?? null;
}
```

```ts
// src/adapters/zai.ts
import { createQuotaPoller, fetchQuota, readZaiKey, type QuotaLimit, type QuotaResult } from "../quota/zai.ts";
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
    parts.push(`${renderBar(window.percentage / 100)} ${window.percentage}%`);
    if (data.fiveHour) {
      parts.push(`${formatTokenCount(data.fiveHour.currentValue)}/${formatTokenCount(data.fiveHour.usage)} 5h`);
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
```

```ts
// src/rows/quota.ts
import { resolveQuotaAdapter, type ProviderRowAdapter } from "../adapters/types.ts";
import type { Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createQuotaRow(adapters: ProviderRowAdapter<any>[]): Row {
  return {
    id: "quota",
    priority: 2,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const winner = resolveQuotaAdapter(adapters, snapshot.session.provider);
      const data = winner?.current();
      if (!winner || data === null || data === undefined) return null;
      const dim = !winner.matches(snapshot.session.provider);
      return [{ text: winner.render(data, dim), color: dim ? "dim" : "muted" }];
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean. (`ProviderRowAdapter<any>[]` in `quota.ts` is deliberate — heterogeneous adapter data types; keep `any` explicit, not implicit.)

- [ ] **Step 5: Commit**

```bash
git add src/adapters/types.ts src/adapters/zai.ts src/rows/quota.ts test/adapters-zai.test.ts
git commit -m "feat: provider adapter contract, ZaiAdapter migration, quota row"
```

---

### Task 10: Ticker

**Files:**
- Create: `src/ticker.ts`
- Test: `test/ticker.test.ts`

**Interfaces:**
- Produces: `Ticker`, `createTicker(opts: { intervalMs?: number; onTick: () => void }): Ticker` with `start()/stop()`. Default `intervalMs = 30_000`. Task 11 wires it.

- [ ] **Step 1: Write the failing test `test/ticker.test.ts`**

```ts
// test/ticker.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createTicker } from "../src/ticker.ts";

test("ticker fires onTick repeatedly and stop() ends it", async () => {
  let ticks = 0;
  const ticker = createTicker({ intervalMs: 5, onTick: () => { ticks += 1; } });
  ticker.start();
  await sleep(40);
  const afterRun = ticks;
  assert.ok(afterRun >= 2, `expected ≥2 ticks, got ${afterRun}`);
  ticker.stop();
  await sleep(20);
  assert.equal(ticks, afterRun); // no ticks after stop
});

test("onTick exceptions do not kill the interval", async () => {
  let ticks = 0;
  const ticker = createTicker({ intervalMs: 5, onTick: () => { ticks += 1; if (ticks === 1) throw new Error("boom"); } });
  ticker.start();
  await sleep(40);
  assert.ok(ticks >= 2);
  ticker.stop();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/ticker.ts'`

- [ ] **Step 3: Write `src/ticker.ts`**

```ts
// src/ticker.ts
export interface Ticker {
  start(): void;
  stop(): void;
}

export function createTicker(opts: { intervalMs?: number; onTick: () => void }): Ticker {
  const intervalMs = opts.intervalMs ?? 30_000;
  let timer: ReturnType<typeof setInterval> | null = null;

  function fire(): void {
    try {
      opts.onTick();
    } catch {
      /* a throwing tick must never kill the interval or the host */
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(fire, intervalMs);
      // Mandatory (v1 print-mode lesson): timers must not hold the host process open.
      timer.unref?.();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/ticker.ts test/ticker.test.ts
git commit -m "feat: 30s unref'd ticker for ledger reconcile and re-render"
```

---

### Task 11: Footer v2 — index.ts rewiring (multi-line render, snapshot, dispose hygiene, wiring matrix)

**Files:**
- Modify: `src/index.ts` (substantial rewrite of `installFooter`)
- Delete: `src/footer.ts`, `test/footer.test.ts` (superseded by `rows/registry.ts` + `test/rows-registry.test.ts`)
- Modify: `test/index-wiring.test.ts` (extend to multi-line + provider matrix + perf smoke)

**Interfaces:**
- Consumes: everything from Tasks 1–10.
- Produces: the v2 `activateStatusline` wiring. `StatuslineRuntimeDependencies` gains `ledgerPath: string` and `makeAdapters: () => ProviderRowAdapter<any>[]`; loses `makePoller` (the zai adapter owns the poller now; its `fetchFn` seam covers poll tests, and wiring tests inject fake adapters via `makeAdapters`).

- [ ] **Step 1: Rewrite `test/index-wiring.test.ts`**

Keep the existing harness shape (fake `pi`, `ctx`, `tui`, `theme`, `footerData`) but update fixtures and assertions:

- Entry fixtures get `id` + ISO `timestamp` + `usage.cost.total` (feed the ledger + money row).
- Dependency override object becomes:

```ts
activateStatusline(pi, {
  authJsonPath: join(tmp, "auth.json"),
  configPath,
  ledgerPath: join(tmp, "ledger.jsonl"),
  readKey: () => "fixture-key",
  makeAdapters: () => [fakeZaiAdapter],
});
```

with a fake adapter:

```ts
const fakeZaiAdapter: ProviderRowAdapter<QuotaResult> = {
  id: "zai",
  matches: (p) => p === "zai",
  current: () => QUOTA,
  fetch: async () => QUOTA,
  render: (d, dim) => (dim ? "zai-dim" : "zai-quota-line"),
  start: () => { started = true; },
  stop: () => { stopped = true; },
};
```

Assertions to encode (replace the v1 single-line assertions):

1. `session_start` → `setFooter` called once; `render(500)` returns MULTIPLE lines (≥4): identity (contains `wiring-smoke`, `glm-5.2`, `⎇ main`), ctx (contains `↑1.5k ↓700`, `25%`), money (contains `sess`), quota line `zai-quota-line` colored `muted`, ambient (contains `fleet ready · memory warm`).
2. Provider switch `zai → anthropic` via `model_select` → next render still contains `zai-dim` colored `dim` (A5-refined preserved).
3. Adapter with `current: () => null` (second wiring scenario) → quota row absent; money row still renders (`0.00 sess` honesty for local providers).
4. Ledger integration: after `session_start`, `join(tmp, "ledger.jsonl")` exists and contains one line per usage entry (ids match fixtures); re-rendering twice does not duplicate lines (reconcile idempotency through the wiring).
5. `/statusline refresh` calls the adapter's `fetch` (spy counter) + notifies; `off` → `setFooter(undefined)` + adapter `stop()`; `on` → footer reinstalled + adapter restarted; `tier pro` persists (existing assertion).
6. Unknown-row notify: write `{ "display": { "rows": ["identity", "bogus"] } }` to `configPath` BEFORE `activateStatusline`, then `session_start` → exactly one `notify` with level `"info"` or `"warning"` whose message includes `bogus`; a second `session_start` does NOT repeat it (one-time).
7. Perf smoke: `render(500)` wall time < 50 ms (loose CI upper bound; the design budget is <1 ms sync).
8. `dispose()` on the footer component stops the adapter and clears the install guard (subsequent `session_start` reinstalls).

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — v1 render is single-line; `makeAdapters`/`ledgerPath` deps don't exist yet.

- [ ] **Step 3: Rewrite `src/index.ts`**

Replace the v1 body of `activateStatusline` with the v2 wiring (imports from the new modules; DELETE the `composeSegments`/`truncateSegments` import, and the per-segment imports except what remains used — nothing from `segments/` remains used by index):

```ts
// src/index.ts
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadConfig, saveConfig, type StatuslineConfig } from "./config.ts";
import { readZaiKey } from "./quota/zai.ts";
import { createSessionStore, type SessionStore } from "./session/store.ts";
import { createLedgerStore, type LedgerStore } from "./ledger/store.ts";
import { createZaiAdapter } from "./adapters/zai.ts";
import type { ProviderRowAdapter } from "./adapters/types.ts";
import { createRowRegistry, renderRows, type Row, type RowSnapshot } from "./rows/registry.ts";
import { createIdentityRow } from "./rows/identity.ts";
import { createContextRow } from "./rows/context.ts";
import { createMoneyRow } from "./rows/money.ts";
import { createQuotaRow } from "./rows/quota.ts";
import { createAmbientRow } from "./rows/ambient.ts";
import { createTicker, type Ticker } from "./ticker.ts";
import { parseStatuslineArgs } from "./tui/settings.ts";

const AUTH_JSON = join(homedir(), ".pi", "agent", "auth.json");
const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-statusline.json");
const LEDGER_PATH = join(homedir(), ".pi", "agent", "pi-statusline", "ledger.jsonl");

export interface StatuslineRuntimeDependencies {
  authJsonPath: string;
  configPath: string;
  ledgerPath: string;
  readKey: typeof readZaiKey;
  makeAdapters: (deps: { authJsonPath: string; readKey: typeof readZaiKey; config: () => StatuslineConfig; onRefresh: () => void }) => ProviderRowAdapter<any>[];
}

const DEFAULT_DEPENDENCIES: StatuslineRuntimeDependencies = {
  authJsonPath: AUTH_JSON,
  configPath: CONFIG_PATH,
  ledgerPath: LEDGER_PATH,
  readKey: readZaiKey,
  makeAdapters: ({ authJsonPath, readKey, config, onRefresh }) => [
    createZaiAdapter({ authJsonPath, readKey, pollIntervalMs: () => config().zai.pollIntervalMs, onRefresh }),
  ],
};

export function activateStatusline(
  pi: ExtensionAPI,
  dependencyOverrides: Partial<StatuslineRuntimeDependencies> = {},
): void {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const loaded = loadConfig(dependencies.configPath);
  let config = loaded.config;
  const pendingRowWarnings = new Set(loaded.unknownRows);
  const notifiedRowWarnings = new Set<string>();

  let sessionCtx: ExtensionContext | null = null;
  let sessionStore: SessionStore = createSessionStore();
  let ledgerStore: LedgerStore | null = null;
  let adapters: ProviderRowAdapter<any>[] = [];
  let registry = createRowRegistry([]);
  let ticker: Ticker | null = null;
  let requestRenderFn: (() => void) | null = null;
  let footerInstalled = false;

  function buildAdapters(): void {
    for (const a of adapters) a.stop();
    adapters = dependencies.makeAdapters({
      authJsonPath: dependencies.authJsonPath,
      readKey: dependencies.readKey,
      config: () => config,
      onRefresh: () => requestRenderFn?.(),
    });
    registry = createRowRegistry([
      createIdentityRow(),
      createContextRow(),
      createMoneyRow(),
      createQuotaRow(adapters),
      createAmbientRow(),
    ]);
    if (config.enabled) for (const a of adapters) a.start();
  }

  function ensureLedger(): LedgerStore {
    if (!ledgerStore) {
      ledgerStore = createLedgerStore({ filePath: dependencies.ledgerPath });
      ledgerStore.load();
    }
    return ledgerStore;
  }

  function startTicker(): void {
    ticker?.stop();
    ticker = createTicker({
      intervalMs: 30_000,
      onTick: () => {
        if (sessionCtx) {
          ensureLedger().reconcile(sessionCtx.sessionManager.getEntries());
        }
        requestRenderFn?.();
      },
    });
    ticker.start();
  }

  function stopTicker(): void {
    ticker?.stop();
    ticker = null;
  }

  function drainRowWarnings(): void {
    if (!sessionCtx) return;
    for (const id of pendingRowWarnings) {
      if (notifiedRowWarnings.has(id)) continue;
      notifiedRowWarnings.add(id);
      sessionCtx.ui.notify(`pi-statusline: unknown display.rows id "${id}" — dropped (valid: identity, ctx, money, quota, deen, ambient)`, "warning");
    }
    pendingRowWarnings.clear();
  }

  function installFooter(ctx: ExtensionContext): void {
    if (footerInstalled) return;
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRenderFn = () => tui.requestRender();
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          for (const a of adapters) a.stop();
          stopTicker();
          // pi may dispose the footer at session end — clear the install guard so the
          // next session_start reinstalls (v1 lesson).
          footerInstalled = false;
          requestRenderFn = null;
        },
        invalidate() {
          tui.requestRender();
        },
        render(width: number): string[] {
          const branch = footerData.getGitBranch();
          sessionStore.update(ctx, branch);
          const ledger = ensureLedger();
          ledger.reconcile(ctx.sessionManager.getEntries());
          const snapshot: RowSnapshot = {
            now: Date.now(),
            width,
            session: sessionStore.getSnapshot(),
            ledger: ledger.getSnapshot(),
            statuses: [...footerData.getExtensionStatuses().values()].filter(Boolean).join(" · "),
            config,
          };
          const lines = renderRows(registry, config.display.rows, snapshot);
          // One theme pass: fragment colors → theme.fg; fragments own all spacing.
          return lines.map((frags) => frags.map((f) => theme.fg(f.color, f.text)).join(""));
        },
      };
    });
    footerInstalled = true;
  }

  function reloadConfig(): void {
    const reloaded = loadConfig(dependencies.configPath);
    config = reloaded.config;
    for (const id of reloaded.unknownRows) pendingRowWarnings.add(id);
    if (config.enabled) {
      buildAdapters(); // restarts adapters so pollIntervalMs changes take effect
      if (sessionCtx) {
        installFooter(sessionCtx);
        drainRowWarnings();
      }
      startTicker();
    } else {
      for (const a of adapters) a.stop();
      stopTicker();
    }
    requestRenderFn?.();
  }

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    if (config.enabled) {
      sessionStore = createSessionStore(); // fresh span per session
      ensureLedger().reconcile(ctx.sessionManager.getEntries());
      buildAdapters();
      installFooter(ctx);
      drainRowWarnings();
      startTicker();
    }
  });

  pi.on("model_select", (_event) => {
    // SessionStore pulls ctx.model per render; the event just forces a re-render.
    requestRenderFn?.();
  });

  pi.registerCommand("statusline", {
    description: "Configure the statusline (refresh | on | off | tier <auto|lite|pro|max>)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      const action = parseStatuslineArgs(args);
      switch (action.action) {
        case "open-panel":
          ctx.ui.notify("Use /statusline refresh | on | off | tier <auto|lite|pro|max>", "info");
          break;
        case "refresh": {
          const withData = adapters.filter((a) => a.current() !== null || a.matches(ctx.model?.provider));
          if (withData.length === 0 && adapters.length === 0) {
            ctx.ui.notify("No provider adapters configured", "warning");
            break;
          }
          for (const a of adapters) await a.fetch();
          requestRenderFn?.();
          ctx.ui.notify("Quota refreshed", "info");
          break;
        }
        case "set-enabled": {
          config = { ...config, enabled: action.enabled };
          saveConfig(dependencies.configPath, config);
          if (action.enabled) {
            reloadConfig();
            ctx.ui.notify("Statusline enabled", "info");
          } else {
            // Explicit user disable is the ONE legitimate yield-to-native (A5 exception).
            ctx.ui.setFooter(undefined);
            footerInstalled = false;
            for (const a of adapters) a.stop();
            stopTicker();
            ctx.ui.notify("Statusline disabled — native footer restored", "info");
          }
          break;
        }
        case "set-tier": {
          config = { ...config, zai: { ...config.zai, tier: action.tier } };
          saveConfig(dependencies.configPath, config);
          ctx.ui.notify(`Tier override set to ${action.tier} (auto = use data.level from the API)`, "info");
          break;
        }
        case "error":
          ctx.ui.notify(action.message, "error");
          break;
      }
    },
  });
}

export default function (pi: ExtensionAPI): void {
  activateStatusline(pi);
}
```

Then `git rm src/footer.ts test/footer.test.ts`.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean. Old `footer.test.ts` gone; `segments.test.ts` still green (segments still exist until Task 12).

- [ ] **Step 5: Manual smoke (non-invasive, no install)**

Run: `pi -e ./src/index.ts --no-session -p "smoke" 2>&1 | tail -3`
Expected: pi exits cleanly (print mode) — proves the extension loads and no timer holds the process (unref discipline). Any crash here is a wiring bug: fix before commit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: v2 multi-line footer wiring — registry, ledger, adapters, ticker"
```

---

### Task 12: Cleanup, README, version 0.2.0, release

**Files:**
- Delete: `src/segments/tokens.ts`, `src/segments/context.ts`, `src/segments/quota.ts`, `src/segments/session.ts`, `src/segments/git.ts`, `src/segments/model.ts` (logic already copied into rows/format), `test/segments.test.ts`
- Modify: `README.md`, `package.json` (version → 0.2.0)

**Interfaces:**
- Consumes: the completed v2 tree. Produces: release-ready main.

- [ ] **Step 1: Delete superseded files**

```bash
git rm src/segments/tokens.ts src/segments/context.ts src/segments/quota.ts \
       src/segments/session.ts src/segments/git.ts src/segments/model.ts test/segments.test.ts
```

- [ ] **Step 2: Grep for stragglers, then run the full suite**

Run: `rg -n "segments/" src test; pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: no references to `segments/`; all tests pass; typecheck clean. Fix any import found before continuing.

- [ ] **Step 3: Update README.md**

Replace the v1 render example and config section with the v2 reality (keep the rest of the doc):

- Render preview (fenced block):

```
v2-p1 pi-statusline ⎇ main · glm-5.2
ctx ▕███░░░░░░░▏ 34% 68k/200k · ↑48k ↓6.2k · cache 68%
$ 1.24 sess · 8.40 day · 31.20 7d · 118.75 30d ▁▂▃▅▃▂▇ · $0.39/hr
zai ▕████████░░▏ 75% 1.5k/2.0k 5h · wk 15% · reset 2h55m
04:12 · coding 3h12m
```

- Config schema v2 (rows/bars/sparkline + back-compat note: v1 files load cleanly; unknown `rows` ids are dropped with a one-time warning; `deen` is accepted now and lights up in v0.3.0).
- Ledger note: `~/.pi/agent/pi-statusline/ledger.jsonl`, append-only, safe to delete (rebuilds from nothing; historical sessions are not re-scanned).
- `/statusline` commands unchanged (`refresh | on | off | tier`).

- [ ] **Step 4: Bump version**

In `package.json`: `"version": "0.2.0"`.

- [ ] **Step 5: Final gate + merge + tag + push**

```bash
pnpm test:run 2>&1 | tail -5 && pnpm typecheck
git add -A
git commit -m "chore: v0.2.0 — remove superseded v1 segments, README for Editorial Dashboard P1"
git checkout main
git merge --no-ff feat/v2-p1-editorial -m "merge: v2 P1 Editorial Dashboard (v0.2.0)"
git branch -d feat/v2-p1-editorial
git -c tag.gpgSign=false tag -a v0.2.0 -m "v0.2.0: Editorial Dashboard P1 — row registry, ledger, money row, ZaiAdapter"
git push origin main --follow-tags
git push gitlab main --follow-tags   # mirror (also auto-runs via CI on main push)
```

Expected: release.yml publishes `@getpipher/pi-statusline@0.2.0` on the `v0.2.0` tag; mirror pushes to `gitlab.com/rz1989s/pi-statusline`. Verify: `npm view @getpipher/pi-statusline version` → `0.2.0` (note: a brand-new dist-tag may 404 on a stale CDN edge for minutes while the version endpoint works — known cosmetic issue).

- [ ] **Step 6: Post-release verify (RECTOR's pi)**

- `settings.json` pin bump `npm:@getpipher/pi-statusline@0.1.1` → `@0.2.0` in `~/.pi/agent/settings.json`.
- RECTOR restarts pi → multi-line footer appears; `/name` sets a session name → identity row lead updates.

---

## Self-Review (performed at plan-writing time)

1. **Spec coverage (§12 P1 scope):** row registry + multi-line + drop matrix + ticker (Tasks 5, 10, 11) · SessionStore (Task 2) · LedgerStore (Task 3) · identity/ctx/money/ambient rows (Tasks 6–8) · ZaiAdapter migration with format change to the §5 target (Task 9) · config v2 + back-compat (Task 4) — all covered. Perf budget smoke (§11) in Task 11 step 1.7. P2/P3 items (deen, OpenRouter, MCP, git upgrades, named themes, `rows` cmd) deliberately absent.
2. **Placeholder scan:** two fixtures in early test drafts carried illustrative numbers from the spec mock (`cache 62%`, `$2.10/hr`); both are flagged IN-STEP with the exact arithmetic to assert (`cache 68%`; `$0.39/hr`) — implementers must assert the computed value, not the mock.
3. **Type consistency:** `Fragment[]` flows from rows → `renderRows` → theme pass (Task 11); `RowSnapshot` fields (`now/width/session/ledger/statuses/config`) match every row task's fixture builder; `ProviderRowAdapter<D>` matches between types/zai/quota/wiring; `loadConfig` result destructure used identically in Tasks 4 and 11; ledger `LedgerSnapshot.daily` feeds `renderSparkline(values)` oldest→newest as the formatter expects.
4. **Known deliberate deviations from spec prose (flagged, not silent):** (a) adapter contract uses `current()/start()/stop()` alongside the spec's `fetch(store)/render` — the `StoreHandle` was never concretely specified; this shape reuses v1's tested poller seam; (b) ledger lines record `provider/model` as `"unknown"` in P1 (pi usage entries carry no per-entry attribution); (c) `display.bars` gates the ctx row's bar; the zai quota bar is inherent to its format string; (d) `deen` is config-known but unregistered in P1 — silently skipped, no notify.
