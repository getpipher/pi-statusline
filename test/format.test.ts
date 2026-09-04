// test/format.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatSpan,
  formatTokenCount,
  formatTokensHuman,
  formatClock,
  formatReset,
} from "../src/format.ts";

test("formatTokenCount formats <1k plain and k-values with one decimal under 10k", () => {
  assert.equal(formatTokenCount(0), "0");
  assert.equal(formatTokenCount(999), "999");
  assert.equal(formatTokenCount(6200), "6.2k");
  assert.equal(formatTokenCount(48_000), "48k");
});

test("formatTokensHuman (CCS-exact): one decimal always for K/M, uppercase unit, plain below 1000", () => {
  assert.equal(formatTokensHuman(0), "0");
  assert.equal(formatTokensHuman(999), "999");
  assert.equal(formatTokensHuman(6200), "6.2K");
  assert.equal(formatTokensHuman(48_000), "48.0K");
  assert.equal(formatTokensHuman(200_000), "200.0K");
  assert.equal(formatTokensHuman(1_000_000), "1.0M");
  assert.equal(formatTokensHuman(2_340_000), "2.3M");
});

test("formatMoney always shows two decimals, no grouping", () => {
  assert.equal(formatMoney(0), "0.00");
  assert.equal(formatMoney(1.24), "1.24");
  assert.equal(formatMoney(118.75), "118.75");
  assert.equal(formatMoney(1234.5), "1234.50");
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

test("formatReset renders countdown buckets with unit spaces (v0.4.7 quota style)", () => {
  const now = 1_000_000_000_000;
  assert.equal(formatReset(now - 1, now), "now");
  assert.equal(formatReset(now + 2 * 3_600_000 + 55 * 60_000, now), "2h 55m");
  assert.equal(formatReset(now + 26 * 3_600_000, now), "1d 2h");
});
