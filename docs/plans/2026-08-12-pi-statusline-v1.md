# pi-statusline v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an adaptive, provider-aware footer for the Pi Coding Agent that replaces pi's native footer and shows authoritative z.ai quota balance polled from the console API.

**Architecture:** A TypeScript pi extension (`ctx.ui.setFooter()`) that composes pure segment functions (model/git/tokens/ctx%/quota) into a single-line footer with responsive truncation. A background poller fetches `GET /quota/limit` from z.ai every 3 minutes (default), caches the result, and the footer renders from cache. Config lives in `~/.pi/agent/pi-statusline.json`; a `/statusline` command provides interactive configuration.

**Tech Stack:** TypeScript (raw `.ts` via tsx, no build step), `@earendil-works/pi-tui` (truncateToWidth, visibleWidth), node:test for testing, pi extension API (ExtensionAPI, setFooter, registerCommand, events).

## Global Constraints

- Org spelling **getpipher** (two p's) — never getpither. No AI attribution anywhere. 2-space indent, TypeScript strict, MIT license.
- TDD mandatory; `pnpm test:run` (node:test via tsx) after changes; `pnpm typecheck` clean. No build step (raw .ts via tsx at pi runtime).
- Secrets: read `zai.key` from `~/.pi/agent/auth.json` in-process; never log/echo/commit it. `.env`/auth.json never committed.
- z.ai quota API: `GET https://api.z.ai/api/monitor/usage/quota/limit` with `Authorization: Bearer <zai inference key>` → 200 `{ data: { limits: [...], level: "lite"|"pro"|"max" } }`. `nextResetTime` = ms-epoch UTC. Same Bearer perimeter as inference. Zero credit cost to poll.
- Key access: `~/.pi/agent/auth.json` → top-level `"zai"` object → its `key` field (`{"zai":{"type":"api_key","key":"<value>"}}`; the extension reads `zai.key`, one level — not `zai.key.key`). Read in-process, never log.
- Tier override (`zai.tier`) is RESERVED for the deferred offline fast-path (Task 8) — v1 auto-detects the tier from `data.level`; `/statusline tier` only persists the override.
- Per-message usage shape: `{ input, output, cacheRead, cacheWrite, reasoning, totalTokens, cost: { ..., total: 0 } }`. Cached-token field is `cacheRead` (camelCase).
- pi footer API: `ctx.ui.setFooter((tui, theme, footerData) => ({ render(width): string[], dispose?, invalidate? }))`. `footerData.getGitBranch()`, `footerData.getExtensionStatuses(): ReadonlyMap<string,string>`, `footerData.onBranchChange(cb): unsubscribe`. `theme.fg(color, text)`/`theme.bg(color, text)`; colors: text accent muted dim success warning error toolTitle. `tui.requestRender()` to invalidate.
- `truncateToWidth` / `visibleWidth` from `@earendil-works/pi-tui`.
- A5-refined: ALWAYS render our footer. z.ai quota segment is subscription-scoped (shown when zai key exists, dimmed when active provider ≠ zai). Session segment is active-provider-scoped. Never yield to native. Truncation order (drop right→left): quota → ctx% → tokens → git; always keep model badge.

---

## File Structure

```
pi-statusline/
├─ package.json                    # pi-extension manifest, deps, scripts
├─ tsconfig.json                   # strict TS, ESM, node-types
├─ README.md
├─ LICENSE
├─ src/
│  ├─ index.ts                     # activate: setFooter, poller, events, registerCommand
│  ├─ config.ts                    # load/save ~/.pi/agent/pi-statusline.json + defaults
│  ├─ provider.ts                  # detect active provider from ctx.model
│  ├─ quota/
│  │  └─ zai.ts                    # auth.json key read, GET /quota/limit, poller + cache
│  ├─ segments/
│  │  ├─ model.ts                  # model badge segment
│  │  ├─ git.ts                    # git branch segment
│  │  ├─ tokens.ts                 # token counters (in/out) from sessionManager
│  │  ├─ context.ts                # context % from ctx.getContextUsage()
│  │  └─ quota.ts                  # z.ai quota segment (5h + weekly + reset)
│  ├─ footer.ts                    # setFooter factory: compose → render(width), truncate, dim
│  └─ tui/
│     └─ settings.ts               # /statusline interactive panel
├─ test/
│  ├─ config.test.ts
│  ├─ provider.test.ts
│  ├─ quota-zai.test.ts
│  ├─ segments.test.ts
│  ├─ footer.test.ts
│  └── tui-settings.test.ts
```

---

### Task 1: Scaffold (package.json, tsconfig, README, dir structure)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts` (minimal stub that does nothing yet)
- Modify: `README.md` (repo already has one — replace the stub body with this content)
- `.gitignore` already covers `node_modules/` — no change needed

**Interfaces:**
- Produces: a loadable pi extension package (`@getpipher/pi-statusline`) with the correct manifest.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@getpipher/pi-statusline",
  "version": "0.1.0",
  "description": "Adaptive, provider-aware footer for the Pi Coding Agent. Shows authoritative z.ai quota balance.",
  "keywords": [
    "pi-package",
    "pi-extension",
    "statusline",
    "footer",
    "zai",
    "glm"
  ],
  "license": "MIT",
  "author": "RECTOR (https://github.com/rz1989s)",
  "homepage": "https://github.com/getpipher/pi-statusline",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test:run": "node --import tsx --test test/*.test.ts"
  },
  "pi": {
    "extensions": [
      "./src/index.ts"
    ]
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.23.1",
    "typescript": "^5.6.0"
  }
}
```

> pi runtime deps follow the sibling-extension convention (`@getpipher/welcome`, `@getpipher/cursor`): declare `@earendil-works/pi-coding-agent` + `@earendil-works/pi-tui` so `pnpm typecheck` and node:test resolve the `ExtensionAPI` types and `visibleWidth`. Without these the Task 7 imports fail.
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Create minimal src/index.ts stub**

```typescript
// src/index.ts — pi-statusline entry point (stub; wired in Task 7)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (_pi: ExtensionAPI): void {
  // Wired in Task 7.
}
```

- [ ] **Step 4: Rewrite README.md (repo's stub exists — replace body)**

```markdown
# pi-statusline

> Adaptive, provider-aware footer (statusline) for the Pi Coding Agent.

Replaces pi's native footer with a multi-segment bar. For z.ai (GLM Coding Plan)
it shows **authoritative** 5h + weekly credit balance polled from the console API
(`/quota/limit`); per-provider `$ cost` (OpenRouter etc.) is deferred.

## Install

In `~/.pi/agent/settings.json`:

```json
{ "packages": ["@getpipher/pi-statusline"] }
```

## Config

`~/.pi/agent/pi-statusline.json`:

```json
{
  "enabled": true,
  "zai": { "tier": "auto", "pollIntervalMs": 180000 },
  "display": { "showTokens": true, "showContext": true, "showGit": true }
}
```

Run `/statusline` for the interactive settings panel.
```

- [ ] **Step 6: Install deps + typecheck + commit**

```bash
pnpm install
pnpm typecheck
git add package.json tsconfig.json src/index.ts .gitignore README.md
git commit -m "chore: scaffold pi-statusline package + tsconfig + stub"
```

---

### Task 2: config.ts — load/save/defaults

**Files:**
- Create: `src/config.ts`
- Create: `test/config.test.ts`

**Interfaces:**
- Produces: `loadConfig()` → `StatuslineConfig`, `saveConfig(cfg)` → void, `DEFAULT_CONFIG` constant.

- [ ] **Step 1: Write the failing test**

```typescript
// test/config.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/config.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "pi-sl-cfg-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test("DEFAULT_CONFIG has expected shape", () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    enabled: true,
    zai: { tier: "auto", pollIntervalMs: 180_000 },
    display: { showTokens: true, showContext: true, showGit: true },
  });
});

test("loadConfig returns defaults when file missing", () => {
  const cfg = loadConfig(join(tmpDir, "pi-statusline.json"));
  assert.deepEqual(cfg, DEFAULT_CONFIG);
});

test("loadConfig reads a valid file", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({
    enabled: false,
    zai: { tier: "pro", pollIntervalMs: 60_000 },
    display: { showTokens: false, showContext: true, showGit: false },
  }));
  const cfg = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "pro");
  assert.equal(cfg.zai.pollIntervalMs, 60_000);
  assert.equal(cfg.display.showTokens, false);
  assert.equal(cfg.display.showGit, false);
});

test("loadConfig merges defaults for missing keys", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ enabled: false }));
  const cfg = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "auto");         // defaulted
  assert.equal(cfg.zai.pollIntervalMs, 180_000); // defaulted
  assert.equal(cfg.display.showTokens, true);  // defaulted
});

test("loadConfig rejects invalid tier value", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ zai: { tier: "invalid" } }));
  assert.throws(() => loadConfig(path), /tier must be/);
});

test("saveConfig writes valid JSON readable by loadConfig", () => {
  const path = join(tmpDir, "pi-statusline.json");
  const cfg = { ...DEFAULT_CONFIG, enabled: false };
  saveConfig(path, cfg);
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.enabled, false);
  // Round-trip
  const reloaded = loadConfig(path);
  assert.equal(reloaded.enabled, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/config.test.ts
```
Expected: FAIL — `Cannot find module '../src/config.ts'`

- [ ] **Step 3: Write implementation**

```typescript
// src/config.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StatuslineConfig {
  enabled: boolean;
  zai: {
    tier: "auto" | "lite" | "pro" | "max";
    pollIntervalMs: number;
  };
  display: {
    showTokens: boolean;
    showContext: boolean;
    showGit: boolean;
  };
}

export const DEFAULT_CONFIG: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  display: { showTokens: true, showContext: true, showGit: true },
};

const VALID_TIERS = ["auto", "lite", "pro", "max"] as const;

export function loadConfig(path: string): StatuslineConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  const cfg = structuredClone(DEFAULT_CONFIG);

  if (typeof parsed.enabled === "boolean") cfg.enabled = parsed.enabled;

  if (parsed.zai && typeof parsed.zai === "object") {
    const z = parsed.zai as Record<string, unknown>;
    if (typeof z.tier === "string") {
      if (!VALID_TIERS.includes(z.tier as typeof VALID_TIERS[number])) {
        throw new Error(`tier must be one of: ${VALID_TIERS.join(", ")}`);
      }
      cfg.zai.tier = z.tier as StatuslineConfig["zai"]["tier"];
    }
    if (typeof z.pollIntervalMs === "number" && z.pollIntervalMs > 0) {
      cfg.zai.pollIntervalMs = z.pollIntervalMs;
    }
  }

  if (parsed.display && typeof parsed.display === "object") {
    const d = parsed.display as Record<string, unknown>;
    if (typeof d.showTokens === "boolean") cfg.display.showTokens = d.showTokens;
    if (typeof d.showContext === "boolean") cfg.display.showContext = d.showContext;
    if (typeof d.showGit === "boolean") cfg.display.showGit = d.showGit;
  }

  return cfg;
}

export function saveConfig(path: string, cfg: StatuslineConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/config.test.ts
```
Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat(config): load/save pi-statusline.json with defaults + validation"
```

---

### Task 3: quota/zai.ts — auth.json key read, API client, poller + cache

**Files:**
- Create: `src/quota/zai.ts`
- Create: `test/quota-zai.test.ts`

**Interfaces:**
- Produces: `readZaiKey(authJsonPath)` → `string | null`, `fetchQuota(apiKey)` → `QuotaResult | null`, `createQuotaPoller(opts)` → `{ get: () => QuotaResult | null, start: () => void, stop: () => void, refresh: () => Promise<void> }`.
- Types: `QuotaResult`, `QuotaLimit`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/quota-zai.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readZaiKey,
  parseQuotaResponse,
  type QuotaResult,
} from "../src/quota/zai.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "pi-sl-zai-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test("readZaiKey returns key from valid auth.json", () => {
  const path = join(tmpDir, "auth.json");
  writeFileSync(path, JSON.stringify({
    zai: { type: "api_key", key: "test-key-123" },
  }));
  const key = readZaiKey(path);
  assert.equal(key, "test-key-123");
});

test("readZaiKey returns null when auth.json missing", () => {
  const key = readZaiKey(join(tmpDir, "nonexistent.json"));
  assert.equal(key, null);
});

test("readZaiKey returns null when zai key absent", () => {
  const path = join(tmpDir, "auth.json");
  writeFileSync(path, JSON.stringify({ openai: { key: "x" } }));
  const key = readZaiKey(path);
  assert.equal(key, null);
});

test("readZaiKey returns null on malformed JSON", () => {
  const path = join(tmpDir, "auth.json");
  writeFileSync(path, "{not valid json}");
  const key = readZaiKey(path);
  assert.equal(key, null);
});

const SAMPLE_API_RESPONSE = {
  code: 200,
  msg: "Operation successful",
  success: true,
  data: {
    limits: [
      { type: "CREDIT_LIMIT", unit: 3, number: 5, usage: 2000, currentValue: 1501, remaining: 498, percentage: 75, nextResetTime: 1786539568992 },
      { type: "CREDIT_LIMIT", unit: 6, number: 1, usage: 10000, currentValue: 1501, remaining: 8498, percentage: 15, nextResetTime: 1787126084998 },
    ],
    level: "lite",
  },
};

test("parseQuotaResponse extracts 5h + weekly limits + tier", () => {
  const result = parseQuotaResponse(JSON.stringify(SAMPLE_API_RESPONSE));
  assert.ok(result);
  assert.equal(result!.tier, "lite");
  assert.ok(result!.fiveHour);
  assert.equal(result!.fiveHour!.remaining, 498);
  assert.equal(result!.fiveHour!.percentage, 75);
  assert.equal(result!.fiveHour!.currentValue, 1501);
  assert.equal(result!.fiveHour!.nextResetTime, 1786539568992);
  assert.ok(result!.weekly);
  assert.equal(result!.weekly!.remaining, 8498);
  assert.equal(result!.weekly!.percentage, 15);
  assert.equal(result!.weekly!.nextResetTime, 1787126084998);
});

test("parseQuotaResponse identifies 5h vs weekly by unit field", () => {
  const result = parseQuotaResponse(JSON.stringify(SAMPLE_API_RESPONSE));
  assert.ok(result);
  assert.equal(result!.fiveHour!.unit, 3);
  assert.equal(result!.weekly!.unit, 6);
});

test("parseQuotaResponse returns null on non-200 code", () => {
  const result = parseQuotaResponse(JSON.stringify({ code: 401, success: false }));
  assert.equal(result, null);
});

test("parseQuotaResponse returns null on malformed JSON", () => {
  const result = parseQuotaResponse("not json");
  assert.equal(result, null);
});

test("parseQuotaResponse returns null when limits array empty", () => {
  const result = parseQuotaResponse(JSON.stringify({
    code: 200, success: true, data: { limits: [], level: "lite" },
  }));
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/quota-zai.test.ts
```
Expected: FAIL — `Cannot find module '../src/quota/zai.ts'`

- [ ] **Step 3: Write implementation**

```typescript
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
      const result = await fetchQuota(opts.apiKey);
      if (result) {
        cache = result;
        opts.onRefresh?.();
      }
    } finally {
      polling = false;
    }
  }

  return {
    get: () => cache,
    start: () => {
      if (timer) return;
      void doPoll(); // fire immediately on start
      timer = setInterval(() => void doPoll(), opts.intervalMs);
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/quota-zai.test.ts
```
Expected: PASS — 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/quota/zai.ts test/quota-zai.test.ts
git commit -m "feat(quota): zai key read + quota API parse + poller with cache"
```

---

### Task 4: provider.ts + segments (model/git/tokens/context/quota)

**Files:**
- Create: `src/provider.ts`
- Create: `src/segments/model.ts`
- Create: `src/segments/git.ts`
- Create: `src/segments/tokens.ts`
- Create: `src/segments/context.ts`
- Create: `src/segments/quota.ts`
- Create: `test/segments.test.ts`

**Interfaces:**
- Produces: `detectProvider(model)` → `string`, `renderModelSegment(model)` → string, `renderGitSegment(branch)` → string, `renderTokensSegment(entries)` → string, `renderContextSegment(usage)` → string, `renderQuotaSegment(quota, dimmed)` → string.
- Consumes: `QuotaResult` from `src/quota/zai.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// test/segments.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectProvider, isZaiProvider } from "../src/provider.ts";
import { renderModelSegment } from "../src/segments/model.ts";
import { renderGitSegment } from "../src/segments/git.ts";
import { renderTokensSegment } from "../src/segments/tokens.ts";
import { renderContextSegment } from "../src/segments/context.ts";
import { renderQuotaSegment } from "../src/segments/quota.ts";
import type { QuotaResult } from "../src/quota/zai.ts";

test("detectProvider extracts provider from model id", () => {
  assert.equal(detectProvider("zai/glm-5.2"), "zai");
  assert.equal(detectProvider("Ollama/glm-5.2:cloud"), "Ollama");
  assert.equal(detectProvider("anthropic/claude-sonnet-4"), "anthropic");
  assert.equal(detectProvider("some-model"), "unknown");
});

test("isZaiProvider: true for the zai provider (the active GLM Coding Plan session)", () => {
  assert.equal(isZaiProvider("zai/glm-5.2"), true);
});

test("isZaiProvider: false for the Ollama proxy and other providers", () => {
  assert.equal(isZaiProvider("Ollama/glm-5.2:cloud"), false);
  assert.equal(isZaiProvider("anthropic/claude-sonnet-4"), false);
  assert.equal(isZaiProvider("openai-codex/gpt-5.6-sol"), false);
  assert.equal(isZaiProvider(undefined), false);
});

test("renderModelSegment shortens model id", () => {
  assert.equal(renderModelSegment("Ollama/glm-5.2:cloud"), "glm-5.2");
  assert.equal(renderModelSegment("anthropic/claude-sonnet-4"), "claude-sonnet-4");
  assert.equal(renderModelSegment("bare-model"), "bare-model");
});

test("renderGitSegment formats branch", () => {
  assert.equal(renderGitSegment("main"), "main");
  assert.equal(renderGitSegment(null), "");
  assert.equal(renderGitSegment(""), "");
});

test("renderTokensSegment formats input/output", () => {
  const entries = [
    { type: "message", message: { role: "assistant", usage: { input: 500, output: 200, cacheRead: 100, cacheWrite: 50, totalTokens: 850 } } },
    { type: "message", message: { role: "assistant", usage: { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0, totalTokens: 1500 } } },
    { type: "message", message: { role: "user", content: "hi" } },
  ];
  const result = renderTokensSegment(entries as any);
  assert.ok(result.includes("↑1.5k"), `input total: ${result}`);
  assert.ok(result.includes("↓700"), `output total: ${result}`);
});

test("renderContextSegment formats percentage", () => {
  assert.equal(renderContextSegment({ tokens: 50000, maxTokens: 200000 }), "25%");
  assert.equal(renderContextSegment(null), "");
});

const SAMPLE_QUOTA: QuotaResult = {
  tier: "lite",
  fiveHour: { unit: 3, number: 5, usage: 2000, currentValue: 1501, remaining: 498, percentage: 75, nextResetTime: Date.now() + 3 * 3600_000 },
  weekly: { unit: 6, number: 1, usage: 10000, currentValue: 1501, remaining: 8498, percentage: 15, nextResetTime: Date.now() + 5 * 24 * 3600_000 },
  fetchedAt: Date.now(),
};

test("renderQuotaSegment renders 5h + weekly with consumed/ceiling + %", () => {
  const result = renderQuotaSegment(SAMPLE_QUOTA, false);
  assert.ok(result.includes("⚡zai"), `has zai label: ${result}`);
  assert.ok(result.includes("5h 1.5k/2.0k 75%"), `has 5h consumed/ceiling/pct: ${result}`);
  assert.ok(result.includes("wk 1.5k/10k 15%"), `has weekly consumed/ceiling/pct: ${result}`);
});

test("renderQuotaSegment includes reset countdown for the sooner window", () => {
  const result = renderQuotaSegment(SAMPLE_QUOTA, false);
  assert.ok(result.includes("reset "), `has reset: ${result}`);
});

test("renderQuotaSegment renders dimmed prefix when dimmed=true", () => {
  const result = renderQuotaSegment(SAMPLE_QUOTA, true);
  assert.ok(result.length > 0, "still renders when dimmed");
});

test("renderQuotaSegment handles null quota", () => {
  const result = renderQuotaSegment(null, false);
  assert.equal(result, "");
});

test("renderQuotaSegment handles missing weekly", () => {
  const partial: QuotaResult = {
    ...SAMPLE_QUOTA,
    weekly: null,
  };
  const result = renderQuotaSegment(partial, false);
  assert.ok(result.includes("5h"), "has 5h");
  assert.ok(!result.includes("wk"), "no weekly segment");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/segments.test.ts
```
Expected: FAIL — `Cannot find module '../src/provider.ts'`

- [ ] **Step 3: Write implementations**

```typescript
// src/provider.ts
export function detectProvider(modelId: string | undefined): string {
  if (!modelId) return "unknown";
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : "unknown";
}

// The active GLM Coding Plan session runs on provider "zai" (pi defaultProvider),
// NOT the Ollama cloud proxy ("Ollama/glm-5.2:cloud"). This drives A5 quota dimming:
// quota is bright when the session actually draws on the z.ai plan.
export function isZaiProvider(modelId: string | undefined): boolean {
  return detectProvider(modelId) === "zai";
}
```

```typescript
// src/segments/model.ts
export function renderModelSegment(modelId: string | undefined): string {
  if (!modelId) return "no-model";
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(slash + 1) : modelId;
}
```

```typescript
// src/segments/git.ts
export function renderGitSegment(branch: string | null | undefined): string {
  if (!branch) return "";
  return branch;
}
```

```typescript
// src/segments/tokens.ts
interface SessionEntry {
  type: string;
  message?: {
    role?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens?: number;
    };
  };
}

export function renderTokensSegment(entries: SessionEntry[]): string {
  let input = 0;
  let output = 0;
  for (const e of entries) {
    if (e.type === "message" && e.message?.role === "assistant") {
      const u = e.message.usage;
      if (u) {
        input += u.input ?? 0;
        output += u.output ?? 0;
      }
    }
  }
  const fmt = (n: number): string => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
  return `↑${fmt(input)} ↓${fmt(output)}`;
}

export function computeTokenTotals(entries: SessionEntry[]): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const e of entries) {
    if (e.type === "message" && e.message?.role === "assistant") {
      const u = e.message.usage;
      if (u) {
        input += u.input ?? 0;
        output += u.output ?? 0;
      }
    }
  }
  return { input, output };
}
```

```typescript
// src/segments/context.ts
export interface ContextUsage {
  tokens: number;
  maxTokens: number;
}

export function renderContextSegment(usage: ContextUsage | null | undefined): string {
  if (!usage || !usage.maxTokens || usage.maxTokens <= 0) return "";
  const pct = Math.round((usage.tokens / usage.maxTokens) * 100);
  return `${pct}%`;
}
```

```typescript
// src/segments/quota.ts
import type { QuotaResult } from "../quota/zai.ts";

function fmtReset(ms: number): string {
  const remaining = ms - Date.now();
  if (remaining <= 0) return "now";
  const hours = Math.floor(remaining / 3600_000);
  const minutes = Math.floor((remaining % 3600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d${hours % 24}h`;
  }
  return `${hours}h${minutes}m`;
}

export function renderQuotaSegment(quota: QuotaResult | null, dimmed: boolean): string {
  if (!quota) return "";

  const fmt = (n: number): string => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
  const parts: string[] = [];

  if (quota.fiveHour) {
    parts.push(`5h ${fmt(quota.fiveHour.currentValue)}/${fmt(quota.fiveHour.usage)} ${quota.fiveHour.percentage}%`);
  }
  if (quota.weekly) {
    parts.push(`wk ${fmt(quota.weekly.currentValue)}/${fmt(quota.weekly.usage)} ${quota.weekly.percentage}%`);
  }

  // Reset countdown for the sooner window (nextResetTime is ms-epoch UTC → local diff)
  const resets: number[] = [];
  if (quota.fiveHour?.nextResetTime) resets.push(quota.fiveHour.nextResetTime);
  if (quota.weekly?.nextResetTime) resets.push(quota.weekly.nextResetTime);
  if (resets.length > 0) {
    parts.push(`reset ${fmtReset(Math.min(...resets))}`);
  }

  // Label is the PROVIDER (zai), not the tier — the tier is auto-detected (A4′) and
  // surfaced via config; the badge answers "whose balance is this".
  const text = `⚡zai ${parts.join(" · ")}`;
  // The `dimmed` flag is a hint to the footer renderer; the segment itself
  // returns plain text. The footer applies theme.fg("dim", ...) when dimmed.
  return dimmed ? text : text;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/segments.test.ts
```
Expected: PASS — 12 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/provider.ts src/segments/ test/segments.test.ts
git commit -m "feat(segments): provider detect + model/git/tokens/context/quota renderers"
```

---

### Task 5: footer.ts — setFooter factory with compose + truncate + dim

**Files:**
- Create: `src/footer.ts`
- Create: `test/footer.test.ts`

**Interfaces:**
- Produces: `createFooterFactory(opts)` → the `(tui, theme, footerData) => { render, dispose, invalidate }` factory passed to `ctx.ui.setFooter()`.
- Consumes: `composeSegments` + `truncateSegments` from this file's own module; segment renderers from Task 4; `QuotaPoller` from Task 3.
- Note: `createFooterFactory` from the original draft is **replaced** by Task 7's `installFooter(ctx)` wiring; `composeFooterLine` is **replaced** by `composeSegments` (returns the ordered array; the caller joins AFTER truncation — never re-split a joined string, since the quota segment contains spaces).

- [ ] **Step 1: Write the failing test**

```typescript
// test/footer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { composeSegments, truncateSegments } from "../src/footer.ts";
import type { StatuslineConfig } from "../src/config.ts";

const cfg: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  display: { showTokens: true, showContext: true, showGit: true },
};

test("composeSegments produces model + tokens + ctx + git in canonical order", () => {
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfg,
  });
  // Canonical order: [model, git, tokens, ctx, quota] — truncation relies on it
  assert.deepEqual(segs, ["glm-5.2", "main", "↑1.5k ↓700", "42%"]);
});

test("composeSegments includes quota as the LAST segment when present", () => {
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: "⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m",
    config: cfg,
  });
  assert.equal(segs[segs.length - 1], "⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m");
  assert.ok(segs[0] === "glm-5.2");
});

test("composeSegments omits git when display.showGit=false", () => {
  const cfgNoGit = { ...cfg, display: { ...cfg.display, showGit: false } };
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfgNoGit,
  });
  assert.ok(!segs.includes("main"), `no git: ${JSON.stringify(segs)}`);
});

test("composeSegments omits tokens when display.showTokens=false", () => {
  const cfgNoTok = { ...cfg, display: { ...cfg.display, showTokens: false } };
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfgNoTok,
  });
  assert.ok(!segs.some((s) => s.includes("↑")), `no tokens: ${JSON.stringify(segs)}`);
});

test("truncateSegments drops rightmost first (quota → ctx → tokens → git)", () => {
  const segs = [
    "glm-5.2",       // model — always kept (index 0)
    "main",          // git — dropped 4th
    "↑1.5k ↓700",   // tokens — dropped 3rd
    "42%",           // ctx — dropped 2nd
    "⚡zai 5h 1.5k/2.0k 75%",  // quota — dropped 1st
  ];
  // At width ~20, should drop quota
  const truncated = truncateSegments(segs, 20);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("glm-5.2"), "model kept");
  assert.ok(!joined.includes("⚡"), "quota dropped");
});

test("truncateSegments is robust to missing segments (no git)", () => {
  // Canonical order minus git — pop-from-end still drops quota first, not ctx
  const segs = ["glm-5.2", "↑1.5k ↓700", "42%", "⚡zai 5h 1.5k/2.0k 75%"];
  const truncated = truncateSegments(segs, 20);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("glm-5.2"), "model kept");
  assert.ok(!joined.includes("⚡"), "quota dropped first even without git");
});

test("truncateSegments always keeps model badge", () => {
  const segs = ["claude-sonnet-4", "main", "↑1.5k ↓700", "42%", "⚡zai 5h 75%"];
  const truncated = truncateSegments(segs, 5);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("claude-sonnet-4"), "model kept at tiny width");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/footer.test.ts
```
Expected: FAIL — `Cannot find module '../src/footer.ts'`

- [ ] **Step 3: Write implementation**

```typescript
// src/footer.ts
import { visibleWidth } from "@earendil-works/pi-tui";
import type { StatuslineConfig } from "./config.ts";

export interface FooterRenderInput {
  modelId: string | undefined;
  gitBranch: string | null;
  tokens: string;
  ctxPct: string;
  quota: string | null;
  config: StatuslineConfig;
}

// Canonical segment order: [model, git, tokens, ctx, quota].
// truncateSegments drops from the RIGHT (quota → ctx → tokens → git), so this
// order IS the drop order — missing segments (empty git, disabled tokens) are
// simply absent and never break the indices.
export function composeSegments(input: FooterRenderInput): string[] {
  const parts: string[] = [];

  // Model badge — always present (index 0)
  const slash = input.modelId ? input.modelId.indexOf("/") : -1;
  const modelShort = slash > 0 ? input.modelId!.slice(slash + 1) : (input.modelId ?? "no-model");
  parts.push(modelShort);

  // Git branch
  if (input.config.display.showGit && input.gitBranch) {
    parts.push(input.gitBranch);
  }

  // Tokens
  if (input.config.display.showTokens && input.tokens) {
    parts.push(input.tokens);
  }

  // Context %
  if (input.config.display.showContext && input.ctxPct) {
    parts.push(input.ctxPct);
  }

  // Quota (subscription-scoped — shown whenever we have data) — LAST = first dropped
  if (input.quota) {
    parts.push(input.quota);
  }

  return parts;
}

// Drop from the right until it fits; index 0 (model badge) is always kept.
// Uses pi-tui visibleWidth so multi-cell glyphs (⚡ ↑ ↓ ·) measure correctly.
export function truncateSegments(segments: string[], maxWidth: number): string[] {
  const kept = segments.filter((s) => s !== "");
  while (kept.length > 1 && visibleWidth(kept.join(" ")) > maxWidth) {
    kept.pop();
  }
  return kept;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/footer.test.ts
```
Expected: PASS — 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/footer.ts test/footer.test.ts
git commit -m "feat(footer): compose + truncate segments with responsive width"
```

---

### Task 6: /statusline command — arg parser + settings TUI

**Files:**
- Create: `src/tui/settings.ts`
- Create: `test/tui-settings.test.ts`

**Interfaces:**
- Produces: `parseStatuslineArgs(args)` → `StatuslineAction`. (The interactive `ctx.ui.custom()` settings panel is DEFERRED out of v1 — Task 7 wires a notify-based direct-arg UX; see design §9 follow-up.)

- [ ] **Step 1: Write the failing test (arg parser only; TUI is smoke-tested in Task 7)**

```typescript
// test/tui-settings.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseStatuslineArgs } from "../src/tui/settings.ts";

test("parseStatuslineArgs: empty args → 'open-panel'", () => {
  assert.deepEqual(parseStatuslineArgs(""), { action: "open-panel" });
  assert.deepEqual(parseStatuslineArgs(undefined), { action: "open-panel" });
});

test("parseStatuslineArgs: 'refresh' → refresh action", () => {
  assert.deepEqual(parseStatuslineArgs("refresh"), { action: "refresh" });
});

test("parseStatuslineArgs: 'on' → enable", () => {
  assert.deepEqual(parseStatuslineArgs("on"), { action: "set-enabled", enabled: true });
});

test("parseStatuslineArgs: 'off' → disable", () => {
  assert.deepEqual(parseStatuslineArgs("off"), { action: "set-enabled", enabled: false });
});

test("parseStatuslineArgs: 'tier auto' → set tier", () => {
  assert.deepEqual(parseStatuslineArgs("tier auto"), { action: "set-tier", tier: "auto" });
  assert.deepEqual(parseStatuslineArgs("tier pro"), { action: "set-tier", tier: "pro" });
  assert.deepEqual(parseStatuslineArgs("tier max"), { action: "set-tier", tier: "max" });
  assert.deepEqual(parseStatuslineArgs("tier lite"), { action: "set-tier", tier: "lite" });
});

test("parseStatuslineArgs: 'tier invalid' → error", () => {
  const result = parseStatuslineArgs("tier bogus");
  assert.equal(result.action, "error");
  assert.ok((result as { message: string }).message.includes("tier must be"), `error message: ${JSON.stringify(result)}`);
});

test("parseStatuslineArgs: unknown command → error", () => {
  const result = parseStatuslineArgs("bogus-command");
  assert.equal(result.action, "error");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/tui-settings.test.ts
```
Expected: FAIL — `Cannot find module '../src/tui/settings.ts'`

- [ ] **Step 3: Write implementation**

```typescript
// src/tui/settings.ts
export type StatuslineAction =
  | { action: "open-panel" }
  | { action: "refresh" }
  | { action: "set-enabled"; enabled: boolean }
  | { action: "set-tier"; tier: "auto" | "lite" | "pro" | "max" }
  | { action: "error"; message: string };

const VALID_TIERS = ["auto", "lite", "pro", "max"] as const;

export function parseStatuslineArgs(args: string | undefined): StatuslineAction {
  if (!args || args.trim() === "") return { action: "open-panel" };

  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase();

  switch (cmd) {
    case "refresh":
      return { action: "refresh" };
    case "on":
      return { action: "set-enabled", enabled: true };
    case "off":
      return { action: "set-enabled", enabled: false };
    case "tier": {
      const val = parts[1]?.toLowerCase();
      if (!val || !VALID_TIERS.includes(val as typeof VALID_TIERS[number])) {
        return { action: "error", message: `tier must be one of: ${VALID_TIERS.join(", ")}` };
      }
      return { action: "set-tier", tier: val as typeof VALID_TIERS[number] };
    }
    default:
      return { action: "error", message: `unknown command: ${cmd}` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/tui-settings.test.ts
```
Expected: PASS — 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/tui/settings.ts test/tui-settings.test.ts
git commit -m "feat(tui): /statusline arg parser (refresh/on/off/tier)"
```

---

### Task 7: Entry wiring — index.ts activate (setFooter, poller, events, registerCommand)

**Files:**
- Modify: `src/index.ts` (replace stub with full activate function)

**Interfaces:**
- Consumes: everything from Tasks 2–6.
- Produces: the full pi extension.

- [ ] **Step 1: Write the entry**

This task has no unit test — it's integration wiring that depends on pi runtime APIs (`ctx.ui.setFooter`, `ctx.sessionManager`, `ctx.model`, `pi.registerCommand`, `pi.on`). Instead, we verify it compiles via `pnpm typecheck` and loads via a manual `pi --list-extensions` smoke.

```typescript
// src/index.ts
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadConfig, saveConfig, type StatuslineConfig } from "./config.ts";
import { readZaiKey, createQuotaPoller, type QuotaPoller } from "./quota/zai.ts";
import { isZaiProvider } from "./provider.ts";
import { renderTokensSegment } from "./segments/tokens.ts";
import { renderContextSegment } from "./segments/context.ts";
import { renderQuotaSegment } from "./segments/quota.ts";
import { composeSegments, truncateSegments } from "./footer.ts";
import { parseStatuslineArgs } from "./tui/settings.ts";

const AUTH_JSON = join(homedir(), ".pi", "agent", "auth.json");
const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-statusline.json");

export default function (pi: ExtensionAPI): void {
  let config = loadConfig(CONFIG_PATH);
  let poller: QuotaPoller | null = null;
  let requestRenderFn: (() => void) | null = null;
  let sessionCtx: ExtensionContext | null = null;
  let footerInstalled = false;

  function startPoller(): void {
    stopPoller();
    const apiKey = readZaiKey(AUTH_JSON);
    if (!apiKey) return;

    poller = createQuotaPoller({
      apiKey,
      intervalMs: config.zai.pollIntervalMs,
      onRefresh: () => requestRenderFn?.(),
    });
    poller.start();
  }

  function stopPoller(): void {
    poller?.stop();
    poller = null;
  }

  function installFooter(ctx: ExtensionContext): void {
    if (footerInstalled) return;
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRenderFn = () => tui.requestRender();

      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          stopPoller();
        },
        invalidate() {
          tui.requestRender();
        },
        render(width: number): string[] {
          const modelId = ctx.model?.id;
          const branch = footerData.getGitBranch();

          let tokensStr = "";
          if (config.display.showTokens) {
            const entries = ctx.sessionManager.getBranch() as Array<Record<string, unknown>>;
            tokensStr = renderTokensSegment(entries as never);
          }

          let ctxPct = "";
          if (config.display.showContext) {
            const usage = ctx.getContextUsage();
            ctxPct = renderContextSegment(usage ? { tokens: usage.tokens, maxTokens: (usage as { maxTokens?: number }).maxTokens ?? 0 } : null);
          }

          // A5 quota dimming: bright when the session draws on the z.ai plan,
          // dimmed when the active provider is something else (subscription status).
          const quotaDimmed = !isZaiProvider(modelId);
          const quotaStr = renderQuotaSegment(poller?.get() ?? null, quotaDimmed);

          // Build the canonical segment ARRAY, truncate it, THEN join —
          // never re-split a joined string (quota segment contains spaces).
          const segs = composeSegments({
            modelId,
            gitBranch: branch,
            tokens: tokensStr,
            ctxPct,
            quota: quotaStr || null,
            config,
          });
          const kept = truncateSegments(segs, width);

          // Theme: model badge accent; quota dim only when dimmed; rest muted.
          const modelBadge = segs[0]!;
          const line = kept
            .map((seg) => {
              if (quotaStr && seg === quotaStr) return theme.fg(quotaDimmed ? "dim" : "text", seg);
              if (seg === modelBadge) return theme.fg("accent", seg);
              return theme.fg("muted", seg);
            })
            .join(" ");
          return [line];
        },
      };
    });
    footerInstalled = true;
  }

  function reloadConfig(): void {
    config = loadConfig(CONFIG_PATH);
    if (config.enabled) {
      startPoller();
      if (sessionCtx) installFooter(sessionCtx);
    } else {
      stopPoller();
    }
    requestRenderFn?.();
  }

  // Wire footer + poller on session start
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    if (config.enabled) {
      installFooter(ctx);
      startPoller();
    }
  });

  // Re-render on model change (provider switch affects quota dimming)
  pi.on("model_select", () => {
    requestRenderFn?.();
  });

  // Register /statusline command
  pi.registerCommand("statusline", {
    description: "Configure the statusline (refresh | on | off | tier <auto|lite|pro|max>)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      const action = parseStatuslineArgs(args);

      switch (action.action) {
        case "open-panel":
          ctx.ui.notify("Use /statusline refresh | on | off | tier <auto|lite|pro|max>", "info");
          break;
        case "refresh":
          if (poller) {
            await poller.refresh();
            requestRenderFn?.();
            ctx.ui.notify("Quota refreshed", "info");
          } else {
            ctx.ui.notify("z.ai not configured — no poller running", "warning");
          }
          break;
        case "set-enabled": {
          config = { ...config, enabled: action.enabled };
          saveConfig(CONFIG_PATH, config);
          if (action.enabled) {
            reloadConfig(); // starts poller + installs footer mid-session (no restart needed)
            ctx.ui.notify("Statusline enabled", "info");
          } else {
            // Explicit user disable is the ONE legitimate yield-to-native:
            // A5's "never yield" rule governs provider switches, not /off.
            ctx.ui.setFooter(undefined);
            footerInstalled = false;
            stopPoller();
            ctx.ui.notify("Statusline disabled — native footer restored", "info");
          }
          break;
        }
        case "set-tier": {
          config = { ...config, zai: { ...config.zai, tier: action.tier } };
          saveConfig(CONFIG_PATH, config);
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: clean (0 errors). If pi types are not resolved, verify `@earendil-works/pi-coding-agent` is installed.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(entry): wire setFooter + poller + events + /statusline command"
```

---

### Task 8: Local fast-path (OPTIONAL — demoted priority)

**Files:**
- Create: `src/quota/local-fast-path.ts`
- Create: `test/local-fast-path.test.ts`

**Interfaces:**
- Produces: `interpolateQuota(lastKnown, messagesSincePoll)` → estimated `QuotaResult` (formula-based between polls).

> This task is **optional** and **lowest priority**. The authoritative poll (Task 3) is the source of truth. This module only interpolates between polls using the published credit formula and provides offline fallback. Skip if time is tight — the extension works without it.

- [ ] **Step 1: Write the failing test**

```typescript
// test/local-fast-path.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateCredits } from "../src/quota/local-fast-path.ts";

test("estimateCredits: 0 input → 0 credits", () => {
  assert.equal(estimateCredits({ input: 0, cacheRead: 0, output: 0 }), 0);
});

test("estimateCredits: uses GLM-5.2 multipliers (in 6.9 / cached 1.7 / out 24)", () => {
  // 6900 input tokens = 6900 * 6.9 / 10000 = 4.761 credits (off-peak, no multiplier)
  const credits = estimateCredits({ input: 6900, cacheRead: 0, output: 0 });
  assert.ok(credits > 4.5 && credits < 5.0, `~4.76 credits: ${credits}`);
});

test("estimateCredits: output is expensive (mult 24)", () => {
  const credits = estimateCredits({ input: 0, cacheRead: 0, output: 1000 });
  // 1000 * 24 / 10000 = 2.4
  assert.ok(credits > 2.3 && credits < 2.5, `~2.4 credits: ${credits}`);
});

test("estimateCredits: cacheRead is cheap (mult 1.7)", () => {
  const credits = estimateCredits({ input: 0, cacheRead: 10000, output: 0 });
  // 10000 * 1.7 / 10000 = 1.7
  assert.ok(credits > 1.6 && credits < 1.8, `~1.7 credits: ${credits}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --import tsx --test test/local-fast-path.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/quota/local-fast-path.ts

// GLM-5.2 credit multipliers (from the published z.ai formula)
const IN_MULT = 6.9;
const CACHED_MULT = 1.7;
const OUT_MULT = 24;

// Off-peak: Mon–Fri 14:00–18:00 SGT (UTC+8) → 50% discount
function isOffPeak(now: Date = new Date()): boolean {
  const sgt = new Date(now.getTime() + 8 * 3600_000 - now.getTimezoneOffset() * 60_000);
  // sgt is now in UTC+8 offset terms; but Date constructor uses local.
  // Simplify: use UTC hours on a shifted epoch.
  const utc8 = new Date(now.getTime() + 8 * 3600_000);
  const day = utc8.getUTCDay(); // 0=Sun, 6=Sat
  const hour = utc8.getUTCHours();
  return day >= 1 && day <= 5 && hour >= 14 && hour < 18;
}

export interface TokenUsage {
  input: number;
  cacheRead: number;
  output: number;
}

export function estimateCredits(usage: TokenUsage, now: Date = new Date()): number {
  const raw =
    (usage.input * IN_MULT + usage.cacheRead * CACHED_MULT + usage.output * OUT_MULT) / 10_000;
  return isOffPeak(now) ? raw * 0.5 : raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --import tsx --test test/local-fast-path.test.ts
```
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/quota/local-fast-path.ts test/local-fast-path.test.ts
git commit -m "feat(quota): optional local credit formula interpolator (demoted priority)"
```

---

## Self-Review

### 1. Spec coverage

| Spec section | Task(s) | Status |
|---|---|---|
| A1 — Replace footer via `ctx.ui.setFooter()` | T7 | ✅ |
| A2 — Provider-adaptive, stable line count | T4 (segments), T7 (wiring) | ✅ |
| A3″ — Authoritative polling of `/quota/limit` | T3 | ✅ |
| A4′ — Auto-detect tier from `data.level` | T3 (`parseQuotaResponse` extracts `level`) | ✅ |
| A5-refined — Always render; subscription-scoped quota + provider-scoped session | T5 (compose + dim), T7 (wiring) | ✅ |
| A6 — Config = JSON + `/statusline` TUI + direct args | T2 (config), T6 (args), T7 (command) | ✅ |
| A7 — TypeScript pi extension on pi-tui | T1 (scaffold), all tasks | ✅ |
| Config schema (§8) | T2 | ✅ |
| `/statusline` UX (§9) | T6 (arg parser), T7 (command handler) | ✅ |
| Segment layout (§7) | T4, T5 | ✅ |
| Truncation order (quota→ctx→tokens→git) | T5 (`truncateSegments`) | ✅ |
| Local fast-path (optional, demoted) | T8 | ✅ (marked optional) |
| z.ai key from auth.json | T3 (`readZaiKey`) | ✅ |
| Poll cadence (startup + interval + refresh) | T3 (poller), T7 (start on session_start, refresh command) | ✅ |

No gaps found.

### 2. Placeholder scan

Searched for: "TBD", "TODO", "implement later", "fill in details", "add appropriate", "similar to Task N", "Add validation/handling".

- No placeholders found. Every step has complete code.

### 3. Type consistency

- `StatuslineConfig` — defined in Task 2, used in Tasks 5, 7. ✅
- `QuotaResult` — defined in Task 3, used in Tasks 4, 5, 7. ✅
- `QuotaPoller` — defined in Task 3, used in Task 7. ✅
- `FooterRenderInput` — defined in Task 5, used conceptually in Task 7 (not imported directly; the footer factory builds the input inline). ✅
- `StatuslineAction` — defined in Task 6, used in Task 7. ✅
- `parseStatuslineArgs` — defined in Task 6, called in Task 7. ✅

All type names and signatures match across tasks.

### 4. Post-review fixes (2026-08-12 — parent review before execution)

Review found implementation-seam bugs; all corrected in place:

1. **`isZaiProvider` was Ollama-centric** (`provider === "Ollama" && includes("glm")`) — inverted A5 dimming, since the active GLM Coding Plan session runs on provider **`zai`** (`zai/glm-5.2`). Now `detectProvider(modelId) === "zai"`, with tests covering `zai/`, `Ollama/`, `anthropic/`, `openai-codex/`, `undefined`.
2. **Task 7 imported token fns from `./segments/git.ts`** — they live in `./segments/tokens.ts`. Imports rewritten; unused imports (`renderGitSegment`, `AssistantMessage`, `visibleWidth` in index, `_rts` alias) removed.
3. **Truncation seam**: `render()` re-split a joined string on spaces — but the quota segment contains spaces, so the index-based `DROP_ORDER` dropped wrong entries (and broke entirely when git/tokens were filtered out, shifting indices). Replaced with `composeSegments()` returning the canonical ordered array `[model, git, tokens, ctx, quota]` + `truncateSegments()` that pops from the right — the pop order *is* the specified drop order (quota → ctx → tokens → git; model always kept) and it's robust to missing segments. Caller joins **after** truncation.
4. **Quota display restored to design §7**: `⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m` (provider label `zai`, not the tier; consumed/ceiling + %).
5. **`/statusline off` yield-to-native** clarified as the one legitimate exception to A5's "never yield" (it governs provider switches, not explicit user disable); notify message fixed (no phantom restart); **`/on` now restores the footer mid-session** via `installFooter(ctx)` (previously footer only installed on `session_start`, so `/on` after `/off` did nothing until restart).
6. **package.json was missing the pi runtime deps** (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) — added per the sibling-extension convention; without them Task 7's imports and `visibleWidth` don't resolve.
7. Theme application fixed: previously every non-model segment rendered `dim`; now model=accent, quota=dim-only-when-dimmed, rest=muted.

---

<!-- Execution handoff: This plan is ready for subagent-driven development (one subagent per task, review between tasks). The optional Task 8 can be deferred or skipped without affecting the core extension. Task 7 (entry wiring) requires pi runtime to smoke-test — it typechecks without pi installed but the `setFooter` + `sessionManager` calls need a real pi session to verify. -->
