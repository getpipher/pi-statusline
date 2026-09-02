// test/format.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatSpan,
  formatTokenCount,
  formatTokensHuman,
  formatClock,
  renderBar,
  renderSparkline,
  formatReset,
  splitBar,
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

test("splitBar splits a 10-cell bar into an accent-fillable head and dim tail", () => {
  assert.deepEqual(splitBar(0), { filled: "▕", empty: "░░░░░░░░░░▏" });
  assert.deepEqual(splitBar(0.34), { filled: "▕███", empty: "░░░░░░░▏" }); // row prepends the leading space
  assert.deepEqual(splitBar(0.75), { filled: "▕████████", empty: "░░▏" });
  assert.deepEqual(splitBar(1), { filled: "▕██████████", empty: "▏" });
  assert.deepEqual(splitBar(1.5), { filled: "▕██████████", empty: "▏" });
  assert.deepEqual(splitBar(-1), { filled: "▕", empty: "░░░░░░░░░░▏" });
  assert.deepEqual(splitBar(Number.NaN), { filled: "▕", empty: "░░░░░░░░░░▏" });
});
