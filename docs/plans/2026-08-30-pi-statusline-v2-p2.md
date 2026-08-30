# pi-statusline v2 Phase 2 (Deen Suite + CC Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the deen suite (aladhan-powered 5-prayer strip with hijri, city resolution, escalation) plus the first CC-parity additions (ledger repo attribution + all-time `REPO $` total, `/statusline deen` command) — released as v0.3.0.

**Architecture:** A `DeenSource` (async fetcher + 24h JSON cache + IP-geo fallback, mirroring the adapter pattern: fetch off render path, sync `current()` reads) feeds a priority-1 `deen` row rendering the full CC-style 5-prayer strip with an escalation state machine (pure function of `now` vs timetable). The ledger gains a `repo` field written at reconcile; the money row leads with an all-time `REPO $` total. All separators are ` | ` and all colors are theme tokens (v0.2.3 conventions).

**Tech Stack:** TypeScript (raw `.ts` via tsx, no build step), aladhan API v1 (`timingsByCity`), `ipwho.is` (keyless IP-geo), `Intl.DateTimeFormat` for timezone wall-clock math, node:test via `pnpm test:run`.

## Global Constraints

- Org spelling **getpipher** (two p's) — never getpither. No AI attribution anywhere. 2-space indent, TypeScript strict, MIT license.
- TDD mandatory: failing test first (RED), then implementation (GREEN). `pnpm test:run` + `pnpm typecheck` clean before every commit. One commit per task.
- Branch: all work on `feat/v2-p2-deen` (created from main in Task 1). Merge to main ONLY in Task 9, after the final whole-branch review.
- pi runtime ground truths (do NOT re-derive): session entries have `id: string` + ISO `timestamp`; `getEntries()` for totals; `setFooter` render returns `string[]`; timers MUST `.unref()`; render path NEVER awaits — fetches degrade to `null` (row omitted) or last-good cache with `· stale <n>m`; never throw into render.
- **aladhan API (live-verified 2026-08-30):** `GET https://api.aladhan.com/v1/timingsByCity?city=<city>&country=<country>[&method=<n>]` → 200 `{ code: 200, status: "OK", data: { timings: { Fajr: "04:36", Dhuhr: "11:53", Asr: "15:11", Maghrib: "17:53", Isha: "19:03", … }, meta: { timezone: "Asia/Jakarta" }, date: { hijri: { day: "17", month: { en: "Rabīʿ al-awwal" }, year: "1448" } } } }`. Timings are plain `"HH:MM"` (no suffix). Omitting `method` uses the aladhan default. Node `fetch` works (curl needs `-L`; irrelevant to us). 5s timeout on every call.
- **ipwho.is (live-verified):** `GET https://ipwho.is/` → `{ city: "Jakarta", country: "Indonesia", timezone: { id: "Asia/Jakarta" }, success: true }`. Keyless, HTTPS, free.
- **Countdown math:** prayer times are WALL-CLOCK minutes in the CITY timezone (`meta.timezone`). Never convert to epoch — compute "now wall minutes" in the same tz via `Intl.DateTimeFormat` (Node full-ICU) and diff same-day minutes. After Isha, next = tomorrow's Fajr: `minutesUntil = (1440 - nowWallMin) + fajrWallMin` using today's Fajr time.
- **Escalation state machine (spec §8, full-strip adaptation)** — pure function of `minutesUntilNext`:
  | minutesUntilNext | state | render effect |
  |---|---|---|
  | > 30 | `calm` | names dim, times text, countdown text, ✓ success |
  | ≤ 30 (>10) | `soon` | names → text (strip brightens) |
  | ≤ 10 (>2) | `near` | countdown + next prayer name → accent |
  | ≤ 2 (>0) | `imminent` | ENTIRE strip accent |
  | −10 < m ≤ 0 (just started) | `adhan` | started prayer name accent + `· adhan` marker after its time |
- **Deen cache:** single JSON file `~/.pi/agent/pi-statusline/deen-cache.json`: `{ key, fetchedAt, data, geo?: { city, country, timezone, fetchedAt } }`. Data valid 24h AND while `key` matches (key = `${city}|${country}|${method}|${local-YYYY-MM-DD}`). Geo entry valid 7d. Stale data served with `staleMinutes` on fetch failure.
- **Config v2.1:** `deen: { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 }`. `city: "auto"` (empty string) = IP-geo resolution. Back-compat: files without `deen` get defaults; unknown keys ignored.
- **All separators ` | `; colors are theme tokens only.** Existing fragments do not change colors in this phase except where stated.
- Ledger repo attribution: `repo` = cwd basename captured at reconcile via injected accessor; `parseLine` defaults missing repo to `"unknown"` (old lines stay, never fatal).
- Version/parity context: spec §15 addendum is the scope authority (P2 = deen suite + full strip + ledger repo + REPO total + `/statusline deen`; Est/burn-anchor/version-stamps/MCP/OR are **P3 — do not build them here**).
- Tag policy: `git -c tag.gpgSign=false tag -a vX -m …`. Release = tag push `v*` → release.yml. **Release steps are HELD until after the final whole-branch review** (controller runs them).

---

## File Structure

```
pi-statusline/
├─ src/
│  ├─ index.ts                  # MODIFY (Task 8) — DeenSource lifecycle, snapshot.deen, deen command
│  ├─ config.ts                 # MODIFY (Task 7) — deen section
│  ├─ types.ts                  # MODIFY (Task 5) — RowSnapshot.deen (via registry.ts), ColorToken unchanged
│  ├─ format.ts                 # KEEP
│  ├─ deen/
│  │  ├─ api.ts                 # CREATE (Task 1) — types, aladhan parser, fetcher
│  │  ├─ time.ts                # CREATE (Task 2) — tz wall-clock math, schedule, escalation state
│  │  ├─ cache.ts               # CREATE (Task 3) — 24h deen cache + 7d geo cache (single JSON file)
│  │  └─ source.ts              # CREATE (Task 4) — DeenSource orchestration (fresh/stale/geo/IP-geo)
│  ├─ ledger/store.ts           # MODIFY (Task 6) — repo field + repoCost
│  ├─ rows/deen.ts              # CREATE (Task 5) — full prayer strip row (priority 1)
│  ├─ rows/money.ts             # MODIFY (Task 6) — REPO total lead fragment
│  ├─ rows/registry.ts          # MODIFY (Task 5) — RowSnapshot.deen
│  ├─ tui/settings.ts           # MODIFY (Task 7) — deen <city|auto> action
│  └─ adapters/, ticker.ts, session/, format.ts, provider.ts(—deleted? no: already gone), quota/  # KEEP
├─ test/
│  ├─ deen-api.test.ts          # CREATE (Task 1)
│  ├─ deen-time.test.ts         # CREATE (Task 2)
│  ├─ deen-cache.test.ts        # CREATE (Task 3)
│  ├─ deen-source.test.ts       # CREATE (Task 4)
│  ├─ rows-deen.test.ts         # CREATE (Task 5)
│  ├─ ledger.test.ts            # MODIFY (Task 6)
│  ├─ rows.test.ts              # MODIFY (Task 6 — REPO fragment)
│  ├─ config.test.ts            # MODIFY (Task 7)
│  ├─ tui-settings.test.ts      # MODIFY (Task 7)
│  └─ index-wiring.test.ts      # MODIFY (Task 8)
└─ README.md                    # MODIFY (Task 9)
```

---

### Task 1: Deen types + aladhan parser + fetcher

**Files:**
- Create: `src/deen/api.ts`
- Test: `test/deen-api.test.ts`

**Interfaces:**
- Produces: `PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"`; `PrayerTimes = Record<PrayerName, string>` (`"HH:MM"`); `DeenData { prayers: PrayerTimes; timezone: string; hijri: string }`; `parseTimingsResponse(body: string): DeenData | null`; `fetchPrayerTimes(opts: { city: string; country: string; method: string; fetchImpl?: typeof fetch }): Promise<DeenData | null>`. Tasks 3–5 consume these exact names.

- [ ] **Step 1: Write the failing test `test/deen-api.test.ts`**

The fixture is the LIVE-verified response shape (2026-08-30, Jakarta). Store it as a string constant.

```ts
// test/deen-api.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimingsResponse } from "../src/deen/api.ts";

const FIXTURE = JSON.stringify({
  code: 200,
  status: "OK",
  data: {
    timings: {
      Fajr: "04:36", Sunrise: "05:54", Dhuhr: "11:53", Asr: "15:11",
      Sunset: "17:53", Maghrib: "17:53", Isha: "19:03", Imsak: "04:26",
      Midnight: "23:53", Firstthird: "22:23", Lastthird: "01:23",
    },
    date: {
      readable: "30 Aug 2026",
      timestamp: "1786622400",
      gregorian: { date: "30-08-2026" },
      hijri: {
        date: "17-02-1448", day: "17",
        month: { number: 2, en: "Rabīʿ al-awwal", ar: "رَبيع الأوّل" },
        year: "1448",
      },
    },
    meta: { latitude: -6.2, longitude: 106.8, timezone: "Asia/Jakarta" },
  },
});

test("parseTimingsResponse extracts the five prayers, timezone and hijri", () => {
  const data = parseTimingsResponse(FIXTURE);
  assert.deepEqual(data, {
    prayers: { Fajr: "04:36", Dhuhr: "11:53", Asr: "15:11", Maghrib: "17:53", Isha: "19:03" },
    timezone: "Asia/Jakarta",
    hijri: "17 Rabīʿ al-awwal 1448",
  });
});

test("parseTimingsResponse returns null on bad JSON, wrong code, or missing fields", () => {
  assert.equal(parseTimingsResponse("not-json"), null);
  assert.equal(parseTimingsResponse(JSON.stringify({ code: 404, status: "KO" })), null);
  assert.equal(parseTimingsResponse(JSON.stringify({ code: 200, status: "OK", data: { timings: {} } })), null);
  const noTz = JSON.parse(FIXTURE) as { data: { meta: unknown } };
  delete noTz.data.meta;
  assert.equal(parseTimingsResponse(JSON.stringify(noTz)), null);
  const badTime = JSON.parse(FIXTURE) as { data: { timings: Record<string, string> } };
  badTime.data.timings.Dhuhr = "113X"; // malformed wall time
  assert.equal(parseTimingsResponse(JSON.stringify(badTime)), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/deen/api.ts'`

- [ ] **Step 3: Write `src/deen/api.ts`**

```ts
// src/deen/api.ts
const ALADHAN_URL = "https://api.aladhan.com/v1/timingsByCity";

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerTimes = Record<PrayerName, string>; // "HH:MM" wall clock in the city tz

export interface DeenData {
  prayers: PrayerTimes;
  timezone: string; // IANA name from aladhan meta (e.g. "Asia/Jakarta")
  hijri: string;    // "17 Rabīʿ al-awwal 1448"
}

const PRAYER_NAMES: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimingsResponse(body: string): DeenData | null {
  let parsed: { code?: unknown; status?: unknown; data?: any };
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed?.code !== 200 || parsed?.status !== "OK" || !parsed.data) return null;

  const timings = parsed.data.timings as Record<string, unknown> | undefined;
  const timezone = (parsed.data.meta as { timezone?: unknown } | undefined)?.timezone;
  const hijri = (parsed.data.date as { hijri?: any } | undefined)?.hijri;
  if (!timings || typeof timezone !== "string" || !hijri) return null;

  const prayers = {} as PrayerTimes;
  for (const name of PRAYER_NAMES) {
    const value = timings[name];
    if (typeof value !== "string" || !WALL_TIME.test(value)) return null;
    prayers[name] = value;
  }

  const { day, year } = hijri;
  const monthEn = hijri.month?.en;
  if (typeof day !== "string" || typeof year !== "string" || typeof monthEn !== "string") return null;

  return { prayers, timezone, hijri: `${day} ${monthEn} ${year}` };
}

export interface FetchOpts {
  city: string;
  country: string;
  method: string; // "auto" → param omitted (aladhan default)
  fetchImpl?: typeof fetch;
}

export async function fetchPrayerTimes(opts: FetchOpts): Promise<DeenData | null> {
  const params = new URLSearchParams({ city: opts.city, country: opts.country });
  if (opts.method !== "auto") params.set("method", opts.method);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${ALADHAN_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return parseTimingsResponse(await res.text());
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/v2-p2-deen
git add src/deen/api.ts test/deen-api.test.ts
git commit -m "feat: deen API — aladhan timingsByCity parser and fetcher"
```

---

### Task 2: Timezone wall-clock math, schedule, escalation state

**Files:**
- Create: `src/deen/time.ts`
- Test: `test/deen-time.test.ts`

**Interfaces:**
- Consumes: `PrayerTimes`, `PrayerName` (Task 1).
- Produces: `wallMinutes(now: number, timezone: string): number` (0–1439); `PrayerScheduleEntry { name: PrayerName; wallMin: number; minutesUntil: number; state: "past" | "adhan" | "next" | "upcoming" }`; `computeSchedule(prayers: PrayerTimes, now: number, timezone: string): PrayerScheduleEntry[]`; `escalationState(minutesUntilNext: number, escalateMinutes: number): "calm" | "soon" | "near" | "imminent" | "adhan"`. Tasks 4–5 consume these.

- [ ] **Step 1: Write the failing test `test/deen-time.test.ts`**

All tests use `timezone: "UTC"` with hand-built wall times → TZ-deterministic in any runner.

```ts
// test/deen-time.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSchedule, escalationState, wallMinutes } from "../src/deen/time.ts";
import type { PrayerTimes } from "../src/deen/api.ts";

const PRAYERS: PrayerTimes = { Fajr: "05:00", Dhuhr: "12:00", Asr: "15:30", Maghrib: "18:00", Isha: "19:30" };

// 2026-08-30T10:00:00Z → 10:00 wall in UTC
const NOON_UTC = Date.UTC(2026, 7, 30, 10, 0);

test("wallMinutes returns minutes since midnight in the given timezone", () => {
  assert.equal(wallMinutes(Date.UTC(2026, 7, 30, 10, 0), "UTC"), 600);
  // Jakarta is UTC+7: the same instant is 17:00 wall → 1020
  assert.equal(wallMinutes(Date.UTC(2026, 7, 30, 10, 0), "Asia/Jakarta"), 1020);
});

test("computeSchedule marks past/next/upcoming with minutes-until", () => {
  const schedule = computeSchedule(PRAYERS, NOON_UTC, "UTC"); // 10:00 wall
  assert.deepEqual(schedule.map((e) => e.name), ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  assert.equal(schedule[0]!.state, "past"); // Fajr 05:00 gone
  assert.equal(schedule[1]!.state, "adhan"); // Dhuhr 12:00 is 60m away — NOT adhan; see next test
});
```

> **Careful — write the assertions to match the CONTRACT, not this draft:** at 10:00 wall, Dhuhr (12:00) is `upcoming` AND `next` (`minutesUntil` 120); Fajr is `past`. There is no `adhan` at 10:00. Fix this test before running: `schedule[1]!.state === "upcoming"`, `schedule[1]!.minutesUntil === 120`, and `schedule.find(e => e.state === "next")?.name === "Dhuhr"`. The `adhan` state belongs ONLY to prayers whose `minutesUntil` is in `(-10, 0]` (just started).

Continue the test file:

```ts
test("computeSchedule: next is first upcoming; just-started prayer is adhan; all-past → Fajr tomorrow", () => {
  // 12:00:30 wall → Dhuhr started 30s ago → state "adhan", minutesUntil -0.5 → -1 (floor)
  const atDhuhr = computeSchedule(PRAYERS, Date.UTC(2026, 7, 30, 12, 0, 30), "UTC");
  assert.equal(atDhuhr.find((e) => e.name === "Dhuhr")!.state, "adhan");
  assert.equal(atDhuhr.find((e) => e.name === "Dhuhr")!.minutesUntil, -1);

  // 20:00 wall → all past; next = tomorrow's Fajr: (1440 - 1200) + 300 = 540
  const afterIsha = computeSchedule(PRAYERS, Date.UTC(2026, 7, 30, 20, 0), "UTC");
  const next = afterIsha.find((e) => e.state === "next")!;
  assert.equal(next.name, "Fajr");
  assert.equal(next.minutesUntil, 540);
  assert.ok(afterIsha.every((e) => e.name !== "Fajr" || e.state === "past" || e.state === "next"));
});

test("computeSchedule: minutesUntil floors to whole minutes", () => {
  // 09:59:30 → Dhuhr at 12:00 is 120.5 min away → 120
  const sched = computeSchedule(PRAYERS, Date.UTC(2026, 7, 30, 9, 59, 30), "UTC");
  assert.equal(sched.find((e) => e.name === "Dhuhr")!.minutesUntil, 120);
});

test("escalationState boundaries: calm > 30, soon ≤ 30, near ≤ 10, imminent ≤ 2, adhan ≤ 0 > -10", () => {
  assert.equal(escalationState(31, 30), "calm");
  assert.equal(escalationState(30, 30), "soon");
  assert.equal(escalationState(11, 30), "soon");
  assert.equal(escalationState(10, 30), "near");
  assert.equal(escalationState(3, 30), "near");
  assert.equal(escalationState(2, 30), "imminent");
  assert.equal(escalationState(1, 30), "imminent");
  assert.equal(escalationState(0, 30), "adhan");
  assert.equal(escalationState(-9, 30), "adhan");
  // −10 is past the adhan window: the prayer is simply done → next prayer governs
  assert.equal(escalationState(-10, 30), "calm");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/deen/time.ts'`

- [ ] **Step 3: Write `src/deen/time.ts`**

```ts
// src/deen/time.ts
import type { PrayerName, PrayerTimes } from "./api.ts";

// Minutes since local midnight in `timezone` (IANA name via Intl; Node full-ICU).
export function wallMinutes(now: number, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const [h, m] = fmt.format(new Date(now)).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// Ordinal within the day: Fajr → Isha.
const ORDER: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export interface PrayerScheduleEntry {
  name: PrayerName;
  wallMin: number;
  minutesUntil: number; // floor; negative = started (within adhan window when > -10)
  state: "past" | "adhan" | "next" | "upcoming";
}

export function parseWallMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function computeSchedule(prayers: PrayerTimes, now: number, timezone: string): PrayerScheduleEntry[] {
  const nowMin = wallMinutes(now, timezone);
  const entries = ORDER.map((name) => ({ name, wallMin: parseWallMin(prayers[name]) }));

  const withUntil = entries.map((e) => ({ ...e, minutesUntil: e.wallMin - nowMin }));
  // First prayer strictly in the future; after Isha, Fajr "tomorrow" wins.
  const next = withUntil.find((e) => e.minutesUntil > 0)
    ?? { ...withUntil[0]!, minutesUntil: withUntil[0]!.wallMin - nowMin + 1440 };

  return withUntil.map((e) => {
    let state: PrayerScheduleEntry["state"];
    if (e.minutesUntil <= 0 && e.minutesUntil > -10) state = "adhan";
    else if (e.minutesUntil <= 0) state = "past";
    else if (e === next) state = "next";
    else state = "upcoming";
    return { name: e.name, wallMin: e.wallMin, minutesUntil: e.minutesUntil, state };
  });
}

export type EscalationState = "calm" | "soon" | "near" | "imminent" | "adhan";

// Pure function of minutesUntilNext (spec §8 bands, escalateMinutes configurable).
export function escalationState(minutesUntilNext: number, escalateMinutes: number): EscalationState {
  if (minutesUntilNext <= 0 && minutesUntilNext > -10) return "adhan";
  if (minutesUntilNext <= -10) return "calm"; // prayer done; next countdown governs
  if (minutesUntilNext <= 2) return "imminent";
  if (minutesUntilNext <= 10) return "near";
  if (minutesUntilNext <= escalateMinutes) return "soon";
  return "calm";
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean. NOTE: `wallMinutes(…, "Asia/Jakarta")` uses Intl — if the runner ICU lacks the zone it throws; Node 20+ ships full-ICU (safe).

- [ ] **Step 5: Commit**

```bash
git add src/deen/time.ts test/deen-time.test.ts
git commit -m "feat: deen time math — tz wall clock, schedule, escalation bands"
```

---

### Task 3: Deen cache (24h data + 7d geo, single JSON file)

**Files:**
- Create: `src/deen/cache.ts`
- Test: `test/deen-cache.test.ts`

**Interfaces:**
- Consumes: `DeenData` (Task 1).
- Produces: `GeoInfo { city: string; country: string; timezone: string; fetchedAt: number }`; `DeenCacheFile { key: string; fetchedAt: number; data: DeenData; geo?: GeoInfo }`; `loadDeenCache(path): DeenCacheFile | null` (null on missing/corrupt); `saveDeenCache(path, file: DeenCacheFile): void` (mkdir -p dirname); `isDataFresh(file, key, now): boolean` (key match AND `now - fetchedAt < 86_400_000`); `isGeoFresh(file, now): boolean` (`now - geo.fetchedAt < 7 × 86_400_000`). Task 4 consumes these.

- [ ] **Step 1: Write the failing test `test/deen-cache.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/deen/cache.ts'`

- [ ] **Step 3: Write `src/deen/cache.ts`**

```ts
// src/deen/cache.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DeenData } from "./api.ts";

export interface GeoInfo {
  city: string;
  country: string;
  timezone: string;
  fetchedAt: number;
}

export interface DeenCacheFile {
  key: string; // `${city}|${country}|${method}|${local-YYYY-MM-DD}`
  fetchedAt: number;
  data: DeenData;
  geo?: GeoInfo;
}

const DAY_MS = 86_400_000;
const GEO_TTL_MS = 7 * DAY_MS;

export function loadDeenCache(path: string): DeenCacheFile | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DeenCacheFile;
    if (!parsed || typeof parsed.key !== "string" || !parsed.data) return null;
    return parsed;
  } catch {
    return null; // corrupt cache = cold start, never fatal
  }
}

export function saveDeenCache(path: string, file: DeenCacheFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file)}\n`, "utf8");
}

export function isDataFresh(file: DeenCacheFile, key: string, now: number): boolean {
  return file.key === key && now - file.fetchedAt < DAY_MS;
}

export function isGeoFresh(file: DeenCacheFile, now: number): boolean {
  return file.geo !== undefined && now - file.geo.fetchedAt < GEO_TTL_MS;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/deen/cache.ts test/deen-cache.test.ts
git commit -m "feat: deen cache — 24h data + 7d geo in a single JSON file"
```

---

### Task 4: DeenSource — fetch orchestration (fresh/stale/IP-geo fallback)

**Files:**
- Create: `src/deen/source.ts`
- Test: `test/deen-source.test.ts`

**Interfaces:**
- Consumes: `DeenData`, `fetchPrayerTimes` (Task 1); `computeSchedule`, `wallMinutes` (Task 2); cache fns (Task 3); `StatuslineConfig` (existing — Task 7 adds `deen`; this task reads `config().deen` via a getter that the wiring passes, defaulting to the deen defaults so Task 4 is self-contained BEFORE config lands: `deenConfig(): { city: string; country: string; method: string; escalateMinutes: number }`).
- Produces: `DeenSnapshot { schedule: PrayerScheduleEntry[]; escalation: EscalationState; hijri: string; city: string; timezone: string; staleMinutes: number | null }`; `DeenSource { current(): DeenSnapshot | null; refresh(force?: boolean): Promise<void>; geo(): GeoInfo | null }`; `createDeenSource(opts: { cachePath: string; config: () => DeenSourceConfig; now?: () => number; fetchFn?: FetchOpts["fetchImpl"]; geoFetchFn?: typeof fetch; fetchPrayer?: typeof fetchPrayerTimes; fetchGeo?: (fetchImpl?: typeof fetch) => Promise<GeoInfo | null> }): DeenSource`. Tasks 5 (snapshot type) and 8 (wiring) consume these.

- [ ] **Step 1: Write the failing test `test/deen-source.test.ts`**

```ts
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

function opts(over: Partial<Parameters<typeof createDeenSource>[0]> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "deen-src-"));
  return {
    base: { cachePath: join(dir, "deen-cache.json"), config: () => CFG, ...over },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("refresh fetches, caches and serves a snapshot; second refresh is cache-served", async () => {
  let calls = 0;
  const { base, cleanup } = opts({ fetchFn: async () => { calls += 1; return DATA; } });
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
  const { base, cleanup } = opts({ fetchFn: async () => { calls += 1; return DATA; } });
  const src = createDeenSource(base);
  await src.refresh();
  await src.refresh(true);
  assert.equal(calls, 2);
  cleanup();
});

test("fetch failure with no cache → current() null; with stale cache → served with staleMinutes", async () => {
  let failing = true;
  const { base, cleanup } = opts({
    fetchFn: async () => (failing ? null : DATA),
  });
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
  const { base, cleanup } = opts({
    config: () => ({ ...CFG, city: "auto" }),
    geoFetchFn: async () => { geoCalls.push(1); return { city: "Jakarta", country: "Indonesia", timezone: "Asia/Jakarta", fetchedAt: Date.now() }; },
    fetchFn: async () => DATA,
  });
  const src = createDeenSource(base);
  await src.refresh();
  assert.ok(src.current());
  assert.equal(src.geo()?.city, "Jakarta");
  await src.refresh();
  assert.equal(geoCalls.length, 1); // geo cached
  cleanup();

  const { base: base2, cleanup: cleanup2 } = opts({
    config: () => ({ ...CFG, city: "auto" }),
    geoFetchFn: async () => null,
    fetchFn: async () => DATA,
  });
  const src2 = createDeenSource(base2);
  await src2.refresh();
  assert.equal(src2.current(), null); // no city resolvable → no fetch → row omitted
  cleanup2();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:run 2>&1 | tail -5`
Expected: FAIL — `Cannot find module '../src/deen/source.ts'`

- [ ] **Step 3: Write `src/deen/source.ts`**

```ts
// src/deen/source.ts
import { fetchPrayerTimes, type DeenData, type FetchOpts } from "./api.ts";
import { computeSchedule, escalationState, type EscalationState, type PrayerScheduleEntry } from "./time.ts";
import { isDataFresh, isGeoFresh, loadDeenCache, saveDeenCache, type DeenCacheFile, type GeoInfo } from "./cache.ts";

export interface DeenSourceConfig {
  city: string;           // "auto" → IP-geo resolution
  country: string;
  method: string;         // "auto" → aladhan default
  escalateMinutes: number;
}

export interface DeenSnapshot {
  schedule: PrayerScheduleEntry[];
  escalation: EscalationState;
  hijri: string;
  city: string;
  timezone: string;
  staleMinutes: number | null; // null = fresh
}

export interface DeenSource {
  current(): DeenSnapshot | null;
  refresh(force?: boolean): Promise<void>;
  geo(): GeoInfo | null;
}

const GEO_URL = "https://ipwho.is/";

async function defaultFetchGeo(fetchImpl?: typeof fetch): Promise<GeoInfo | null> {
  try {
    const res = await (fetchImpl ?? fetch)(GEO_URL, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { success?: boolean; city?: unknown; country?: unknown; timezone?: { id?: unknown } };
    if (j?.success !== true || typeof j.city !== "string" || typeof j.country !== "string") return null;
    const tz = j.timezone?.id;
    if (typeof tz !== "string") return null;
    return { city: j.city, country: j.country, timezone: tz, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

// Local YYYY-MM-DD for the cache key (city-date ambiguity is acceptable: the key's
// purpose is daily refetch, and wall-clock math happens in the city tz at render).
function localDateKey(now: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

export interface DeenSourceOpts {
  cachePath: string;
  config: () => DeenSourceConfig;
  now?: () => number;
  fetchFn?: FetchOpts["fetchImpl"];
  geoFetchFn?: typeof fetch;
  fetchPrayer?: typeof fetchPrayerTimes;
  fetchGeo?: (fetchImpl?: typeof fetch) => Promise<GeoInfo | null>;
}

export function createDeenSource(opts: DeenSourceOpts): DeenSource {
  const now = opts.now ?? Date.now;
  const fetchPrayer = opts.fetchPrayer ?? fetchPrayerTimes;
  const fetchGeo = opts.fetchGeo ?? defaultFetchGeo;
  let snapshot: DeenSnapshot | null = null;
  let lastKey = "";
  let lastFetchedAt = 0;
  let geo: GeoInfo | null = null;

  function toSnapshot(data: DeenData, city: string, staleMinutes: number | null, cfg: DeenSourceConfig): DeenSnapshot {
    const schedule = computeSchedule(data.prayers, now(), data.timezone);
    const minutesUntilNext = schedule.find((e) => e.state === "next" || e.state === "adhan")?.minutesUntil ?? 0;
    return {
      schedule,
      escalation: escalationState(minutesUntilNext, cfg.escalateMinutes),
      hijri: data.hijri,
      city,
      timezone: data.timezone,
      staleMinutes,
    };
  }

  return {
    current: () => snapshot,
    geo: () => geo,

    async refresh(force = false): Promise<void> {
      const cfg = opts.config();
      const nowMs = now();
      const cached = loadDeenCache(opts.cachePath);

      // Geo: config city wins; "auto" resolves via IP (7d cache, then refetch).
      let city = cfg.city;
      let country = cfg.country;
      let timezone: string | null = null;
      if (city === "auto") {
        if (cached && isGeoFresh(cached, nowMs)) {
          geo = cached.geo!;
        } else {
          geo = await fetchGeo(opts.geoFetchFn);
        }
        if (!geo) { snapshot = null; return; }
        city = geo.city;
        country = geo.country;
        timezone = geo.timezone;
      }

      // Fetch timezones once for the date key when the city is explicit.
      const keyTz = timezone ?? cached?.data.timezone ?? "UTC";
      const key = `${city}|${country}|${cfg.method}|${localDateKey(nowMs, keyTz)}`;

      if (!force && cached && isDataFresh(cached, key, nowMs)) {
        snapshot = toSnapshot(cached.data, city, null, cfg);
        lastKey = key;
        lastFetchedAt = cached.fetchedAt;
        return;
      }

      const data = await fetchPrayer({ city, country, method: cfg.method, fetchImpl: opts.fetchFn });
      if (data) {
        const file: DeenCacheFile = { key, fetchedAt: nowMs, data, ...(geo ? { geo } : cached?.geo ? { geo: cached.geo } : {}) };
        saveDeenCache(opts.cachePath, file);
        lastKey = key;
        lastFetchedAt = nowMs;
        snapshot = toSnapshot(data, city, null, cfg);
        return;
      }

      // Fetch failed: serve last-good (memory first, then stale file) with a stale marker.
      if (lastKey === key && snapshot) {
        snapshot = { ...snapshot, staleMinutes: Math.floor((nowMs - lastFetchedAt) / 60_000) };
        return;
      }
      if (cached && cached.data.timezone === keyTz) {
        snapshot = toSnapshot(cached.data, city, Math.floor((nowMs - cached.fetchedAt) / 60_000), cfg);
        return;
      }
      snapshot = null;
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/deen/source.ts test/deen-source.test.ts
git commit -m "feat: DeenSource — cache-first fetch with stale fallback and IP-geo resolution"
```

---

### Task 5: Deen row — full 5-prayer strip with escalation

**Files:**
- Create: `src/rows/deen.ts`
- Modify: `src/rows/registry.ts` (RowSnapshot gains `deen: DeenSnapshot | null`)
- Modify: `test/rows-registry.test.ts` (fixture gains `deen: null` — one line)
- Test: `test/rows-deen.test.ts`

**Interfaces:**
- Consumes: `DeenSnapshot` (Task 4); `Row`, `RowSnapshot` (existing).
- Produces: `createDeenRow(): Row` (priority 1, id "deen"). Task 8 wires it.
- RowSnapshot change: add `deen: DeenSnapshot | null` — ALL existing `snap()`/`makeSnapshot()` fixtures in `test/rows-registry.test.ts`, `test/rows.test.ts`, `test/adapters-zai.test.ts` gain `deen: null` (mechanical, include in this task).

**Render contract (exact fragments, `esc` = snapshot.deen.escalation):**

- Label `deen` always first, dim.
- Per prayer (in Fajr→Isha order): name fragment, time fragment, then `✓` fragment iff past.
  - `calm`: name dim, time text, ✓ success
  - `soon`: name text, time text, ✓ success
  - `near`: name text, time text (next prayer's name accent), countdown accent, ✓ success
  - `imminent`: everything accent (names, times, ✓, countdown)
  - `adhan`: started prayer's name accent + `· adhan` dim marker after its time; other fragments as calm
- Next prayer (state "next" or "adhan"): time followed by countdown fragment ` (Xh Ym)` (accent in near/adhan-imminent contexts per above, else text).
- `upcoming` prayers: name dim (calm) / text (soon+), time text.
- Hijri fragment: ` | ${hijri}` muted. City fragment: ` | ${city}` muted. Stale: ` | stale ${n}m` warning, only when `staleMinutes !== null`.
- Separator between prayer blocks: ` | ` dim. Between fragments inside a block: single spaces.
- Countdown format: `(Xh Ym)` — hours omitted under 1h → `(45m)`; minutes omitted at exactly whole hours → `(2h 0m)` stays `(2h)`; `0m` → `(0m)`.

- [ ] **Step 1: Write the failing test `test/rows-deen.test.ts`**

```ts
// test/rows-deen.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { DeenSnapshot } from "../src/deen/source.ts";
import type { PrayerScheduleEntry } from "../src/deen/time.ts";
import type { RowSnapshot } from "../src/rows/registry.ts";
import { createDeenRow } from "../src/rows/deen.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

const WALL: Record<string, number> = { Fajr: 300, Dhuhr: 720, Asr: 930, Maghrib: 1080, Isha: 1170 }; // 05:00…19:30
function sched(entries: Array<[PrayerScheduleEntry["name"], number, PrayerScheduleEntry["state"]]>): PrayerScheduleEntry[] {
  return entries.map(([name, minutesUntil, state]) => ({ name, wallMin: WALL[name], minutesUntil, state }));
}

function deen(partial: Partial<DeenSnapshot>): DeenSnapshot {
  return {
    schedule: sched([
      ["Fajr", -300, "past"], ["Dhuhr", 120, "next"], ["Asr", 320, "upcoming"],
      ["Maghrib", 500, "upcoming"], ["Isha", 660, "upcoming"],
    ]),
    escalation: "calm",
    hijri: "17 Rabīʿ al-awwal 1448",
    city: "Jakarta",
    timezone: "Asia/Jakarta",
    staleMinutes: null,
    ...partial,
  };
}

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: 0, width: 500,
    session: null as never, ledger: null as never,
    statuses: "", config: DEFAULT_CONFIG,
    deen: null,
    ...partial,
  };
}

function plain(frags: ReturnType<ReturnType<typeof createDeenRow>["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("deen row: calm strip — past ✓, next countdown, hijri + city", () => {
  const frags = createDeenRow().render(snap({ deen: deen({}) }))!;
  assert.deepEqual(frags, [
    { text: "deen", color: "dim" },
    { text: " Fajr", color: "dim" }, { text: " 05:00", color: "text" }, { text: " ✓", color: "success" },
    { text: " | Dhuhr", color: "dim" }, { text: " 12:00", color: "text" }, { text: " (2h)", color: "text" },
    { text: " | Asr", color: "dim" }, { text: " 15:30", color: "text" },
    { text: " | Maghrib", color: "dim" }, { text: " 18:00", color: "text" },
    { text: " | Isha", color: "dim" }, { text: " 19:30", color: "text" },
    { text: " | 17 Rabīʿ al-awwal 1448", color: "muted" },
    { text: " | Jakarta", color: "muted" },
  ]);
});

test("deen row: countdown format — (45m) under an hour, (2h) whole hours", () => {
  const soon = deen({ schedule: sched([
    ["Fajr", -300, "past"], ["Dhuhr", 45, "next"], ["Asr", 245, "upcoming"],
    ["Maghrib", 425, "upcoming"], ["Isha", 585, "upcoming"],
  ]) });
  assert.ok(plain(createDeenRow().render(snap({ deen: soon }))).includes(" (45m)"));
  const whole = deen({ schedule: sched([
    ["Fajr", -300, "past"], ["Dhuhr", 120, "next"], ["Asr", 320, "upcoming"],
    ["Maghrib", 500, "upcoming"], ["Isha", 660, "upcoming"],
  ]) });
  assert.ok(plain(createDeenRow().render(snap({ deen: whole }))).includes(" (2h)"));
});
```

Continue:

```ts
test("deen row: escalation colors — soon brightens names, near accents countdown+next name, imminent all accent", () => {
  const row = createDeenRow();
  const soon = row.render(snap({ deen: deen({ escalation: "soon" }) }))!;
  assert.equal(soon[1]!.color, "text"); // Fajr name brightened from dim
  const near = row.render(snap({ deen: deen({ escalation: "near" }) }))!;
  const nearText = near.find((f) => f.text === " (2h)")!;
  assert.equal(nearText.color, "accent");
  assert.equal(near.find((f) => f.text === " Dhuhr")!.color, "accent");
  const imminent = row.render(snap({ deen: deen({ escalation: "imminent" }) }))!;
  assert.ok(imminent.every((f) => f.color === "accent"));
});

test("deen row: adhan — started prayer name accent with · adhan marker", () => {
  const adhan = deen({
    escalation: "adhan",
    schedule: sched([
      ["Fajr", -300, "past"], ["Dhuhr", -2, "adhan"], ["Asr", 200, "upcoming"],
      ["Maghrib", 380, "upcoming"], ["Isha", 540, "upcoming"],
    ]),
  });
  const frags = createDeenRow().render(snap({ deen: adhan }))!;
  const text = plain(frags);
  assert.ok(text.includes("Dhuhr 12:00 · adhan"));
  const dhuhrName = frags.find((f) => f.text === " Dhuhr")!;
  assert.equal(dhuhrName.color, "accent");
});

test("deen row: stale marker (warning) appended; row omitted when deen is null", () => {
  const stale = createDeenRow().render(snap({ deen: deen({ staleMinutes: 4 }) }));
  assert.ok(plain(stale).includes(" | stale 4m"));
  assert.equal(stale!.find((f) => f.text === " | stale 4m")!.color, "warning");
  assert.equal(createDeenRow().render(snap({})), null);
});
```

- [ ] **Step 2: Modify `src/rows/registry.ts` (snapshot type) + fixture one-liners**

```ts
// src/rows/registry.ts — RowSnapshot gains:
import type { DeenSnapshot } from "../deen/source.ts";
export interface RowSnapshot {
  now: number;
  width: number;
  session: SessionSnapshot;
  ledger: LedgerSnapshot;
  statuses: string;
  config: StatuslineConfig;
  deen: DeenSnapshot | null;   // P2 — null until DeenSource provides data (row omitted)
  order?: RowId[];
}
```

Then add `deen: null,` to every fixture builder: `makeSnapshot` in `test/rows-registry.test.ts`, `snap` in `test/rows.test.ts` + `test/adapters-zai.test.ts` (the adapters one builds the snapshot inline — add the field).

- [ ] **Step 3: Run the test to verify it fails, then write `src/rows/deen.ts`**

Run first (FAIL — module missing), then:

```ts
// src/rows/deen.ts
import type { DeenSnapshot } from "../deen/source.ts";
import type { PrayerScheduleEntry } from "../deen/time.ts";
import type { ColorToken, Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

function countdown(minutesUntil: number): string {
  const m = Math.max(0, minutesUntil);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `(${min}m)`;
  if (min === 0) return `(${h}h)`;
  return `(${h}h ${min}m)`;
}

function prayerBlock(entry: PrayerScheduleEntry, esc: DeenSnapshot["escalation"]): Fragment[] {
  const nameColor: ColorToken =
    esc === "imminent" ? "accent"
    : esc === "soon" || esc === "near" ? "text"
    : entry.state === "adhan" ? "accent"
    : "dim";
  const timeColor: ColorToken = esc === "imminent" ? "accent" : "text";
  const block: Fragment[] = [
    { text: ` ${entry.name}`, color: nameColor },
    { text: ` ${String(Math.floor(entry.wallMin / 60)).padStart(2, "0")}:${String(entry.wallMin % 60).padStart(2, "0")}`, color: timeColor },
  ];
  if (entry.state === "adhan") {
    block.push({ text: " · adhan", color: "dim" });
    if (entry.minutesUntil >= -2) block.push({ text: ` ${countdown(0)}`, color: "accent" });
  }
  if (entry.state === "past") block.push({ text: " ✓", color: "success" });
  if (entry.state === "next") {
    block.push({ text: ` ${countdown(entry.minutesUntil)}`, color: esc === "near" || esc === "imminent" ? "accent" : "text" });
  }
  return block;
}

export function createDeenRow(): Row {
  return {
    id: "deen",
    priority: 1,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const d = snapshot.deen;
      if (!d) return null;
      const esc = d.escalation;
      const frags: Fragment[] = [{ text: "deen", color: "dim" }];
      for (const entry of d.schedule) {
        frags.push({ text: " |", color: "dim" });
        frags.push(...prayerBlock(entry, esc));
      }
      frags.push({ text: ` | ${d.hijri}`, color: "muted" });
      frags.push({ text: ` | ${d.city}`, color: "muted" });
      if (d.staleMinutes !== null) frags.push({ text: ` | stale ${d.staleMinutes}m`, color: "warning" });
      return frags;
    },
  };
}
```

> **Reconcile with the pinned test before running:** the pinned `calm` deepEqual expects the separator INSIDE the following fragment (` | Dhuhr`) while this draft pushes `|` and the name separately. ONE of them must win — align the implementation to the pinned test (it is the reviewed contract): drop the standalone `|` push and prefix each prayer block's first fragment with ` | `. I.e. `prayerBlock` returns the block WITHOUT separator and the loop does `frags.push({ text: \` | ${entry.name}\`, color: nameColor })` … with the hijri/city/stale fragments already ` | `-prefixed. Then `imminent.every(color === "accent")` must include separators — make separator color `esc === "imminent" ? "accent" : "dim"`. Adjust `prayerBlock` accordingly (separator emitted only by the loop, for blocks 2+; block 1 keeps a leading space after the label instead — pinned test shows `deen` then ` Fajr` with a SPACE not a pipe: `{ text: " Fajr" }`. So block 1 separator = `" "`, blocks 2+ = `" | "`.)

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/rows/deen.ts src/rows/registry.ts test/rows-deen.test.ts test/rows-registry.test.ts test/rows.test.ts test/adapters-zai.test.ts
git commit -m "feat: deen row — full prayer strip with escalation, hijri, city, stale marker"
```

---

### Task 6: Ledger repo attribution + REPO total

**Files:**
- Modify: `src/ledger/store.ts`, `src/rows/money.ts`
- Test: `test/ledger.test.ts` (extend), `test/rows.test.ts` (extend)

**Interfaces:**
- LedgerStoreOpts gains `repo?: () => string`; `LedgerLine` gains `repo: string` (default `"unknown"`); `LedgerSnapshot` gains `repoCost: number`; `parseLine` reads repo with `"unknown"` default. Money row leads with `REPO ${formatMoney(repoCost)}` in `text`.

- [ ] **Step 1: Extend `test/ledger.test.ts`**

```ts
// append to test/ledger.test.ts
test("repo attribution: lines record cwd basename; repoCost sums only the current repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const now = Date.UTC(2026, 7, 30, 10, 0);
  const store = createLedgerStore({
    filePath, now: () => now, utcOffsetMinutes: 480,
    repo: () => "pi-statusline",
  });
  store.load();
  const other = JSON.stringify({ id: "x1", ts: now, provider: "unknown", model: "unknown", repo: "other-repo", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: 5 });
  writeFileSync(filePath, `${other}\n`);
  store = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: 480, repo: () => "pi-statusline" });
  store.load();
  store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 1.24)]);
  const snap = store.getSnapshot();
  assert.deepEqual(snap.repoCost, 1.24); // other-repo's 5.00 excluded
  const raw = readFileSync(filePath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(raw[1]!.repo, "pi-statusline");
  // Lines WITHOUT repo (pre-P2) default to "unknown" and never count toward repoCost
  const legacy = JSON.stringify({ id: "x2", ts: now, provider: "unknown", model: "unknown", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: 2 });
  writeFileSync(filePath, `${legacy}\n`);
  const store2 = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: 480, repo: () => "pi-statusline" });
  store2.load();
  assert.deepEqual(store2.getSnapshot().repoCost, 1.24);
  rmSync(dir, { recursive: true, force: true });
});
```

> `store` is re-created mid-test to re-scan the file — `let store` (adjust the existing declaration style if needed). `entry()` helper already exists in this file.

- [ ] **Step 2: Run to verify FAIL, then modify `src/ledger/store.ts`**

- `LedgerLine` += `repo: string`; `LedgerStoreOpts` += `repo?: () => string`; `toLine` writes `repo: opts.repo?.() ?? "unknown"`; `parseLine` reads `repo` with `str(p.repo, "unknown")`; `getSnapshot` computes `repoCost` = sum over lines where `l.repo === (opts.repo?.() ?? "unknown")` — wait: legacy "unknown" lines must NOT count (test above), so repoCost filters `l.repo === currentRepo && currentRepo !== "unknown"`… simpler and matching the test: `const current = opts.repo?.() ?? "unknown"; repoCost = lines.filter(l => l.repo === current && current !== "unknown").reduce(...)`. When no `repo` accessor is provided (existing tests), `repoCost = 0`.

- [ ] **Step 3: Extend `test/rows.test.ts` (money row REPO lead)**

```ts
// append to test/rows.test.ts
test("money row: REPO all-time total leads the row in bright text", () => {
  const row = createMoneyRow();
  const frags = row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: { ...LEDGER, repoCost: 11529.35 },
  }))!;
  assert.deepEqual(frags[0], { text: "REPO $11529.35", color: "text" });
  assert.deepEqual(frags[1], { text: " | $ 1.24 sess", color: "text" });
});
```

> The existing money deepEqual gains a leading `REPO` fragment in ALL fixtures — update the pinned arrays (ledger fixture gains `repoCost: 12.34` → lead `REPO $12.34`).

- [ ] **Step 4: Modify `src/rows/money.ts`** — first fragments become:

```ts
      const frags: Fragment[] = [];
      if (ledger.repoCost > 0) frags.push({ text: `REPO ${formatMoney(ledger.repoCost)}`, color: "text" });
      frags.push({ text: ` | $${formatMoney(usage.cost)} sess`, color: "text" });
```

> **Reconcile with pinned tests:** the existing pins say `{ text: " 1.24 sess", color: "text" }` after a `{ text: "$", color: "dim" }` label fragment. Decide ONE shape and align tests+source — recommended (CC-style): drop the standalone `$` label, fold it into each value (`$1.24 sess`), lead with `REPO $X` when `repoCost > 0`, separators ` | `. Update the pinned deepEqual arrays to the chosen shape EXACTLY and keep burn/em-dash behavior unchanged otherwise. The review will hold you to test-source consistency.

- [ ] **Step 5: Run tests + typecheck, commit**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck` — all green.

```bash
git add src/ledger/store.ts src/rows/money.ts test/ledger.test.ts test/rows.test.ts
git commit -m "feat: ledger repo attribution and all-time REPO total"
```

---

### Task 7: Config deen section + `/statusline deen <city|auto>`

**Files:**
- Modify: `src/config.ts`, `src/tui/settings.ts`
- Test: `test/config.test.ts` (extend), `test/tui-settings.test.ts` (extend)

**Interfaces:**
- `StatuslineConfig` gains `deen: { city: string; country: string; method: string; escalateMinutes: number }` (defaults `"Jakarta" / "Indonesia" / "auto" / 30`). `parseStatuslineArgs` gains `{ action: "set-deen-city"; city: string }` for `deen <city|auto>` (city trimmed, single token or quoted rest — take everything after `deen ` as the city, trimmed; `deen` with no args → error "usage: /statusline deen <city|auto>").

- [ ] **Step 1: Extend `test/config.test.ts`**

```ts
// append
test("v2.1: deen defaults and back-compat (files without deen)", () => {
  writeFileSync(path_, JSON.stringify({}));
  const { config } = loadConfig(path_);
  assert.deepEqual(config.deen, { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 });
});

test("v2.1: deen section parses; escalateMinutes guarded positive; city auto allowed", () => {
  writeFileSync(path_, JSON.stringify({ deen: { city: "auto", country: "Singapore", method: "11", escalateMinutes: -5 } }));
  const { config } = loadConfig(path_);
  assert.deepEqual(config.deen, { city: "auto", country: "Singapore", method: "11", escalateMinutes: 30 });
});
```

Extend `test/tui-settings.test.ts`:

```ts
// append
test("deen subcommand parses city or auto; bare deen errors with usage", () => {
  assert.deepEqual(parseStatuslineArgs("deen Mecca"), { action: "set-deen-city", city: "Mecca" });
  assert.deepEqual(parseStatuslineArgs("deen auto"), { action: "set-deen-city", city: "auto" });
  assert.deepEqual(parseStatuslineArgs("deen"), { action: "error", message: "usage: /statusline deen <city|auto>" });
});
```

- [ ] **Step 2: Run to verify FAIL, then implement**

`src/config.ts`: add the `deen` block to `StatuslineConfig` + `DEFAULT_CONFIG` + parsing (strings pass; `escalateMinutes` only when `typeof === "number" && > 0`).
`src/tui/settings.ts`: `StatuslineAction` gains `{ action: "set-deen-city"; city: string }`; parser case:

```ts
    case "deen": {
      const city = args!.trim().slice("deen".length).trim();
      if (!city) return { action: "error", message: "usage: /statusline deen <city|auto>" };
      return { action: "set-deen-city", city };
    }
```

(`args` is non-null when `cmd` matched — keep the existing guard style.)

- [ ] **Step 3: Run tests + typecheck, commit**

```bash
git add src/config.ts src/tui/settings.ts test/config.test.ts test/tui-settings.test.ts
git commit -m "feat: deen config section and /statusline deen command"
```

---

### Task 8: Wiring — DeenSource lifecycle, snapshot.deen, deen command

**Files:**
- Modify: `src/index.ts`, `test/index-wiring.test.ts`

**Interfaces:**
- `StatuslineRuntimeDependencies` gains `deenCachePath: string` (default `~/.pi/agent/pi-statusline/deen-cache.json`) and `makeDeenSource?:` — NO: keep it simple: construct `DeenSource` inline via `createDeenSource({ cachePath: dependencies.deenCachePath, config: () => config, fetchFn?: overrides.fetchFn })` — tests inject a fake via a `makeDeenSource: (deps: { cachePath: string; config: () => StatuslineConfig }) => DeenSource` dependency override (default = `createDeenSource`).

- [ ] **Step 1: Extend `test/index-wiring.test.ts`**

New dependency override in the harness: `makeDeenSource` returning a fake source:

```ts
const fakeDeen: DeenSource = {
  current: () => ({
    schedule: [
      { name: "Fajr", wallMin: 276, minutesUntil: -300, state: "past" },
      { name: "Dhuhr", wallMin: 720, minutesUntil: 120, state: "next" },
      { name: "Asr", wallMin: 920, minutesUntil: 320, state: "upcoming" },
      { name: "Maghrib", wallMin: 1080, minutesUntil: 500, state: "upcoming" },
      { name: "Isha", wallMin: 1170, minutesUntil: 660, state: "upcoming" },
    ],
    escalation: "calm", hijri: "17 Rabīʿ al-awwal 1448", city: "Jakarta",
    timezone: "Asia/Jakarta", staleMinutes: null,
  }),
  refresh: async () => { deenRefreshes += 1; },
  geo: () => null,
};
```

Assertions to add (extend the existing harness scenario):
1. Footer render now includes the deen strip: a line matching `/deen .*Fajr .*✓.*Dhuhr.*(2h)/` — and `snapshot.deen` flowed (line contains `17 Rabīʿ al-awwal 1448` and `Jakarta`).
2. `session_start` calls the fake source's `refresh` (counter ≥ 1); the 30s ticker call path — simulate by asserting `refresh` called again after `deenRefreshes` check post-render (or drop to unit-level: index refreshes deen on session_start and on ticker ticks; wire-test asserts ≥1 after session_start, and the second `session_start` (reinstall scenario) refreshes again).
3. `/statusline deen Mecca` → config persisted with `deen.city === "Mecca"`, notify sent, fake source `refresh(force)` invoked (spy flag).
4. Scenario with `current: () => null` fake → deen line absent from render (row omitted), no crash.

- [ ] **Step 2: Run to verify FAIL, then modify `src/index.ts`**

Wiring additions (compose with the Task-11 rewritten index):
- deps: `deenCachePath` + `makeDeenSource` override seam (default `createDeenSource`).
- state: `let deenSource: DeenSource` created in `buildAdapters()`-adjacent init (per `activateStatusline` — once, not per session): `deenSource = dependencies.makeDeenSource({ cachePath: dependencies.deenCachePath, config: () => config })`.
- `session_start`: `void deenSource.refresh().catch(() => {})` (async, off the render path; print-mode safe — no new timers).
- ticker `onTick`: `if (deenNeedsRefresh()) void deenSource.refresh().catch(() => {})` — `deenNeedsRefresh` = `Date.now() - lastDeenRefresh > 60_000` (cheap throttle so the 30s ticker doesn't hammer the API; refresh itself is cache-first anyway). Track `lastDeenRefresh` at refresh completion.
- snapshot: `deen: deenSource.current()`.
- registry gains `createDeenRow()` (Task 5).
- command: `set-deen-city` case — persist `config.deen.city`, `await deenSource.refresh(true)`, notify `Deen location set to ${city}`.
- dispose: no deen timers to stop (refresh is promise-based), but the fake's state must survive reinstall — nothing to do.

- [ ] **Step 3: Run tests + typecheck, manual smoke**

Run: `pnpm test:run 2>&1 | tail -5 && pnpm typecheck` — all pass.
Manual smoke: `pi -e ./src/index.ts --no-session -p "smoke"` → exit 0 (deen refresh is fire-and-forget; print mode unaffected).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: deen wiring — snapshot, ticker refresh, /statusline deen command"
```

---

### Task 9: README + version 0.3.0 (release steps HELD)

**Files:**
- Modify: `README.md`, `package.json` (version → 0.3.0)

- [ ] **Step 1: README** — add the deen row to the render preview (with pipes):

```
deen | Fajr 05:00 ✓ | Dhuhr 12:00 (2h) | Asr 15:30 | Maghrib 18:00 | Isha 19:30 | 17 Rabīʿ al-awwal 1448 | Jakarta
```

plus sections: Deen (aladhan, 24h cache at `~/.pi/agent/pi-statusline/deen-cache.json`, city/country/method config, `city: "auto"` = IP-geo, `/statusline deen <city|auto>`, escalation bands table), Ledger (`repo` attribution + `REPO $` total), money-row changes.

- [ ] **Step 2:** `package.json` version → **0.3.0**. Full suite + typecheck. One commit: `chore: v0.3.0 — deen suite, REPO total, prayer strip`.

- [ ] **Step 3 (CONTROLLER-HELD):** merge `--no-ff` to main, tag `v0.3.0` (`-c tag.gpgSign=false`), push — **only after the final whole-branch review approves**, then settings-pin bump to `@0.3.0` and npm/mirror verification.

---

## Self-Review (performed at plan-writing time)

1. **Spec coverage (§12 P2 + §15):** DeenSource (Tasks 1–4) · deen row + escalation + hijri + city + stale (Task 5) · full CC-style strip (Task 5 render contract) · ledger repo field + REPO total (Task 6) · `/statusline deen` + config (Task 7) · wiring (Task 8) · release prep (Task 9). Est/burn-anchor/version-stamps/MCP/OR/`rows` cmd are P3 — absent by design. IP-geo fallback (§8) in Task 4.
2. **Placeholder scan:** the Task-2 draft assertion bug is flagged inline with the corrected contract (adhan only in (−10, 0]); Task 5 pins vs draft separator mismatch is reconciled inline with an explicit instruction (implementation aligns to pins); Task 6 money-row shape decision is delegated to the implementer with a review-enforceable consistency rule (fold `$` into values, CC-style). No TBDs.
3. **Type consistency:** `DeenData/PrayerTimes/PrayerName` (1) → cache `DeenCacheFile` (3) → source `DeenSnapshot` (4) → registry `RowSnapshot.deen` (5) → row (5) → wiring (8). `DeenSourceConfig` matches config.ts `deen` shape (7). `LedgerLine.repo`/`LedgerSnapshot.repoCost` (6) → money row (6).
4. **Deliberate deviations flagged:** date-key uses the CITY tz when resolvable (explicit-city path may use last-known/UTC tz for the key until first fetch — documented in source comment); money-row `$`-label fold changes existing pins (review-enforced consistency); deen refresh throttle (60s) added at wiring to keep the 30s ticker polite.
