// src/rows/deen.ts
import type { DeenSnapshot } from "../deen/source.ts";
import type { PrayerScheduleEntry } from "../deen/time.ts";
import type { ColorToken, Fragment } from "../types.ts";
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
    render(snapshot: RowSnapshot): Fragment[] | null {
      const d = snapshot.deen;
      if (!d) return null;
      const esc = d.escalation;
      const frags: Fragment[] = [{ text: "deen", color: esc === "imminent" ? "accent" : "dim" }];
      d.schedule.forEach((entry, i) => {
        // Separator lives INSIDE the name fragment (pinned contract): block 1 opens with
        // a single space after the label, later blocks with " | ".
        frags.push({ text: `${i === 0 ? " " : " | "}${entry.name}`, color: nameColor(entry, esc) });
        frags.push(...prayerTail(entry, esc));
      });
      const tailColor: ColorToken = esc === "imminent" ? "accent" : "muted";
      frags.push({ text: ` | ${d.hijri}`, color: tailColor });
      frags.push({ text: ` | ${d.city}`, color: tailColor });
      if (d.staleMinutes !== null) frags.push({ text: ` | stale ${d.staleMinutes}m`, color: "warning" });
      return frags;
    },
  };
}
