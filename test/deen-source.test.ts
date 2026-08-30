// test/deen-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeenSource, type DeenSourceConfig } from "../src/deen/source.ts";

const DATA = {
  prayers: { Fajr: "05:00", Dhuhr: "12:00", Asr: "15:30", Maghrib: "18:00", Isha: "19:30" },
  timezone: "UTC",
  hijri: "17 Rabīʿ al-awwal 1448",
};

const CFG: DeenSourceConfig = { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 };

// Fixed instant (10:00 UTC): Dhuhr 12:00 is +120 → escalation "calm", deterministic
// regardless of when the suite runs (the draft's real-clock version was flaky inside
// the 30min-before / 10min-after prayer windows).
const NOW = () => Date.UTC(2026, 7, 30, 10, 0);

function opts(over: Partial<Parameters<typeof createDeenSource>[0]> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "deen-src-"));
  return {
    base: { cachePath: join(dir, "deen-cache.json"), config: () => CFG, ...over },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("refresh fetches, caches and serves a snapshot; second refresh is cache-served", async () => {
  let calls = 0;
  // fetchPrayer (not fetchFn): the draft's fake returns DeenData, which is this seam's
  // contract — fetchFn is typed `typeof fetch` and would run the real fetchPrayerTimes's
  // res.ok on a plain object (null) and fail typecheck.
  const { base, cleanup } = opts({ now: NOW, fetchPrayer: async () => { calls += 1; return DATA; } });
  const src = createDeenSource(base);
  assert.equal(src.current(), null); // nothing before first refresh
  await src.refresh();
  assert.equal(calls, 1);
  const snap = src.current()!;
  assert.equal(snap.hijri, "17 Rabīʿ al-awwal 1448");
  assert.equal(snap.city, "Jakarta");
  assert.equal(snap.staleMinutes, null);
  assert.equal(snap.escalation, "calm");
  assert.ok(snap.schedule.length === 5);
  await src.refresh(); // fresh → no refetch
  assert.equal(calls, 1);
  cleanup();
});

test("force refresh bypasses the cache", async () => {
  let calls = 0;
  const { base, cleanup } = opts({ now: NOW, fetchPrayer: async () => { calls += 1; return DATA; } });
  const src = createDeenSource(base);
  await src.refresh();
  await src.refresh(true);
  assert.equal(calls, 2);
  cleanup();
});

test("fetch failure with no cache → current() null; with stale cache → served with staleMinutes", async () => {
  let failing = true;
  const { base, cleanup } = opts({ now: NOW, fetchPrayer: async () => (failing ? null : DATA) });
  const src = createDeenSource(base);
  await src.refresh();
  assert.equal(src.current(), null); // failed, nothing cached → row omitted

  failing = false;
  await src.refresh();
  assert.ok(src.current());
  failing = true;
  const before = (src.current()!).schedule[0]!.minutesUntil;
  await src.refresh(true); // force a failing fetch → stale served
  const stale = src.current()!;
  assert.deepEqual(stale.schedule[0]!.minutesUntil, before); // last-good data
  assert.ok(stale.staleMinutes !== null && stale.staleMinutes >= 0);
  cleanup();
});

test("city auto resolves via IP-geo (cached 7d); geo failure → row omitted", async () => {
  const geoCalls: number[] = [];
  // fetchGeo (not geoFetchFn): the draft's fake returns GeoInfo, which is this seam's
  // contract — geoFetchFn is typed `typeof fetch` and is passed INTO fetchGeo as fetchImpl.
  const { base, cleanup } = opts({
    now: NOW,
    config: () => ({ ...CFG, city: "auto" }),
    fetchGeo: async () => { geoCalls.push(1); return { city: "Jakarta", country: "Indonesia", timezone: "Asia/Jakarta", fetchedAt: NOW() }; },
    fetchPrayer: async () => DATA,
  });
  const src = createDeenSource(base);
  await src.refresh();
  assert.ok(src.current());
  assert.equal(src.geo()?.city, "Jakarta");
  await src.refresh();
  assert.equal(geoCalls.length, 1); // geo cached
  cleanup();

  const { base: base2, cleanup: cleanup2 } = opts({
    now: NOW,
    config: () => ({ ...CFG, city: "auto" }),
    fetchGeo: async () => null,
    fetchPrayer: async () => DATA,
  });
  const src2 = createDeenSource(base2);
  await src2.refresh();
  assert.equal(src2.current(), null); // no city resolvable → no fetch → row omitted
  cleanup2();
});
