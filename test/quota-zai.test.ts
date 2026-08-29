// test/quota-zai.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readZaiKey,
  parseQuotaResponse,
  createQuotaPoller,
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

const POLLER_FIXTURE: QuotaResult = {
  tier: "lite",
  fiveHour: { unit: 3, number: 5, usage: 2000, currentValue: 1501, remaining: 498, percentage: 75, nextResetTime: 1786539568992 },
  weekly: { unit: 6, number: 1, usage: 10000, currentValue: 1501, remaining: 8498, percentage: 15, nextResetTime: 1787126084998 },
  fetchedAt: 1_786_000_000_000,
};

test("poller: cache is null before first poll and set after refresh", async () => {
  const poller = createQuotaPoller({
    apiKey: "test",
    intervalMs: 60_000,
    fetchFn: async () => POLLER_FIXTURE,
  });
  assert.equal(poller.get(), null);
  await poller.refresh();
  assert.ok(poller.get());
  assert.equal(poller.get()!.fiveHour!.remaining, 498);
});

test("poller: throwing onRefresh does not reject refresh() and cache is still set", async () => {
  const poller = createQuotaPoller({
    apiKey: "test",
    intervalMs: 60_000,
    fetchFn: async () => POLLER_FIXTURE,
    onRefresh: () => { throw new Error("render gone"); },
  });
  await poller.refresh(); // must resolve, not reject
  assert.ok(poller.get());
  assert.equal(poller.get()!.fiveHour!.remaining, 498);
});
