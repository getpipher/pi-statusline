// src/rows/deen.ts
import type { DeenSnapshot } from "../deen/source.ts";
import type { PrayerScheduleEntry } from "../deen/time.ts";
import type { ColorToken, Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// (Xh Ym) — hours omitted under 1h → (45m); minutes omitted at whole hours → (2h); (0m) at zero.
function countdown(minutesUntil: number): string {
  const m = Math.max(0, minutesUntil);
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `(${min}m)`;
  if (min === 0) return `(${h}h)`;
  return `(${h}h ${min}m)`;
}

function wallTime(wallMin: number): string {
  return `${String(Math.floor(wallMin / 60)).padStart(2, "0")}:${String(wallMin % 60).padStart(2, "0")}`;
}

// CCS-faithful prayer states (v0.4.1, RECTOR — verified against claude-code-statusline
// lib/prayer/display.sh): the NEXT prayer is bright green (our `success` token — CCS
// default `bright_green`), completed prayers are dim with ✓, upcoming prayers plain.
// Steady green — the v0.3 escalation bands are retired (deen.escalateMinutes inert).
function stateColor(entry: PrayerScheduleEntry): ColorToken {
  if (entry.state === "next") return "success";
  if (entry.state === "past" || entry.state === "adhan") return "dim";
  return "text";
}

// Block fragments AFTER the name (which carries the block's separator prefix).
function prayerTail(entry: PrayerScheduleEntry): Fragment[] {
  const color = stateColor(entry);
  const tail: Fragment[] = [{ text: ` ${wallTime(entry.wallMin)}`, color }];
  if (entry.state === "past" || entry.state === "adhan") tail.push({ text: " ✓", color });
  if (entry.state === "next") tail.push({ text: ` ${countdown(entry.minutesUntil)}`, color });
  return tail;
}

export function createDeenRow(): Row {
  return {
    id: "deen",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const d = snapshot.deen;
      if (!d) return null;

      // Detail 0 — next prayer only: `Dhuhr (2h)` in the next-prayer green.
      if (detail === 0) {
        const next = d.schedule.find((e) => e.state === "next");
        if (!next) return null;
        return [
          { text: next.name, color: "success" },
          { text: ` ${countdown(next.minutesUntil)}`, color: "success" },
        ];
      }

      // Detail 2 = full strip; detail 1 drops past prayers. No label (RECTOR): the first
      // rendered prayer starts the line bare; later blocks carry " | ". Hijri/city live on
      // the ambient row now.
      const shown = detail >= 2 ? d.schedule : d.schedule.filter((e) => e.state !== "past");
      const frags: Fragment[] = [];
      shown.forEach((entry, i) => {
        frags.push({ text: `${i === 0 ? "" : " | "}${entry.name}`, color: stateColor(entry) });
        frags.push(...prayerTail(entry));
      });
      if (d.staleMinutes !== null) frags.push({ text: ` | stale ${d.staleMinutes}m`, color: "warning" });
      return frags.length > 0 ? frags : null;
    },
  };
}
