// test/adapters-zai.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createZaiAdapter, renderZaiQuota, zaiSegments } from "../src/adapters/zai.ts";
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

test("renderZaiQuota produces the exact v0.4.1 segment format (usage%/elapsed% label (ceiling))", () => {
  // 5h window: reset = NOW+2h55m → elapsed 2h05m of 5h = 42%; weekly: 6d of 7d elapsed = 86%.
  assert.equal(
    renderZaiQuota(QUOTA, NOW),
    "zai 75%/42% 5h (2.0k) | 7DAY 15%/86% (10k) | reset 2h55m",
  );
});

test("renderZaiQuota falls back to weekly when 5h window is missing", () => {
  const weeklyOnly = { ...QUOTA, fiveHour: null } as QuotaResult;
  const out = renderZaiQuota(weeklyOnly, NOW);
  assert.ok(out.startsWith("zai 7DAY 15%/86% (10k)"), out);
  assert.ok(!out.includes("5h"));
});

test("zaiSegments: per-window heat (5h% and weekly% tint independently), reset dim periphery", () => {
  const segs = zaiSegments(QUOTA, NOW);
  assert.deepEqual(
    segs.map((s) => ({ text: s.text, heat: s.heat, color: s.color })),
    [
      { text: "zai 75%/42% 5h (2.0k)", heat: 75, color: undefined },
      { text: " | 7DAY 15%/86% (10k)", heat: 15, color: undefined },
      { text: " | reset 2h55m", heat: null, color: "dim" },
    ],
  );
});

test("quota row prefers segments: 5h heat=75→warning, weekly heat=15→accent, reset dim; est appended", async () => {
  // Real adapter (segments path): per-window heat tints independently. The poller starts
  // empty — seed it through the offline fetch seam before rendering.
  const adapter = createZaiAdapter({
    authJsonPath: "/dev/null",
    readKey: () => "k",
    pollIntervalMs: () => 180_000,
    fetchFn: async () => QUOTA,
  });
  await adapter.fetch();
  const row = createQuotaRow([adapter]);
  const frags = row.render(snap({}), 2)!;
  assert.deepEqual(frags, [
    { text: "zai 75%/42% 5h (2.0k)", color: "warning" },
    { text: " | 7DAY 15%/86% (10k)", color: "accent" },
    { text: " | reset 2h55m", color: "dim" },
    // Est: elapsed 125m → rate 720/h, remaining 175m → 1500 + 2100 = 3.6k (180%).
    { text: " | est 3.6k (180%)", color: "text" },
  ]);
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
  const noData: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => null,
    fetch: async () => null, render: () => "zai", start() {}, stop() {},
  };
  assert.equal(resolveQuotaAdapter([noData], "zai"), null); // no adapter holds data → null
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
    deen: null,
    git: null,
    quotaWindow: null,
    versions: { sl: "", pi: null },
    ...partial,
  };
}


test("quota row: renders the adapter line; dimmed when active provider ≠ adapter", () => {
  const zai: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => QUOTA,
    fetch: async () => QUOTA, render: (d, dim) => renderZaiQuota(d, NOW) + (dim ? "!" : ""), start() {}, stop() {},
  };
  const row = createQuotaRow([zai]);
  // detail 1: the est fragment (Task 4) rides detail 2 only — these assertions pin
  // the adapter-line color, so they render below the est detail level.
  const active = row.render(snap({}), 1)!;
  // No heat() on this adapter → neutral muted.
  assert.deepEqual(active, [{ text: renderZaiQuota(QUOTA, NOW), color: "muted" }]);
  const inactive = row.render(snap({ session: { ...(snap({}).session as SessionSnapshot), provider: "anthropic" } }), 2)!;
  assert.deepEqual(inactive, [{ text: `${renderZaiQuota(QUOTA, NOW)}!`, color: "dim" }]);
});

test("quota row: heat tints the line — accent <70, warning ≥70, error ≥90; dim wins when inactive", () => {
  const mk = (percentage: number): ProviderRowAdapter<QuotaResult> => ({
    id: "zai", matches: (p) => p === "zai", current: () => ({ ...QUOTA, fiveHour: { ...QUOTA.fiveHour!, percentage } }),
    fetch: async () => null, render: () => "zai-line", heat: (d) => d.fiveHour?.percentage ?? null, start() {}, stop() {},
  });
  const row = createQuotaRow([]);
  const render = (percentage: number, provider = "zai") =>
    createQuotaRow([mk(percentage)]).render(snap({ session: { ...(snap({}).session as SessionSnapshot), provider } }), 1)!;
  assert.deepEqual(render(69), [{ text: "zai-line", color: "accent" }]);
  assert.deepEqual(render(70), [{ text: "zai-line", color: "warning" }]);
  assert.deepEqual(render(90), [{ text: "zai-line", color: "error" }]);
  // Heat is reported but the line stays dim while the adapter is not the active provider.
  assert.deepEqual(render(90, "anthropic"), [{ text: "zai-line", color: "dim" }]);
});

test("quota row: null/NaN heat falls back to neutral muted", () => {
  const mk = (heat: () => number | null): ProviderRowAdapter<QuotaResult> => ({
    id: "zai", matches: (p) => p === "zai", current: () => QUOTA,
    fetch: async () => null, render: () => "zai-line", heat, start() {}, stop() {},
  });
  assert.deepEqual(createQuotaRow([mk(() => null)]).render(snap({}), 1), [{ text: "zai-line", color: "muted" }]);
  assert.deepEqual(createQuotaRow([mk(() => Number.NaN)]).render(snap({}), 1), [{ text: "zai-line", color: "muted" }]);
});

test("quota row: null when no adapter has data", () => {
  const zai: ProviderRowAdapter<QuotaResult> = {
    id: "zai", matches: (p) => p === "zai", current: () => null,
    fetch: async () => null, render: () => "zai", start() {}, stop() {},
  };
  assert.equal(createQuotaRow([zai]).render(snap({}), 2), null);
});
