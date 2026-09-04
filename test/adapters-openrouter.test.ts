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
    providerTodayStats: () => ({ cost: today, top }),
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
