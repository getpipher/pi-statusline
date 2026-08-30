// test/deen-cache.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isDataFresh, isGeoFresh, loadDeenCache, saveDeenCache, type DeenCacheFile } from "../src/deen/cache.ts";

const DATA: DeenCacheFile["data"] = {
  prayers: { Fajr: "04:36", Dhuhr: "11:53", Asr: "15:11", Maghrib: "17:53", Isha: "19:03" },
  timezone: "Asia/Jakarta",
  hijri: "17 Rabīʿ al-awwal 1448",
};

test("save+load round-trips the cache file (mkdir -p dirname)", () => {
  const dir = mkdtempSync(join(tmpdir(), "deen-"));
  const path = join(dir, "nested", "deen-cache.json");
  const file: DeenCacheFile = { key: "Jakarta|Indonesia|auto|2026-08-30", fetchedAt: 1_000, data: DATA };
  saveDeenCache(path, file);
  assert.deepEqual(loadDeenCache(path), file);
  rmSync(dir, { recursive: true, force: true });
});

test("loadDeenCache returns null on missing or corrupt file", () => {
  const dir = mkdtempSync(join(tmpdir(), "deen-"));
  assert.equal(loadDeenCache(join(dir, "missing.json")), null);
  writeFileSync(join(dir, "bad.json"), "{nope");
  assert.equal(loadDeenCache(join(dir, "bad.json")), null);
  rmSync(dir, { recursive: true, force: true });
});

test("isDataFresh: key must match AND age < 24h", () => {
  const now = 10 * 86_400_000;
  const file: DeenCacheFile = { key: "k1", fetchedAt: now - 23 * 3_600_000, data: DATA };
  assert.equal(isDataFresh(file, "k1", now), true);
  assert.equal(isDataFresh(file, "k2", now), false); // different city/method/date
  const old: DeenCacheFile = { key: "k1", fetchedAt: now - 25 * 3_600_000, data: DATA };
  assert.equal(isDataFresh(old, "k1", now), false);
});

test("isGeoFresh: 7-day TTL; absent geo is never fresh", () => {
  const now = 100 * 86_400_000;
  const file: DeenCacheFile = { key: "k", fetchedAt: now, data: DATA, geo: { city: "Jakarta", country: "Indonesia", timezone: "Asia/Jakarta", fetchedAt: now - 6 * 86_400_000 } };
  assert.equal(isGeoFresh(file, now), true);
  const old: DeenCacheFile = { ...file, geo: { ...file.geo!, fetchedAt: now - 8 * 86_400_000 } };
  assert.equal(isGeoFresh(old, now), false);
  assert.equal(isGeoFresh({ key: "k", fetchedAt: now, data: DATA }, now), false);
});
