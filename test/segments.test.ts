// test/segments.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { detectProvider, isZaiProvider } from "../src/provider.ts";
import { renderModelSegment } from "../src/segments/model.ts";
import { renderGitSegment } from "../src/segments/git.ts";
import { renderTokensSegment, formatTokenCount } from "../src/segments/tokens.ts";
import { renderContextSegment } from "../src/segments/context.ts";
import { renderQuotaSegment } from "../src/segments/quota.ts";
import type { QuotaResult } from "../src/quota/zai.ts";

test("detectProvider extracts prefixes but bare pi model ids have no provider", () => {
  assert.equal(detectProvider("zai/glm-5.2"), "zai");
  assert.equal(detectProvider("Ollama/glm-5.2:cloud"), "Ollama");
  assert.equal(detectProvider("anthropic/claude-sonnet-4"), "anthropic");
  assert.equal(detectProvider("glm-5.2"), "unknown");
});

test("isZaiProvider accepts pi's separate provider field", () => {
  assert.equal(isZaiProvider("zai"), true);
});

test("isZaiProvider rejects non-zai and missing providers", () => {
  assert.equal(isZaiProvider("Ollama"), false);
  assert.equal(isZaiProvider("anthropic"), false);
  assert.equal(isZaiProvider("openai-codex"), false);
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

test("formatTokenCount matches the quota k-format bands", () => {
  assert.equal(formatTokenCount(700), "700");
  assert.equal(formatTokenCount(1500), "1.5k");
  assert.equal(formatTokenCount(9999), "10.0k");
  assert.equal(formatTokenCount(15000), "15k");
  assert.equal(formatTokenCount(2500000), "2500k");
});

test("renderTokensSegment bands above 10k without a trailing .0", () => {
  const entries = [
    { type: "message", message: { role: "assistant", usage: { input: 15000, output: 900 } } },
  ];
  const result = renderTokensSegment(entries as any);
  assert.ok(result.includes("↑15k"), `input bands to rounded k: ${result}`);
  assert.ok(result.includes("↓900"), `output below 1k stays plain: ${result}`);
});

test("renderContextSegment uses pi's precomputed percent", () => {
  assert.equal(renderContextSegment({ tokens: 50000, contextWindow: 200000, percent: 24.6 }), "25%");
});

test("renderContextSegment derives percent when pi reports percent as null", () => {
  assert.equal(renderContextSegment({ tokens: 50000, contextWindow: 200000, percent: null }), "25%");
});

test("renderContextSegment omits unknown context usage", () => {
  assert.equal(renderContextSegment({ tokens: null, contextWindow: 200000, percent: null }), "");
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
