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

// Block fragments AFTER the name (which carries the block's separator prefix).
function prayerTail(entry: PrayerScheduleEntry, esc: DeenSnapshot["escalation"]): Fragment[] {
  const tail: Fragment[] = [
    { text: ` ${wallTime(entry.wallMin)}`, color: esc === "imminent" ? "accent" : "text" },
  ];
  if (entry.state === "adhan") {
    tail.push({ text: " · adhan", color: "dim" });
    if (entry.minutesUntil >= -2) tail.push({ text: ` ${countdown(0)}`, color: "accent" });
  }
  if (entry.state === "past") tail.push({ text: " ✓", color: esc === "imminent" ? "accent" : "success" });
  if (entry.state === "next") {
    tail.push({ text: ` ${countdown(entry.minutesUntil)}`, color: esc === "near" || esc === "imminent" ? "accent" : "text" });
  }
  return tail;
}

// Name color per escalation (pinned tests): imminent accents everything (separators live
// inside the name fragment); soon brightens names; near accents the NEXT prayer's name;
// the started prayer is always accent.
function nameColor(entry: PrayerScheduleEntry, esc: DeenSnapshot["escalation"]): ColorToken {
  if (esc === "imminent") return "accent";
  if (esc === "soon") return "text";
  if (esc === "near") return entry.state === "next" ? "accent" : "text";
  if (entry.state === "adhan") return "accent";
  return "dim";
}

export function createDeenRow(): Row {
  return {
    id: "deen",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const d = snapshot.deen;
      if (!d) return null;
      const esc = d.escalation;

      // Detail 0 — next prayer only: `Dhuhr (2h)` with escalation colors.
      if (detail === 0) {
        const next = d.schedule.find((e) => e.state === "next");
        if (!next) return null;
        return [
          { text: next.name, color: nameColor(next, esc) },
          { text: ` ${countdown(next.minutesUntil)}`, color: esc === "near" || esc === "imminent" ? "accent" : "text" },
        ];
      }

      // Detail 2 = full strip; detail 1 drops past prayers. No label (RECTOR): the first
      // rendered prayer starts the line bare; later blocks carry " | ". Hijri/city live on
      // the ambient row now.
      const shown = detail >= 2 ? d.schedule : d.schedule.filter((e) => e.state !== "past");
      const frags: Fragment[] = [];
      shown.forEach((entry, i) => {
        frags.push({ text: `${i === 0 ? "" : " | "}${entry.name}`, color: nameColor(entry, esc) });
        frags.push(...prayerTail(entry, esc));
      });
      if (d.staleMinutes !== null) frags.push({ text: ` | stale ${d.staleMinutes}m`, color: "warning" });
      return frags.length > 0 ? frags : null;
    },
  };
}
