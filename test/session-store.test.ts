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

test("update captures thinking level from ctx.thinkingLevel (live getter, v0.4.7 fix)", () => {
  // REAL pi contract (0.84.4): ExtensionContext.thinkingLevel is a live getter property
  // (runner.js: get thinkingLevel() → runtime.getThinkingLevel()). The getThinkingLevel()
  // METHOD lives on ExtensionActions (pi.*), NOT on ctx — probing for it was the v0.4.6
  // bug that pinned the level at "off".
  const store = createSessionStore({ now: () => NOW, cwd: () => "/tmp/proj" });
  let level: string | undefined = "max";
  store.update(makeCtx({ get thinkingLevel() { return level; } }), null);
  assert.equal(store.getSnapshot().thinkingLevel, "max");
  // a later /thinking change re-reads on the next update (render loop calls update per render)
  level = "low";
  store.update(makeCtx({ get thinkingLevel() { return level; } }), null);
  assert.equal(store.getSnapshot().thinkingLevel, "low");
});

test("thinkingLevel defaults to \"off\" when the runtime omits the property", () => {
  const store = createSessionStore({ now: () => NOW, cwd: () => "/tmp/proj" });
  const ctx = makeCtx();
  delete (ctx as Record<string, unknown>).thinkingLevel;
  store.update(ctx, null);
  assert.equal(store.getSnapshot().thinkingLevel, "off");
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
