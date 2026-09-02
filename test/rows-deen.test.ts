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
    git: null,
    versions: { sl: "", pi: null },
    glyphStyle: "unicode",
    barStyle: "blocks",
    ...partial,
  };
}

function plain(frags: ReturnType<ReturnType<typeof createDeenRow>["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("deen row: CCS states — next prayer green, past dim ✓, upcoming plain (labelless strip)", () => {
  const frags = createDeenRow().render(snap({ deen: deen({}) }), 2)!;
  assert.deepEqual(frags, [
    { text: "Fajr", color: "dim" }, { text: " 05:00", color: "dim" }, { text: " ✓", color: "dim" },
    { text: " | Dhuhr", color: "success" }, { text: " 12:00", color: "success" }, { text: " (2h)", color: "success" },
    { text: " | Asr", color: "text" }, { text: " 15:30", color: "text" },
    { text: " | Maghrib", color: "text" }, { text: " 18:00", color: "text" },
    { text: " | Isha", color: "text" }, { text: " 19:30", color: "text" },
  ]);
});

test("deen row: detail 1 drops past prayers (countdown + stale kept); detail 0 is next-only", () => {
  const row = createDeenRow();
  const one = plain(row.render(snap({ deen: deen({ staleMinutes: 4 }) }), 1));
  assert.ok(!one.includes("Fajr") && !one.includes("✓"), "past prayers dropped at detail 1");
  assert.ok(one.includes("Dhuhr 12:00 (2h)") && one.includes("Asr") && one.includes("stale 4m"), `detail 1: ${one}`);
  const zero = row.render(snap({ deen: deen({}) }), 0)!;
  assert.deepEqual(zero, [
    { text: "Dhuhr", color: "success" },
    { text: " (2h)", color: "success" },
  ]);
});

test("deen row: countdown format — (45m) under an hour, (2h) whole hours", () => {
  const soon = deen({ schedule: sched([
    ["Fajr", -300, "past"], ["Dhuhr", 45, "next"], ["Asr", 245, "upcoming"],
    ["Maghrib", 425, "upcoming"], ["Isha", 585, "upcoming"],
  ]) });
  assert.ok(plain(createDeenRow().render(snap({ deen: soon }), 2)).includes(" (45m)"));
  const whole = deen({ schedule: sched([
    ["Fajr", -300, "past"], ["Dhuhr", 120, "next"], ["Asr", 320, "upcoming"],
    ["Maghrib", 500, "upcoming"], ["Isha", 660, "upcoming"],
  ]) });
  assert.ok(plain(createDeenRow().render(snap({ deen: whole }), 2)).includes(" (2h)"));
});

test("deen row: states are escalation-independent (v0.4.1 static green — bands retired)", () => {
  const row = createDeenRow();
  for (const escalation of ["calm", "soon", "near", "imminent", "adhan"] as const) {
    const frags = row.render(snap({ deen: deen({ escalation }) }), 2)!;
    assert.equal(frags[0]!.color, "dim", `Fajr stays dim under ${escalation}`);
    const dhuhr = frags.find((f) => f.text === " | Dhuhr")!;
    assert.equal(dhuhr.color, "success", `next stays green under ${escalation}`);
  }
});

test("deen row: adhan — the started prayer reads completed (dim ✓), CCS-faithful", () => {
  const adhan = deen({
    escalation: "adhan",
    schedule: sched([
      ["Fajr", -300, "past"], ["Dhuhr", -2, "adhan"], ["Asr", 200, "upcoming"],
      ["Maghrib", 380, "upcoming"], ["Isha", 540, "upcoming"],
    ]),
  });
  const frags = createDeenRow().render(snap({ deen: adhan }), 2)!;
  const text = plain(frags);
  assert.ok(text.includes("Dhuhr 12:00 ✓"));
  assert.ok(!text.includes("adhan"), "no adhan marker (CCS-faithful)");
  const dhuhrName = frags.find((f) => f.text === " | Dhuhr")!;
  assert.equal(dhuhrName.color, "dim");
});

test("deen row: stale marker (warning) appended; row omitted when deen is null", () => {
  const stale = createDeenRow().render(snap({ deen: deen({ staleMinutes: 4 }) }), 2);
  assert.ok(plain(stale).includes(" | stale 4m"));
  assert.equal(stale!.find((f) => f.text === " | stale 4m")!.color, "warning");
  assert.equal(createDeenRow().render(snap({}), 2), null);
});
