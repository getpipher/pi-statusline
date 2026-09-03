// src/tui/legend.ts
import type { RowId } from "../types.ts";

// One-line sample of what each row renders (v0.4.9): `/statusline rows` prints this
// legend so the ids are self-explanatory when re-arranging.
const SAMPLES: Record<RowId, string> = {
  identity: "[session] …/repo ⎇ branch | model · thinking",
  ctx: "Ctx: % (used/window) | Tokens: in / out | Cache: % hit",
  money: "REPO $ | DAY $ | 7DAY $ | 30DAY $",
  quota: "5HRS %/% (reset) | 7DAY %/% (reset)  — also hosts the OpenRouter `or` row",
  deen: "Fajr 04:35 ✓ | Dhuhr 11:52 (2h) | Asr | Maghrib | Isha",
  ambient: "clock | coding span | commits 27 | hijri | Jakarta",
};

export function rowsLegendMessage(current: RowId[]): string {
  const all = Object.keys(SAMPLES) as RowId[];
  const lines = [
    `Rows: ${current.join(", ")} (valid: ${all.join(", ")})`,
    ...current.map((id) => `  ${id.padEnd(8)} → ${SAMPLES[id]}`),
  ];
  return lines.join("\n");
}
