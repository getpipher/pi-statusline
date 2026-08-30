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
  // Corrected per the brief's inline note: at 10:00 wall there is NO adhan. Dhuhr (12:00)
  // is strictly future and is THE next prayer (the note's "upcoming AND next" = the
  // dedicated `next` state); Asr is a plain upcoming entry.
  assert.equal(schedule[1]!.state, "next");
  assert.equal(schedule[1]!.minutesUntil, 120);
  assert.equal(schedule.find((e) => e.state === "next")?.name, "Dhuhr");
  assert.equal(schedule[2]!.state, "upcoming"); // Asr 15:30 — future, not next
});

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
