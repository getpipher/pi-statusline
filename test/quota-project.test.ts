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
