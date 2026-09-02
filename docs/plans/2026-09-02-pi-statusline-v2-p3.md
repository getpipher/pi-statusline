# pi-statusline v2 P3 — Environment & Adapters (v0.4.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the P3 scope (spec §15 + §12): Est block projection, burn-anchor option, version stamps, GitSource upgrades (dirty / ahead-behind / commits-today), OpenRouter credits adapter, named themes, and the `rows` command — closing CC parity to ~14/14 live groups.

**Architecture:** Everything lands as a new Source/module + a row-fragment consumption, wired through the existing `RowSnapshot` → `renderRows` pipeline. The render path never awaits: new async work (git subprocess, OR poller) mutates caches off-path and calls `requestRender`. Ledger gains provider attribution + scoped queries; the quota poller is genericized so the OpenRouter adapter reuses it.

**Tech Stack:** TypeScript (strict, 2-space, raw `.ts` run via tsx), node:test, `node:child_process` (git), fetch with `AbortSignal.timeout`.

## Global Constraints (every task implicitly includes these)

- Org spelling **getpipher** (two p's, never "getpither"). No AI attribution anywhere.
- 2-space indent, TypeScript strict (`pnpm typecheck` clean), `pnpm test:run` green after every task.
- TDD: RED → GREEN per behavior. One commit per feature/fix.
- Secrets (zai/openrouter keys) are read from `auth.json`, **never logged, never committed**.
- Timers MUST `.unref()`. The render path NEVER awaits; fetch/exec failures degrade to `null`/stale, never throw into render.
- Colors are theme tokens only (`text muted dim accent warning error success toolTitle`) — never hardcoded ANSI.
- Session entries via `getEntries()` (ALL), never `getBranch()`.
- Visual changes must be verified via tmux spawn + `capture ansi:true` (SGR bytes are ground truth) — applies to Tasks 4–9 final wiring.
- Work on branch `feat/v2-p3-env-adapters` (base: `main`). Release (merge + tag + npm) is **HELD for post-final-review** — do not tag during task execution.
- **Verified feasibility results (2026-09-02, pi 0.84.4 — do NOT re-derive):**
  - **MCP row: NO accessor exists.** `ExtensionContext`/`ExtensionAPI` expose zero MCP surface (`rg "mcp|Mcp" dist/core/extensions/types.d.ts` → no matches). Per spec §12, the MCP row **stays omitted** — there is intentionally NO MCP task in this plan. Extension statuses remain the ambient surface (v1 behavior preserved).
  - **PI host version: NO accessor** (`getVersion/hostVersion/appVersion` absent; no `PI_VERSION` env — `PI_DEFAULT_VERSION` is a Gemini SDK constant). Spec §15's sanctioned fallback applies: read the resolvable `@earendil-works/pi-coding-agent/package.json` version at runtime (the pi copy our package links against); on any failure → self-only stamp.

## Design deviations from the approved design doc (flagged for RECTOR, pre-approved scope language)

1. **OR row `today` + `top:` fragments come from OUR ledger, not OpenRouter APIs.** Design §6's example implies server-side today/top-model data; `/api/v1/credits` only returns `total_credits`/`total_usage`. Rather than inventing endpoints, the adapter derives `today` (provider-scoped day sum) and `top` (top model by cost today) from our ledger (locked decision D7 scope: "credits left / today / top-model"). This requires ledger provider attribution — Task 1.
2. **`est` ships on the zai 5h window only.** Spec §15: "$ projection secondary for metered providers" — but metered providers have no quota row for it to ride ("row omitted with the quota row when no adapter") and OpenRouter credits have no window to project to. Primary zai-credit projection ships; $-secondary is structurally omitted (documented, not silently dropped).

---

### Task 1: Ledger provider attribution + scoped queries

**Files:**
- Modify: `src/ledger/store.ts` (opts, `toLine`, `LedgerStore` interface + impl)
- Test: `test/ledger.test.ts`

**Interfaces:**
- Consumes: existing `createLedgerStore(opts)`, `LedgerLine` (`provider`/`model` fields already exist, written as `"unknown"` today).
- Produces (later tasks rely on these EXACT signatures):
  - `LedgerStoreOpts.attribute?: () => { provider: string; model: string }`
  - `LedgerStore.costSince(ts: number): number` — sum of `cost` where `line.ts >= ts`.
  - `LedgerStore.providerTodayCost(provider: string): number` — today's (store clock + offset) sum where `line.provider === provider`.
  - `LedgerStore.providerTodayTopModel(provider: string): { model: string; cost: number } | null` — top model by cost today for that provider; `null` when no lines.
  - New lines record `attribute()`'s provider/model when the option is passed; absent → `"unknown"` (unchanged legacy behavior).

- [ ] **Step 1: Write the failing tests** — append to `test/ledger.test.ts`:

```ts
test("attribute(): new lines record live provider/model; absent option stays unknown", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-attr-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({
    filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT,
    attribute: () => ({ provider: "openrouter", model: "claude-opus-4.6" }),
  });
  store.load();
  store.reconcile([entry("at1", "2026-08-30T09:00:00.000Z", 0.25)]);
  const raw = JSON.parse(readFileSync(filePath, "utf8").trim().split("\n")[0]!);
  assert.equal(raw.provider, "openrouter");
  assert.equal(raw.model, "claude-opus-4.6");
  assert.equal(raw.repo, "unknown"); // repo option not passed here — orthogonal
  rmSync(dir, { recursive: true, force: true });
});

test("costSince(ts) sums costs on/after the timestamp (burn-anchor query)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-since-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({ filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT });
  store.load();
  store.reconcile([
    entry("s1", "2026-08-30T07:00:00.000Z", 0.5), // before blockStart
    entry("s2", "2026-08-30T08:00:00.000Z", 0.25), // at blockStart (inclusive)
    entry("s3", "2026-08-30T09:30:00.000Z", 1.0),
  ]);
  assert.equal(store.costSince(Date.parse("2026-08-30T08:00:00.000Z")), 1.25);
  assert.equal(store.costSince(Date.parse("2026-08-30T07:00:00.001Z")), 1.25); // strictly-before excluded
  assert.equal(store.costSince(Number.MAX_SAFE_INTEGER), 0);
  rmSync(dir, { recursive: true, force: true });
});

test("providerTodayCost / providerTodayTopModel scope by provider + today (store clock)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-prov-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({
    filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT,
    attribute: () => ({ provider: "openrouter", model: "claude-opus-4.6" }),
  });
  store.load();
  store.reconcile([
    entry("p1", "2026-08-30T02:00:00.000Z", 0.9),  // today SGT (10:00), openrouter
    entry("p2", "2026-08-30T03:00:00.000Z", 0.4),  // today, same model
    entry("p3", "2026-08-29T03:00:00.000Z", 5.0),  // yesterday — excluded
  ]);
  assert.equal(store.providerTodayCost("openrouter"), 1.3);
  assert.equal(store.providerTodayCost("zai"), 0);
  assert.deepEqual(store.providerTodayTopModel("openrouter"), { model: "claude-opus-4.6", cost: 1.3 });
  assert.equal(store.providerTodayTopModel("zai"), null);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests, verify RED** — `pnpm test:run` (or `node --import tsx --test test/ledger.test.ts`). Expected: 3 failures (option ignored → provider "unknown"; `costSince`/`providerTodayCost`/`providerTodayTopModel` not functions).

- [ ] **Step 3: Implement** — in `src/ledger/store.ts`:

```ts
// LedgerStoreOpts gains:
export interface LedgerStoreOpts {
  filePath: string;
  now?: () => number;
  utcOffsetMinutes?: number;
  repo?: () => string;
  // Live session attribution (pi exposes provider/model at session level, not per
  // entry). Absent → "unknown" for both (legacy lines never re-attributed).
  attribute?: () => { provider: string; model: string };
  warn?: (message: string) => void;
}

// LedgerStore interface gains:
export interface LedgerStore {
  load(): void;
  reconcile(entries: SessionEntry[]): number;
  getSnapshot(): LedgerSnapshot;
  costSince(ts: number): number;
  providerTodayCost(provider: string): number;
  providerTodayTopModel(provider: string): { model: string; cost: number } | null;
}
```

In `createLedgerStore`, capture `const attribute = opts.attribute ?? (() => ({ provider: "unknown", model: "unknown" }));` and in `toLine` replace the hardcoded unknowns:

```ts
      // P1 recorded "unknown" for both; P3 wires live session attribution (opts.attribute).
      provider: attribute().provider,
      model: attribute().model,
```

Add to the returned object (next to `getSnapshot`):

```ts
    costSince(ts: number): number {
      let sum = 0;
      for (const l of lines) if (l.ts >= ts) sum += l.cost;
      return sum;
    },

    providerTodayCost(provider: string): number {
      const todayIdx = localDayIndex(now(), offset);
      let sum = 0;
      for (const l of lines) {
        if (l.provider !== provider || localDayIndex(l.ts, offset) !== todayIdx) continue;
        sum += l.cost;
      }
      return sum;
    },

    providerTodayTopModel(provider: string): { model: string; cost: number } | null {
      const todayIdx = localDayIndex(now(), offset);
      const byModel = new Map<string, number>();
      for (const l of lines) {
        if (l.provider !== provider || localDayIndex(l.ts, offset) !== todayIdx) continue;
        byModel.set(l.model, (byModel.get(l.model) ?? 0) + l.cost);
      }
      let top: { model: string; cost: number } | null = null;
      for (const [model, cost] of byModel) {
        if (!top || cost > top.cost) top = { model, cost };
      }
      return top;
    },
```

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`. Expected: 124/124 (121 + 3).

- [ ] **Step 5: Commit**

```bash
git add src/ledger/store.ts test/ledger.test.ts
git commit -m "feat(ledger): live provider/model attribution + costSince/providerToday scoped queries"
```

---

### Task 2: GitSource module (dirty / ahead-behind / commits-today)

**Files:**
- Create: `src/git/source.ts`
- Test: `test/git-source.test.ts`

**Interfaces:**
- Produces (Tasks 7 and wiring rely on these EXACT shapes):
  - `interface GitSnapshot { dirty: boolean; ahead: number | null; behind: number | null; commitsToday: number | null }`
  - `interface GitSource { refresh(force?: boolean): void; get(): GitSnapshot | null }` — `get()` is sync (last-good or `null` before first success; `null` also = not a git repo), NEVER awaits, never throws.
  - `createGitSource(opts: { cwd?: () => string; now?: () => number; ttlMs?: number; run?: (cwd: string, args: string[]) => Promise<string>; onUpdate?: () => void }): GitSource` — `run` returns stdout (rejects on git failure); default = `execFile("git", args, { cwd })` promisified. `refresh()` no-ops inside the TTL window unless `force`. `onUpdate` fires after a successful refresh (wires to `requestRender`).

Git commands (CC formulas, research file `cc-statusline-features.md`):
- dirty: `git status --porcelain` → non-empty output = dirty.
- ahead/behind: `git rev-list --left-right --count HEAD...@{upstream}` → `"<ahead>\t<behind>"`; failure (no upstream) → both `null`.
- commits-today: `git rev-list --count --since=<local-midnight "YYYY-MM-DD HH:MM:SS +ZZZZ"> HEAD` (equivalent to CC's `git log --since=<today> --oneline | wc -l`, single exec).

- [ ] **Step 1: Write the failing tests** — create `test/git-source.test.ts`:

```ts
// test/git-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGitSource } from "../src/git/source.ts";

const NOW = Date.UTC(2026, 8, 2, 2, 0); // 2026-09-02 09:00 SGT (UTC+8)
const SGT_OFFSET_MIN = 480;

function fakeRun(responses: Record<string, string | Error>) {
  return (cwd: string, args: string[]): Promise<string> => {
    const key = args.join(" ");
    const r = responses[key];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r ?? "");
  };
}

test("clean repo: dirty=false, ahead/behind parsed from rev-list, commitsToday counted", async () => {
  const run = fakeRun({
    "status --porcelain": "",
    "rev-list --left-right --count HEAD...@{upstream}": "2\t3",
    "rev-list --count --since 2026-09-02 00:00:00 +0800 HEAD": "4",
  });
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0)); // let the async refresh settle
  assert.deepEqual(src.get(), { dirty: false, ahead: 2, behind: 3, commitsToday: 4 });
});

test("dirty worktree + no upstream: dirty=true, ahead/behind null (fragment omitted later)", async () => {
  const run = fakeRun({
    "status --porcelain": " M src/index.ts\n?? new.txt\n",
    "rev-list --left-right --count HEAD...@{upstream}": new Error("no upstream configured"),
    "rev-list --count --since 2026-09-02 00:00:00 +0800 HEAD": "0",
  });
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(src.get(), { dirty: true, ahead: null, behind: null, commitsToday: 0 });
});

test("not a git repo: get() returns null; nothing throws", async () => {
  const run = (_cwd: string, _args: string[]): Promise<string> =>
    Promise.reject(new Error("fatal: not a git repository"));
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(src.get(), null);
});

test("TTL: refresh() inside the window is a no-op; force bypasses; onUpdate fires per successful refresh", async () => {
  let clock = NOW;
  const run = fakeRun({ "status --porcelain": "" });
  let updates = 0;
  const src = createGitSource({ now: () => clock, ttlMs: 30_000, run, onUpdate: () => { updates++; } });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 1);
  src.refresh(); // inside TTL → no exec, no update
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 1);
  clock = NOW + 31_000;
  src.refresh(); // TTL expired → refreshes
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 2);
});
```

- [ ] **Step 2: Run tests, verify RED** — `node --import tsx --test test/git-source.test.ts`. Expected: module-not-found failure.

- [ ] **Step 3: Implement** — create `src/git/source.ts`:

```ts
// src/git/source.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface GitSnapshot {
  dirty: boolean;
  ahead: number | null; // commits HEAD has that upstream lacks; null = no upstream
  behind: number | null;
  commitsToday: number | null; // CC formula: git log --since=<today> --oneline | wc -l
}

export interface GitSource {
  refresh(force?: boolean): void; // async fire-and-forget; never throws
  get(): GitSnapshot | null;      // sync last-good; null = no data yet / not a repo
}

export interface GitSourceOpts {
  cwd?: () => string;
  now?: () => number;
  ttlMs?: number; // default 30_000 (spec §4.1: 30s TTL)
  run?: (cwd: string, args: string[]) => Promise<string>; // test seam
  onUpdate?: () => void;
}

function formatLocalMidnight(now: number): string {
  const d = new Date(now);
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offsetMin = -mid.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${mid.getFullYear()}-${pad(mid.getMonth() + 1)}-${pad(mid.getDate())} 00:00:00 ${sign}${p(Math.floor(abs / 60))}${p(abs % 60)}`;
}

export function createGitSource(opts: GitSourceOpts = {}): GitSource {
  const cwd = opts.cwd ?? (() => process.cwd());
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? 30_000;
  const run = opts.run ?? ((dir: string, args: string[]) => exec("git", args, { cwd: dir }).then((r) => r.stdout));

  let snapshot: GitSnapshot | null = null;
  let lastRefreshAt = -Infinity;
  let inFlight = false;

  async function measure(): Promise<GitSnapshot | null> {
    const dir = cwd();
    try {
      // Repo probe first: any command failing with "not a git repository" marks the
      // whole source null until the next TTL window.
      const status = await run(dir, ["status", "--porcelain"]);
      let ahead: number | null = null;
      let behind: number | null = null;
      try {
        const out = await run(dir, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
        const [a, b] = out.trim().split(/\s+/);
        ahead = Number.parseInt(a ?? "", 10);
        behind = Number.parseInt(b ?? "", 10);
        if (!Number.isFinite(ahead)) ahead = null;
        if (!Number.isFinite(behind)) behind = null;
      } catch {
        // no upstream → fragment omitted later; keep counting commits
      }
      let commitsToday: number | null = null;
      try {
        const out = await run(dir, ["rev-list", "--count", "--since", formatLocalMidnight(now()), "HEAD"]);
        const n = Number.parseInt(out.trim(), 10);
        commitsToday = Number.isFinite(n) ? n : null;
      } catch {
        // detached HEAD etc. — omit the fragment, keep the rest
      }
      return { dirty: status.trim().length > 0, ahead, behind, commitsToday };
    } catch {
      return null; // not a repo / git missing — row fragments omitted
    }
  }

  return {
    refresh(force = false) {
      if (inFlight) return;
      if (!force && now() - lastRefreshAt < ttlMs) return;
      inFlight = true;
      void measure()
        .then((s) => {
          snapshot = s;
          lastRefreshAt = now();
          opts.onUpdate?.();
        })
        .catch(() => { /* measure already returns null on failure; belt for onUpdate throws */ })
        .finally(() => { inFlight = false; });
    },
    get: () => snapshot,
  };
}
```

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`. Expected: 128/128.

- [ ] **Step 5: Commit**

```bash
git add src/git/source.ts test/git-source.test.ts
git commit -m "feat(git): GitSource — dirty, ahead/behind, commits-today (30s TTL, off render path)"
```

---

### Task 3: Est block projection (pure function)

**Files:**
- Create: `src/quota/project.ts`
- Test: `test/quota-project.test.ts`

**Interfaces:**
- Consumes: `QuotaResult` / `QuotaLimit` from `src/quota/zai.ts`.
- Produces (Task 4 consumes): `projectBlock(data: QuotaResult, now: number): { units: number; percent: number } | null`

CC formula (research file): `projected = current + rate_per_hour × remaining_minutes / 60`, anchored to the 5h block. pi adaptation: quota credits. Rules:
- Uses `data.fiveHour` ONLY (the weekly window has no CC "block" analog; render matches the 5h token).
- `null` when: no fiveHour window, non-finite fields, `usage <= 0`, `remaining <= 0` (window already reset — data is stale), or elapsed < 60 s (rate too unstable to project — first minute of a block).
- `elapsed = now − (nextResetTime − 18_000_000)`; `ratePerHour = currentValue / (elapsed / 3_600_000)`; `projected = currentValue + ratePerHour × (remaining / 3_600_000)`; `percent = round(projected / usage × 100)` (may exceed 100 — honest over-projection).

- [ ] **Step 1: Write the failing tests** — create `test/quota-project.test.ts`:

```ts
// test/quota-project.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { projectBlock } from "../src/quota/project.ts";
import type { QuotaResult } from "../src/quota/zai.ts";

const RESET = Date.UTC(2026, 8, 2, 12, 0); // block resets 12:00Z
const START = RESET - 18_000_000;          // 5h window start 07:00Z

function data(currentValue: number, usage: number, extra: Partial<QuotaResult> = {}): QuotaResult {
  return {
    tier: "lite",
    fiveHour: {
      unit: 3, number: 5, usage, currentValue,
      remaining: usage - currentValue,
      percentage: Math.round((currentValue / usage) * 100),
      nextResetTime: RESET,
    },
    weekly: null,
    fetchedAt: START,
    ...extra,
  };
}

test("projects current + rate × remaining (CC block formula)", () => {
  // 1h elapsed, 4h remaining, 500 consumed → rate 500/h → projected 500 + 2000 = 2500 (12.5% of 2000... usage 2000 → 125%)
  const p = projectBlock(data(500, 2000), START + 3_600_000);
  assert.deepEqual(p, { units: 2500, percent: 125 });
});

test("weekly-only data → null (no block to project)", () => {
  const d = data(0, 2000, { fiveHour: null });
  assert.equal(projectBlock(d, START + 3_600_000), null);
});

test("within the first minute of a block → null (rate unstable)", () => {
  assert.equal(projectBlock(data(500, 2000), START + 59_999), null);
});

test("elapsed ≥ 60s projects; remaining ≤ 0 (stale data) → null", () => {
  assert.ok(projectBlock(data(500, 2000), START + 60_000));
  assert.equal(projectBlock(data(500, 2000), RESET + 1), null);
});

test("usage ≤ 0 or non-finite fields → null (defensive)", () => {
  assert.equal(projectBlock(data(0, 0), START + 3_600_000), null);
  const bad = data(500, 2000);
  bad.fiveHour!.nextResetTime = Number.NaN;
  assert.equal(projectBlock(bad, START + 3_600_000), null);
});
```

- [ ] **Step 2: Run tests, verify RED** — `node --import tsx --test test/quota-project.test.ts`. Expected: module-not-found.

- [ ] **Step 3: Implement** — create `src/quota/project.ts`:

```ts
// src/quota/project.ts
import type { QuotaResult } from "./zai.ts";

const FIVE_HOUR_MS = 5 * 3_600_000;

export interface BlockProjection {
  units: number;  // projected quota credits consumed at window reset
  percent: number; // projected % of the window ceiling (may exceed 100 — honest)
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
```

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`. Expected: 133/133.

- [ ] **Step 5: Commit**

```bash
git add src/quota/project.ts test/quota-project.test.ts
git commit -m "feat(quota): Est block projection (CC formula over z.ai 5h credits)"
```

---

### Task 4: Quota row est fragment

**Files:**
- Modify: `src/rows/quota.ts`
- Test: `test/rows.test.ts` (quota row cases live here — check the file; if the quota-row tests are in `test/adapters-zai.test.ts`/`test/rows.test.ts`, extend `test/rows.test.ts` with a fake adapter)

**Interfaces:**
- Consumes: `projectBlock` (Task 3), `formatTokenCount` from `src/format.ts`, existing `createQuotaRow(adapters)`.
- Produces: quota row render contract change —
  - detail 2 + active provider + projection available: `[adapterString(heat color), " | est 3.2k (94%)"(text)]`
  - detail ≤ 1 OR dim (inactive provider) OR no projection: `[adapterString]` (unchanged)
  - `3.2k` formatting via `formatTokenCount` (existing).

- [ ] **Step 1: Write the failing tests** — add to `test/rows.test.ts` (reuse the file's `snap()` helper; build a minimal fake adapter):

```ts
import { createQuotaRow } from "../src/rows/quota.ts";
import type { ProviderRowAdapter } from "../src/adapters/types.ts";
import type { QuotaResult } from "../src/quota/zai.ts";

const QUOTA_DATA: QuotaResult = {
  tier: "lite",
  fiveHour: {
    unit: 3, number: 5, usage: 2000, currentValue: 1500, remaining: 500,
    percentage: 75,
    nextResetTime: Date.UTC(2026, 7, 30, 12, 0),
  },
  weekly: null,
  fetchedAt: Date.UTC(2026, 7, 30, 10, 0),
};

// NOW chosen so elapsed = 1h (fetchedAt 09:00Z... start = 07:00Z), remaining = 2h:
// rate = 1500/h → projected = 1500 + 3000 = 4500 → "4.5k" (225%).
const NOW = Date.UTC(2026, 7, 30, 8, 0);

function fakeAdapter(renderText = "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h"): ProviderRowAdapter<QuotaResult> {
  return {
    id: "zai",
    matches: (p) => p === "zai",
    current: () => QUOTA_DATA,
    fetch: async () => QUOTA_DATA,
    render: () => renderText,
    start: () => {},
    stop: () => {},
  };
}

test("quota row detail 2: est fragment appended (projected units + %)", () => {
  const row = createQuotaRow([fakeAdapter()]);
  const frags = row.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 2)!;
  assert.deepEqual(frags, [
    { text: "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h", color: "accent" },
    { text: " | est 4.5k (225%)", color: "text" },
  ]);
});

test("quota row detail 1: est dropped, adapter string only (shrink-before-drop contract)", () => {
  const row = createQuotaRow([fakeAdapter()]);
  const frags = row.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 1)!;
  assert.deepEqual(frags, [{ text: "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h", color: "accent" }]);
});

test("quota row est omitted for dim (inactive) provider and when projection is null", () => {
  const row = createQuotaRow([fakeAdapter()]);
  // inactive provider → dim → no est
  const dimFrags = row.render(snap({ now: NOW, session: session({ provider: "anthropic" }) }), 2)!;
  assert.equal(dimFrags.length, 1);
  // projection null (weekly-only data) → no est
  const noFiveHour = createQuotaRow([{
    ...fakeAdapter(),
    current: () => ({ ...QUOTA_DATA, fiveHour: null }),
  }]);
  const frags = noFiveHour.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 2)!;
  assert.equal(frags.length, 1);
});
```

Note: the quota row's heat color for `percentage: 75` is `"warning"` (≥70 band). Adjust the expected color assertion to `"warning"` if the existing heat band test pins it — read `heatColor` in `src/rows/quota.ts` (accent <70, warning ≥70, error ≥90) and use `"warning"` in the first test's expectation.

- [ ] **Step 2: Run tests, verify RED** — `node --import tsx --test test/rows.test.ts`. Expected: est fragment missing (frags length 1).

- [ ] **Step 3: Implement** — in `src/rows/quota.ts`, replace the `render` body's return path:

```ts
import { resolveQuotaAdapter, type ProviderRowAdapter } from "../adapters/types.ts";
import { projectBlock } from "../quota/project.ts";
import { formatTokenCount } from "../format.ts";
import type { ColorToken, Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// ... heatColor unchanged ...

export function createQuotaRow(adapters: ProviderRowAdapter<any>[]): Row {
  return {
    id: "quota",
    priority: 2,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const winner = resolveQuotaAdapter(adapters, snapshot.session.provider);
      const data = winner?.current();
      if (!winner || data === null || data === undefined) return null;
      const dim = !winner.matches(snapshot.session.provider);
      const color: ColorToken = dim ? "dim" : heatColor(winner, data);
      const frags: Fragment[] = [{ text: winner.render(data, dim), color }];
      // Est rides the ACTIVE provider's row only (a dim subscription projection is
      // noise), and is the quota row's first shrink casualty (detail >= 2).
      if (detail >= 2 && !dim) {
        const proj = projectBlock(data as Parameters<typeof projectBlock>[0], snapshot.now);
        if (proj) {
          frags.push({ text: ` | est ${formatTokenCount(proj.units)} (${proj.percent}%)`, color: "text" });
        }
      }
      return frags;
    },
  };
}
```

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`. Expected: all green (existing registry/drop-matrix tests must stay green — the quota row grew a fragment, which the drop matrix tolerates via Phase S/T).

- [ ] **Step 5: Commit**

```bash
git add src/rows/quota.ts test/rows.test.ts
git commit -m "feat(quota-row): est block projection fragment at detail 2 (active provider only)"
```

---

### Task 5: Burn anchor option (block-anchored $/hr)

**Files:**
- Modify: `src/config.ts` (schema + defaults), `src/rows/money.ts`, `src/rows/registry.ts` (RowSnapshot), `src/index.ts` (wiring)
- Test: `test/config.test.ts`, `test/rows.test.ts`, `test/index-wiring.test.ts`

**Interfaces:**
- Consumes: `LedgerStore.costSince` (Task 1), `resolveQuotaAdapter` from `src/adapters/types.ts`.
- Produces:
  - `StatuslineConfig.display.burnAnchor: "session" | "block"` — default `"session"`; invalid values THROW (tier precedent: enum via command surface).
  - `RowSnapshot.quotaWindow: { startMs: number; endMs: number; cost: number } | null` — the ACTIVE 5h window (from the resolved adapter's `fiveHour.nextResetTime`) + block cost. `null` when no window data.
  - Money row: `burnAnchor === "block"` + a valid `quotaWindow` (elapsed ≥ 60 s, `now ≤ endMs`) → `$X/hr` = `quotaWindow.cost / elapsedHours`; otherwise the existing session-span logic (and `—` guard) unchanged.

- [ ] **Step 1: Write the failing tests**

`test/config.test.ts` — add:

```ts
test("display.burnAnchor parses session|block, defaults session, throws on invalid", () => {
  // write config file helpers per this file's existing pattern (writeFileSync + loadConfig)
  // — mirror the zai.tier invalid-value test for the throw case.
});
```

Write it in the file's established style (tmp config file + `loadConfig`), asserting: default `cfg.display.burnAnchor === "session"`; `"block"` accepted; `"hourly"` throws `burnAnchor must be "session" or "block"`.

`test/rows.test.ts` — add (the `snap()` helper gains the new snapshot fields FIRST — see Step 3 ordering note):

```ts
test("money row block anchor: $/hr from quotaWindow cost over block elapsed", () => {
  const s = snap({
    now: Date.UTC(2026, 7, 30, 9, 0),
    quotaWindow: { startMs: Date.UTC(2026, 7, 30, 7, 0), endMs: Date.UTC(2026, 7, 30, 12, 0), cost: 3.0 },
    config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, burnAnchor: "block" } },
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 99, count: 5 }, spanMs: 60_000 }),
  });
  const frags = createMoneyRow().render(s, 1)!;
  assert.ok(frags.some((f) => f.text === " | $1.50/hr")); // 3.0 over 2h
});

test("money row block anchor falls back to session when window missing/young", () => {
  // quotaWindow null → session formula (99 cost over 1h span)
  const s1 = snap({
    config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, burnAnchor: "block" } },
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 99, count: 5 }, spanMs: 3_600_000 }),
  });
  assert.ok(createMoneyRow().render(s1, 1)!.some((f) => f.text === " | $99.00/hr"));
  // elapsed < 60s → session fallback too
  const s2 = snap({
    quotaWindow: { startMs: Date.UTC(2026, 7, 30, 8, 59, 30), endMs: Date.UTC(2026, 7, 30, 12, 0), cost: 3.0 },
    config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, burnAnchor: "block" } },
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 99, count: 5 }, spanMs: 3_600_000 }),
    now: Date.UTC(2026, 7, 30, 9, 0),
  });
  assert.ok(createMoneyRow().render(s2, 1)!.some((f) => f.text === " | $99.00/hr"));
});
```

`test/index-wiring.test.ts` — extend: with a fake zai adapter holding `fiveHour.nextResetTime`, `render()` produces a snapshot whose money row uses block burn when `burnAnchor: "block"` is in the tmp config file. Follow the harness's existing "write config then activate" pattern; assert the rendered money line contains the block-derived `$X/hr`.

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/config.ts` — `display` gains:

```ts
    burnAnchor: "session" | "block"; // $/hr anchor: session span (default) or zai 5h block
```

default `"session"`; parsing (inside the `parsed.display` block, tier-throw precedent):

```ts
    if (typeof d.burnAnchor === "string") {
      if (d.burnAnchor !== "session" && d.burnAnchor !== "block") {
        throw new Error('burnAnchor must be "session" or "block"');
      }
      cfg.display.burnAnchor = d.burnAnchor;
    }
```

`src/rows/registry.ts` — `RowSnapshot` gains:

```ts
  git: GitSnapshot | null; // Task 7 — declare NOW with the type import so Task 5/7 share one snapshot migration
  quotaWindow: { startMs: number; endMs: number; cost: number } | null;
```

(Task 7 fills `git`; declare the field here with `null` placeholder wiring in this task to keep snapshot-shape migration atomic — all `snap()` helpers updated once.)

`src/rows/money.ts` — replace the burn block:

```ts
      // Burn rate: block-anchored (CC-style) when configured + window data exists;
      // otherwise session cost over active-session wall time (needs ≥2 usage entries).
      if (detail >= 1) {
        const anchor = snapshot.config.display.burnAnchor ?? "session";
        const win = snapshot.quotaWindow;
        const elapsedMs = win ? snapshot.now - win.startMs : 0;
        if (anchor === "block" && win && elapsedMs >= 60_000 && snapshot.now <= win.endMs) {
          const perHour = win.cost / (elapsedMs / 3_600_000);
          frags.push({ text: ` | $${formatMoney(perHour)}/hr`, color: "muted" });
        } else if (usage.count >= 2 && snapshot.session.spanMs > 0) {
          const perHour = usage.cost / (snapshot.session.spanMs / 3_600_000);
          frags.push({ text: ` | $${formatMoney(perHour)}/hr`, color: "muted" });
        } else {
          frags.push({ text: " | —", color: "muted" });
        }
      }
```

`src/index.ts` — in the footer `render(width)`, after `const ledger = ensureLedger();`:

```ts
          // Active 5h window (block burn anchor + est context): resolve like the quota
          // row does, read fiveHour.nextResetTime defensively (adapters are any-typed).
          let quotaWindow: RowSnapshot["quotaWindow"] = null;
          const winner = resolveQuotaAdapter(adapters, sessionStore.getSnapshot().provider);
          const winData = winner?.current() as { fiveHour?: { nextResetTime?: number } } | null | undefined;
          const reset = winData?.fiveHour?.nextResetTime;
          if (typeof reset === "number" && Number.isFinite(reset) && reset > Date.now()) {
            const startMs = reset - 5 * 3_600_000;
            quotaWindow = { startMs, endMs: reset, cost: ledger.costSince(startMs) };
          }
```

and add `quotaWindow, git: null,` to the `RowSnapshot` literal. Import `resolveQuotaAdapter` from `./adapters/types.ts`.

Update ALL existing `snap()` helpers in `test/rows.test.ts` (and any other RowSnapshot fixtures) to include `git: null, quotaWindow: null`.

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/rows/money.ts src/rows/registry.ts src/index.ts test/config.test.ts test/rows.test.ts test/index-wiring.test.ts
git commit -m "feat(money): burnAnchor option — block-anchored $/hr from the zai 5h window"
```

---

### Task 6: Version stamps (SL + PI)

**Files:**
- Create: `src/versions.ts`
- Modify: `src/config.ts`, `src/rows/ambient.ts`, `src/rows/registry.ts` (RowSnapshot.versions — declared in Task 5's snapshot migration; add here if not present), `src/index.ts`
- Test: `test/versions.test.ts`, `test/rows.test.ts`, `test/config.test.ts`

**Interfaces:**
- Produces:
  - `selfVersion(): string` — our `package.json` version, read once (module-level cache) via `readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"))`; read failure → `"?"`.
  - `piVersion(): string | null` — `createRequire(import.meta.url).resolve("@earendil-works/pi-coding-agent/package.json")` + read `version`; ANY failure (resolve/parse) → `null`.
  - `StatuslineConfig.display.showVersions: boolean` — default `false` (ambient fragment gate).
  - `RowSnapshot.versions: { sl: string; pi: string | null }` — non-null; defaults `{ sl: "", pi: null }` in fallback paths.
  - Ambient row: `showVersions && detail >= 2` → ` | SL:<sl>` (dim), then ` · PI:<pi>` (dim) when `pi !== null`. Empty `sl` → both omitted.

- [ ] **Step 1: Write the failing tests**

`test/versions.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { selfVersion, piVersion } from "../src/versions.ts";

test("selfVersion reads our package.json version (semver-ish)", () => {
  assert.match(selfVersion(), /^\d+\.\d+\.\d+/);
});

test("piVersion resolves the linked pi package or null — never throws", () => {
  const v = piVersion();
  if (v !== null) assert.match(v, /^\d+\.\d+\.\d+/);
});
```

`test/rows.test.ts` — ambient versions case (helper `snap()` gains `versions: { sl: "0.4.0", pi: "0.84.4" }` default):

```ts
test("ambient versions fragment: gated by showVersions + detail 2; PI omitted when null", () => {
  const row = createAmbientRow();
  const cfg = { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, showVersions: true } };
  const on = row.render(snap({ config: cfg }), 2)!;
  assert.deepEqual(on.slice(-2), [
    { text: " | SL:0.4.0", color: "dim" },
    { text: " · PI:0.84.4", color: "dim" },
  ]);
  const noPi = row.render(snap({ config: cfg, versions: { sl: "0.4.0", pi: null } }), 2)!;
  assert.deepEqual(noPi.slice(-1), [{ text: " | SL:0.4.0", color: "dim" }]);
  // off by default
  const off = row.render(snap({}), 2)!;
  assert.ok(!off.some((f) => f.text.includes("SL:")));
  // detail 1 → omitted (periphery, same gate as statuses)
  const d1 = row.render(snap({ config: cfg }), 1)!;
  assert.ok(!d1.some((f) => f.text.includes("SL:")));
});
```

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/versions.ts`:

```ts
// src/versions.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let cachedSelf: string | null = null;

// Our own version: package.json ships alongside src/ (checkout AND npm layout).
export function selfVersion(): string {
  if (cachedSelf !== null) return cachedSelf;
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    cachedSelf = typeof parsed.version === "string" ? parsed.version : "?";
  } catch {
    cachedSelf = "?";
  }
  return cachedSelf;
}

// Host version: no pi extension accessor exists (verified 2026-09-02, pi 0.84.4) —
// spec §15 fallback: read the resolvable pi package.json (the copy we link against).
// Any failure → null → PI fragment omitted (self-only stamp).
export function piVersion(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@earendil-works/pi-coding-agent/package.json");
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}
```

`src/config.ts`: `display.showVersions: boolean` default `false`, lenient parse (`typeof d.showVersions === "boolean"` — same as showTokens).

`src/rows/registry.ts`: `RowSnapshot` gains `versions: { sl: string; pi: string | null };` (update fallback/default snapshots accordingly).

`src/rows/ambient.ts` — after the statuses fragment (inside `detail >= 2`):

```ts
        // Version stamps (spec §15): SL = our package, PI = linked pi host package.
        // Periphery → dim, detail-2 only, off unless display.showVersions.
        if (snapshot.config.display.showVersions && snapshot.versions.sl) {
          frags.push({ text: ` | SL:${snapshot.versions.sl}`, color: "dim" });
          if (snapshot.versions.pi) frags.push({ text: ` · PI:${snapshot.versions.pi}`, color: "dim" });
        }
```

`src/index.ts`: `StatuslineRuntimeDependencies` gains `readVersions: () => { sl: string; pi: string | null }` (default `() => ({ sl: selfVersion(), pi: piVersion() })`; import both). In the render snapshot literal add `versions: dependencies.readVersions(),`.

Update all RowSnapshot fixtures (`snap()` in `test/rows.test.ts`, any others) with the `versions` field.

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/versions.ts src/config.ts src/rows/ambient.ts src/rows/registry.ts src/index.ts test/versions.test.ts test/rows.test.ts test/config.test.ts
git commit -m "feat(ambient): SL/PI version stamps (showVersions, default off; PI via package fallback)"
```

---

### Task 7: Git wiring — identity marks + ambient commits

**Files:**
- Modify: `src/rows/identity.ts`, `src/rows/ambient.ts`, `src/index.ts`
- Test: `test/rows.test.ts`, `test/index-wiring.test.ts`

**Interfaces:**
- Consumes: `GitSource` / `GitSnapshot` (Task 2); `RowSnapshot.git` (declared Task 5).
- Produces (render contracts):
  - Identity (only when the branch fragment renders, detail ≥ 1, `git !== null`): `{ "*"(toolTitle) }` when `dirty`; `{ " ↑n ↓n"(toolTitle) }` — only the non-zero halves, single fragment, omitted when both null/zero.
  - Ambient (detail ≥ 1, `commitsToday !== null`): `{ " | commits N"(dim) }` placed after the coding fragment.
- Wiring: `StatuslineRuntimeDependencies.makeGitSource?: () => GitSource` (default `() => createGitSource({ onUpdate: () => requestRenderFn?.() })`). Refresh triggers: session_start (`refresh(true)`), ticker tick (`refresh()` — TTL-guarded), branch change (`refresh(true)` inside the existing `footerData.onBranchChange` callback). `render()` adds `git: gitSource.get()`. No new timers → nothing extra to dispose.

- [ ] **Step 1: Write the failing tests**

`test/rows.test.ts`:

```ts
test("identity row: dirty * and ahead/behind ride the branch fragment (detail >= 1 only)", () => {
  const row = createIdentityRow();
  const g = { dirty: true, ahead: 2, behind: 1, commitsToday: 4 };
  const frags = row.render(snap({ session: session({ branch: "main" }), git: g }), 2)!;
  assert.deepEqual(frags[2], { text: " ⎇ main", color: "toolTitle" });
  assert.deepEqual(frags[3], { text: "*", color: "toolTitle" });
  assert.deepEqual(frags[4], { text: " ↑2 ↓1", color: "toolTitle" });
  // clean + no upstream → no extra fragments
  const clean = row.render(snap({ session: session({ branch: "main" }), git: { dirty: false, ahead: null, behind: null, commitsToday: 0 } }), 2)!;
  assert.deepEqual(clean[2], { text: " | glm-5.2", color: "accent" });
  // detail 1 with branch → marks still render; detail 0 (no branch) → none
  assert.ok(row.render(snap({ session: session({ branch: "main" }), git: g }), 1)!.some((f) => f.text === "*"));
});

test("ambient row: commits-today fragment at detail >= 1, dim", () => {
  const row = createAmbientRow();
  const frags = row.render(snap({ git: { dirty: false, ahead: null, behind: null, commitsToday: 4 } }), 1)!;
  assert.ok(frags.some((f) => f.text === " | commits 4" && f.color === "dim"));
  const none = row.render(snap({ git: { dirty: false, ahead: null, behind: null, commitsToday: null } }), 1)!;
  assert.ok(!none.some((f) => f.text.includes("commits")));
});
```

`test/index-wiring.test.ts` — harness gains `makeGitSource` returning a controllable fake; test: after `src.refresh`-simulated data, `render()` output contains `⎇ main*` (dirty) — proves the wiring passes `gitSource.get()` into the snapshot.

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/rows/identity.ts` — after the branch fragment push:

```ts
      if (s.branch && detail >= 1) {
        frags.push({ text: `${frags.length > 0 ? " " : ""}⎇ ${s.branch}`, color: "toolTitle" });
        const g = snapshot.git;
        if (g) {
          if (g.dirty) frags.push({ text: "*", color: "toolTitle" });
          const marks = [
            g.ahead !== null && g.ahead > 0 ? `↑${g.ahead}` : null,
            g.behind !== null && g.behind > 0 ? `↓${g.behind}` : null,
          ].filter((m): m is string => m !== null);
          if (marks.length > 0) frags.push({ text: ` ${marks.join(" ")}`, color: "toolTitle" });
        }
      }
```

(replace the existing single-line branch push with the block above).

`src/rows/ambient.ts` — after the coding fragment push (inside `detail >= 1`):

```ts
        const g = snapshot.git;
        if (g && g.commitsToday !== null) {
          frags.push({ text: ` | commits ${g.commitsToday}`, color: "dim" });
        }
```

`src/index.ts` — add the `makeGitSource` dependency + lifecycle:

```ts
import { createGitSource, type GitSource } from "./git/source.ts";
// in StatuslineRuntimeDependencies:
  makeGitSource: () => GitSource;
// DEFAULT_DEPENDENCIES:
  makeGitSource: () => createGitSource({ onUpdate: () => requestRenderFn?.() }),
```

In `activateStatusline`: `const gitSource = dependencies.makeGitSource();` — refresh in `session_start` (`gitSource.refresh(true)`, next to `refreshDeen()`), in the ticker `onTick` (`gitSource.refresh()` — internal TTL guard), and in `installFooter`'s `onBranchChange` callback: `footerData.onBranchChange(() => { gitSource.refresh(true); tui.requestRender(); })` (replace the existing arrow body). Render snapshot: `git: gitSource.get(),`.

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/rows/identity.ts src/rows/ambient.ts src/index.ts test/rows.test.ts test/index-wiring.test.ts
git commit -m "feat(git): wire GitSource — branch dirty/ahead/behind marks + ambient commits-today"
```

---

### Task 8: OpenRouter credits adapter

**Files:**
- Modify: `src/quota/zai.ts` (genericize poller), `src/config.ts` (`providers.openrouter.enabled`)
- Create: `src/adapters/openrouter.ts`
- Modify: `src/index.ts` (wiring via `makeAdapters`)
- Test: `test/quota-zai.test.ts` (poller genericization stays green), `test/adapters-openrouter.test.ts`, `test/config.test.ts`

**Interfaces:**
- Consumes: `ProviderRowAdapter` (existing), `LedgerStore.providerTodayCost` / `providerTodayTopModel` (Task 1), `readZaiKey`'s auth.json pattern.
- Produces:
  - `createQuotaPoller<T>(opts: { apiKey: string; intervalMs: number; onRefresh?: () => void; fetchFn: (apiKey: string) => Promise<T | null> }): QuotaPoller<T>` — `fetchFn` becomes REQUIRED + generic; `adapters/zai.ts` passes `deps.fetchFn ?? fetchQuota` explicitly. Unref semantics unchanged.
  - `readOrKey(authJsonPath: string): string | null` — `auth.json` → `openrouter.key` (never logged).
  - `parseCreditsResponse(body: string): { totalCredits: number; totalUsage: number } | null` — `data.total_credits` / `data.total_usage`, finite numbers, else `null`.
  - `fetchCredits(apiKey: string): Promise<CreditsData | null>` — `GET https://openrouter.ai/api/v1/credits`, Bearer, `AbortSignal.timeout(10_000)`, non-OK/throw → `null`.
  - `interface CreditsData { totalCredits: number; totalUsage: number; fetchedAt: number }`
  - `createOpenRouterAdapter(deps: { authJsonPath: string; readKey: typeof readOrKey; pollIntervalMs: () => number; fetchFn?: typeof fetchCredits; ledger: () => LedgerStore | null; onRefresh?: () => void }): ProviderRowAdapter<CreditsData>`
    - `matches: (p) => p === "openrouter"`; `start()` no-op when key absent or `config.providers.openrouter.enabled === false` (enabled check lives in wiring — see Step 3); 10-min poll default via `pollIntervalMs()` (config `providers.openrouter.pollIntervalMs`, default `600_000`).
    - `heat: (d) => usage/total × 100` (or `null` when `totalCredits <= 0`).
    - `render(d, _dim)`: `or $<left> left` + ` · $<today> today` (when today > 0, from `deps.ledger()?.providerTodayCost("openrouter")`) + ` · top: <model> $<cost>` (when top exists). `left = max(0, totalCredits − totalUsage)`, 2-dec money.

- [ ] **Step 1: Write the failing tests** — create `test/adapters-openrouter.test.ts`:

```ts
// test/adapters-openrouter.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOpenRouterAdapter, parseCreditsResponse, readOrKey } from "../src/adapters/openrouter.ts";
import type { LedgerStore } from "../src/ledger/store.ts";

const CREDITS_BODY = JSON.stringify({ data: { total_credits: 20, total_usage: 12.34 } });

test("parseCreditsResponse: strict shape, finite guards", () => {
  assert.deepEqual(parseCreditsResponse(CREDITS_BODY), { totalCredits: 20, totalUsage: 12.34 });
  assert.equal(parseCreditsResponse("{}"), null);
  assert.equal(parseCreditsResponse(JSON.stringify({ data: { total_credits: "x", total_usage: 1 } })), null);
  assert.equal(parseCreditsResponse("not-json"), null);
});

test("readOrKey reads auth.json openrouter.key; missing → null", () => {
  const dir = mkdtempSync(join(tmpdir(), "or-"));
  const p = join(dir, "auth.json");
  writeFileSync(p, JSON.stringify({ openrouter: { key: "sk-or-1" } }));
  assert.equal(readOrKey(p), "sk-or-1");
  writeFileSync(p, JSON.stringify({ zai: { key: "k" } }));
  assert.equal(readOrKey(p), null);
  rmSync(dir, { recursive: true, force: true });
});

function fakeLedger(today: number, top: { model: string; cost: number } | null): LedgerStore {
  return {
    load: () => {}, reconcile: () => 0,
    getSnapshot: () => ({ todayCost: 0, last7Cost: 0, last30Cost: 0, daily: [], repoCost: 0 }),
    costSince: () => 0,
    providerTodayCost: () => today,
    providerTodayTopModel: () => top,
  } as LedgerStore;
}

test("render: credits left; today + top appended from ledger when present", () => {
  const adapter = createOpenRouterAdapter({
    authJsonPath: "/dev/null",
    readKey: () => "k",
    pollIntervalMs: () => 600_000,
    fetchFn: async () => ({ totalCredits: 20, totalUsage: 12.34, fetchedAt: 0 }),
    ledger: () => fakeLedger(1.24, { model: "claude-opus-4.6", cost: 0.9 }),
  });
  assert.equal(
    adapter.render({ totalCredits: 20, totalUsage: 12.34, fetchedAt: 0 }, false),
    "or $7.66 left · $1.24 today · top: claude-opus-4.6 $0.90",
  );
  const bare = createOpenRouterAdapter({
    authJsonPath: "/dev/null", readKey: () => "k", pollIntervalMs: () => 600_000,
    fetchFn: async () => ({ totalCredits: 20, totalUsage: 12.34, fetchedAt: 0 }),
    ledger: () => fakeLedger(0, null),
  });
  assert.equal(bare.render({ totalCredits: 20, totalUsage: 12.34, fetchedAt: 0 }, false), "or $7.66 left");
});

test("adapter contract: matches openrouter; fetch failure → current stays null → row omitted; heat = usage %", async () => {
  const adapter = createOpenRouterAdapter({
    authJsonPath: "/dev/null", readKey: () => "k", pollIntervalMs: () => 600_000,
    fetchFn: async () => null,
    ledger: () => null,
  });
  assert.equal(adapter.matches("openrouter"), true);
  assert.equal(adapter.matches("zai"), false);
  assert.equal(await adapter.fetch(), null);
  assert.equal(adapter.current(), null);
  const ok = createOpenRouterAdapter({
    authJsonPath: "/dev/null", readKey: () => "k", pollIntervalMs: () => 600_000,
    fetchFn: async () => ({ totalCredits: 20, totalUsage: 18, fetchedAt: 0 }),
    ledger: () => null,
  });
  assert.equal(ok.heat?.({ totalCredits: 20, totalUsage: 18, fetchedAt: 0 }), 90);
});

test("key absent → start() is a no-op and current() stays null (inert adapter)", async () => {
  const adapter = createOpenRouterAdapter({
    authJsonPath: "/dev/null", readKey: () => null, pollIntervalMs: () => 600_000,
    fetchFn: async () => ({ totalCredits: 1, totalUsage: 0, fetchedAt: 0 }),
    ledger: () => null,
  });
  adapter.start();
  assert.equal(adapter.current(), null);
  assert.equal(await adapter.fetch(), null);
});
```

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/quota/zai.ts` — genericize the poller (mechanics unchanged):

```ts
export interface QuotaPoller<T = unknown> {
  get(): T | null;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
}

export function createQuotaPoller<T>(opts: {
  apiKey: string;
  intervalMs: number;
  onRefresh?: () => void;
  fetchFn: (apiKey: string) => Promise<T | null>; // now REQUIRED + generic
}): QuotaPoller<T> {
  // body identical, minus the `opts.fetchFn ?? fetchQuota` default:
  const doFetch = opts.fetchFn;
  // ...rest unchanged...
}
```

`src/adapters/zai.ts` — `ensurePoller` passes `fetchFn: deps.fetchFn ?? fetchQuota`.

`src/adapters/openrouter.ts`:

```ts
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
```

`src/config.ts` — add top-level:

```ts
  providers: {
    openrouter: {
      enabled: boolean;
      pollIntervalMs: number;
    };
  };
```

defaults `{ providers: { openrouter: { enabled: true, pollIntervalMs: 600_000 } } }`; lenient parses (boolean / positive number) inside `if (parsed.providers && typeof parsed.providers === "object")` mirroring the deen block.

`src/index.ts` — `StatuslineRuntimeDependencies.makeAdapters` deps gain `ledger: () => LedgerStore | null`; the default factory becomes:

```ts
  makeAdapters: ({ authJsonPath, readKey, config, onRefresh, ledger }) => {
    const adapters: ProviderRowAdapter<any>[] = [
      createZaiAdapter({ authJsonPath, readKey, pollIntervalMs: () => config().zai.pollIntervalMs, onRefresh }),
    ];
    if (config().providers.openrouter.enabled) {
      adapters.push(createOpenRouterAdapter({
        authJsonPath, readKey: (p) => readOrKey(p),
        pollIntervalMs: () => config().providers.openrouter.pollIntervalMs,
        ledger, onRefresh,
      }));
    }
    return adapters;
  },
```

(`readKey` dep is zai-shaped; the OR adapter gets its own reader — keep `readOrKey` import.) `buildAdapters` passes `ledger: () => ledgerStore` (after `ensureLedger()` — call `ensureLedger()` first in `buildAdapters`). Update the harness's fake `makeAdapters` signature accordingly.

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run` (zai poller tests must stay green — same mechanics, new generics).

- [ ] **Step 5: Commit**

```bash
git add src/quota/zai.ts src/adapters/zai.ts src/adapters/openrouter.ts src/config.ts src/index.ts test/adapters-openrouter.test.ts test/config.test.ts test/index-wiring.test.ts
git commit -m "feat(adapters): OpenRouter credits row — /credits poller + ledger-derived today/top"
```

---

### Task 9: Named themes

**Files:**
- Create: `src/theme.ts`
- Modify: `src/config.ts` (`display.theme`), `src/index.ts` (fragment remap + one-time unknown-theme notify)
- Test: `test/theme.test.ts`, `test/config.test.ts`, `test/index-wiring.test.ts`

**Interfaces:**
- Produces:
  - `const THEME_PRESETS: Record<string, Partial<Record<ColorToken, ColorToken>>>` — at minimum `"default"` (empty/identity) and `"mono"` (`success → text`, `toolTitle → text`, `accent → text`, `warning`/`error`/`muted`/`dim`/`text` unchanged — mono flattens the multi-hue palette while preserving escalation + hierarchy).
  - `applyThemeColor(token: ColorToken, presetName: string): { color: ColorToken; known: boolean }` — resolves through the preset; unknown preset → resolves with `"default"` mapping + `known: false` (caller notifies once).
  - `StatuslineConfig.display.theme: string` — default `"default"`, stored verbatim (validation at use, like unknown row ids).
  - index.ts render: `theme.fg(applyThemeColor(f.color, config.display.theme).color, f.text)`; unknown presets join the one-time notify drain (`pendingRowWarnings` generalized to any warning string).

- [ ] **Step 1: Write the failing tests** — create `test/theme.test.ts`:

```ts
// test/theme.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_PRESETS, applyThemeColor } from "../src/theme.ts";

test("default preset is identity; mono flattens hue tokens but keeps escalation", () => {
  assert.equal(applyThemeColor("success", "default").color, "success");
  assert.equal(applyThemeColor("toolTitle", "default").color, "toolTitle");
  assert.equal(applyThemeColor("success", "mono").color, "text");
  assert.equal(applyThemeColor("toolTitle", "mono").color, "text");
  assert.equal(applyThemeColor("accent", "mono").color, "text");
  assert.equal(applyThemeColor("warning", "mono").color, "warning"); // escalation preserved
  assert.equal(applyThemeColor("error", "mono").color, "error");
  assert.equal(applyThemeColor("dim", "mono").color, "dim");
});

test("unknown preset falls back to default mapping and flags known:false", () => {
  const r = applyThemeColor("success", "nope");
  assert.equal(r.color, "success");
  assert.equal(r.known, false);
  assert.equal(applyThemeColor("success", "default").known, true);
  assert.ok("mono" in THEME_PRESETS && "default" in THEME_PRESETS);
});
```

Config test: `display.theme` defaults `"default"`, string passthrough (e.g. `"mono"` → `cfg.display.theme === "mono"`).

Wiring test: with `theme: "mono"` in the tmp config, the render pass emits NO `success`/`toolTitle` color names to `theme.fg` (harness records `colors[]`); with an unknown theme, exactly one warning notify fires across two renders.

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/theme.ts`:

```ts
// src/theme.ts
import type { ColorToken } from "./types.ts";

// Named presets (spec §12): palette presets OVER the theme tokens — a preset remaps
// our semantic tokens onto other tokens; pi's live theme still supplies real colors
// (theme-integrated per the v0.2.3 decision — no hardcoded ANSI, ever).
export const THEME_PRESETS: Record<string, Partial<Record<ColorToken, ColorToken>>> = {
  default: {},
  mono: { success: "text", toolTitle: "text", accent: "text" },
};

export function applyThemeColor(token: ColorToken, presetName: string): { color: ColorToken; known: boolean } {
  const preset = THEME_PRESETS[presetName];
  if (!preset) return { color: token, known: false }; // unknown → identity + one-time notify upstream
  return { color: preset[token] ?? token, known: true };
}
```

`src/config.ts`: `display.theme: string` default `"default"`; lenient `typeof d.theme === "string"` parse.

`src/index.ts`:
- drain: rename `pendingRowWarnings: Set<string>` usage to also accept theme warnings — keep the set but push composed messages: in `drainRowWarnings` iterate generic messages; theme check happens per render:

```ts
          // Theme validation at use (mirrors unknown-row handling): one-time notify.
          let themeKnown = true;
          const themeName = config.display.theme;
          // cheap one-time check outside the fragment loop:
          if (!(themeName in THEME_PRESETS) && !notifiedThemeWarning) {
            notifiedThemeWarning = true;
            sessionCtx?.ui.notify(`pi-statusline: unknown display.theme "${themeName}" — using default (valid: ${Object.keys(THEME_PRESETS).join(", ")})`, "warning");
          }
          return lines.map((frags) =>
            frags.map((f) => theme.fg(applyThemeColor(f.color, themeName).color, f.text)).join("")
          );
```

(`let notifiedThemeWarning = false` module-scope within `activateStatusline`; import `applyThemeColor, THEME_PRESETS`.)

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/config.ts src/index.ts test/theme.test.ts test/config.test.ts test/index-wiring.test.ts
git commit -m "feat(theme): named theme presets (default/mono) over theme tokens + unknown-theme notify"
```

---

### Task 10: `rows` command

**Files:**
- Modify: `src/tui/settings.ts`, `src/index.ts`
- Test: `test/tui-settings.test.ts`, `test/index-wiring.test.ts`

**Interfaces:**
- Produces (parser):
  - `{ action: "list-rows" }` — bare `/statusline rows`.
  - `{ action: "set-rows"; ids: RowId[] }` — `/statusline rows identity,ctx,money` (comma-separated, trimmed, deduped preserving first occurrence, order = display order).
  - `{ action: "error"; message }` — unknown id (message lists valid ids), empty list.
- Handler: `set-rows` → `config.display.rows = ids`, `saveConfig`, notify `Row order set: <ids>`, re-render. `list-rows` → notify `Rows: <current>` + valid ids hint. Update the `registerCommand` description string to include `rows <id[,id...]>`.

- [ ] **Step 1: Write the failing tests** — add to `test/tui-settings.test.ts`:

```ts
test("rows: bare lists; comma list validates against KNOWN_ROW_IDS; invalid → error", () => {
  assert.deepEqual(parseStatuslineArgs("rows"), { action: "list-rows" });
  assert.deepEqual(
    parseStatuslineArgs("rows identity, ctx ,money"),
    { action: "set-rows", ids: ["identity", "ctx", "money"] },
  );
  // dedupe preserving first occurrence
  assert.deepEqual(
    parseStatuslineArgs("rows money,money,deen"),
    { action: "set-rows", ids: ["money", "deen"] },
  );
  const bad = parseStatuslineArgs("rows identity,nope");
  assert.equal(bad.action, "error");
  assert.match(bad.message, /identity, ctx, money, quota, deen, ambient/);
  assert.equal(parseStatuslineArgs("rows ,").action, "error"); // empty after trim
});
```

(adjust the valid-ids regex to the actual `KNOWN_ROW_IDS` join format used in the message).

Wiring test: harness invokes the `statusline` command handler with `"rows deen,identity"` → config file on disk updated (`display.rows` order), notify emitted, `renderRequests` incremented.

- [ ] **Step 2: Run tests, verify RED**

- [ ] **Step 3: Implement**

`src/tui/settings.ts` — add to the union + switch:

```ts
import { KNOWN_ROW_IDS, type RowId } from "../types.ts";

// union gains:
  | { action: "list-rows" }
  | { action: "set-rows"; ids: RowId[] }

// switch gains:
    case "rows": {
      const rest = args!.trim().slice("rows".length).trim();
      if (!rest) return { action: "list-rows" };
      const parts2 = rest.split(",").map((s) => s.trim()).filter(Boolean);
      const invalid = parts2.filter((id) => !(KNOWN_ROW_IDS as readonly string[]).includes(id));
      if (parts2.length === 0 || invalid.length > 0) {
        return { action: "error", message: `rows must be a comma-separated subset of: ${KNOWN_ROW_IDS.join(", ")}` };
      }
      const ids = [...new Set(parts2)] as RowId[]; // dedupe, first occurrence wins
      return { action: "set-rows", ids };
    }
```

`src/index.ts` — handler cases:

```ts
        case "list-rows":
          ctx.ui.notify(`Rows: ${config.display.rows.join(", ")} (valid: ${KNOWN_ROW_IDS.join(", ")})`, "info");
          break;
        case "set-rows":
          config = { ...config, display: { ...config.display, rows: action.ids } };
          saveConfig(dependencies.configPath, config);
          ctx.ui.notify(`Row order set: ${action.ids.join(", ")}`, "info");
          requestRenderFn?.();
          break;
```

(import `KNOWN_ROW_IDS` from `./types.ts`; extend the command description.)

- [ ] **Step 4: Run tests, verify GREEN** — `pnpm test:run`.

- [ ] **Step 5: Commit**

```bash
git add src/tui/settings.ts src/index.ts test/tui-settings.test.ts test/index-wiring.test.ts
git commit -m "feat(commands): /statusline rows — list + set display order (validated, persisted)"
```

---

### Task 11: Wiring integration sweep + README + version prep

**Files:**
- Modify: `README.md`, `package.json` (version → `0.4.0`)
- Test: `test/index-wiring.test.ts` (integration additions)

**Interfaces:**
- Consumes: everything above. This task is the pre-release gate — NO new features.

- [ ] **Step 1: Wiring integration additions** — extend `test/index-wiring.test.ts` with one test driving the assembled footer across the P3 surface: tmp config enabling `showVersions`, `burnAnchor: "block"`, `theme: "mono"`; fake zai adapter with fiveHour data; fake git source with dirty=true; assert the multi-line render: quota line contains `est`, money line contains a block-anchored `/hr`, identity line contains `⎇ main*`, no `success`/`toolTitle` color reaches `theme.fg` (mono), `SL:` present in the ambient line. RED first (only if any wiring gap surfaces), fix, GREEN.

- [ ] **Step 2: tmux ANSI verification** (visual contract — REQUIRED for render changes): `pi -e ./src/index.ts` inside a tmux spawn at 120×40 and at 78×20 (narrow), capture `ansi:true`, verify: est fragment present + hue (bright SGR), git marks beside the branch, mono preset flattens money-green to text when configured, default preset unchanged from v0.3.1. SGR bytes are ground truth — mocked `theme.fg` proves nothing (v0.2.x lesson).

- [ ] **Step 3: README** — update: render preview block (add est / git marks / commits / versions lines), **Config** section (`display.burnAnchor`, `display.showVersions`, `display.theme`, `providers.openrouter.*`), **Commands** (`/statusline rows <id[,id...]>`), **Ledger** note (provider/model attribution now recorded; legacy lines stay "unknown"), CC-parity score note (~14/14). No AI attribution, org spelling getpipher.

- [ ] **Step 4: Version prep** — do NOT bump yet on the branch if your flow bumps on main post-merge (P2 precedent: `chore: vX.Y.Z` landed on main). Leave `package.json` at `0.3.1` on the branch; the release step after final review does:

```bash
git checkout main && git merge --no-ff feat/v2-p3-env-adapters
npm version minor --no-git-tag-version   # → 0.4.0
git add package.json && git commit -m "chore: v0.4.0"
git -c tag.gpgSign=false tag -a v0.4.0 -m "v0.4.0 — P3: est projection, git upgrades, OR adapter, themes, rows cmd"
git push origin main v0.4.0   # release.yml publishes; tag-mirror failure = known issue #1, ignore
```

(HELD — execute only after the post-final-review gate.)

- [ ] **Step 5: Full gate** — `pnpm typecheck && pnpm test:run` green; `git log --oneline` shows one commit per feature.

---

## Self-Review (performed while writing)

- **Spec coverage (§15 P3 list):** Est projection → Tasks 3–4 · Burn anchor → Task 5 · Version stamps (SL + PI-with-fallback) → Task 6 · Git upgrades → Tasks 2, 7 · MCP row → verified negative, stays omitted (no task, per spec) · OR credits adapter → Task 8 (D7 today/top via ledger — deviation #1 documented) · Named themes → Task 9 · `rows` cmd → Task 10. §15 P2 leftovers: none (shipped v0.3.x).
- **Placeholder scan:** Task 5 Step 1 config test and Task 10 wiring test reference their files' established harness patterns instead of full inline code (the patterns are file-specific and already exist); everything else carries complete code. No TBDs.
- **Type consistency:** `GitSnapshot`/`GitSource` (Task 2) = consumed by Task 7 wiring verbatim · `projectBlock` (Task 3) = consumed by Task 4 · `costSince`/`providerToday*` (Task 1) = consumed by Tasks 5/8 · `RowSnapshot` field additions (`quotaWindow` Task 5, `git` declared Task 5/filled Task 7, `versions` Task 6) — fixture migration called out in each task · `createQuotaPoller<T>` genericization (Task 8) updates `adapters/zai.ts` in the same task so zai tests stay green.
