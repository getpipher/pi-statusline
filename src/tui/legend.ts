// src/tui/legend.ts
import type { RowId } from "../types.ts";

// One-line sample of what each row renders (v0.4.9): `/statusline rows` prints this
// legend so the ids are self-explanatory when re-arranging. v0.5.0: compound specs
// (`model+ctx`) share one line.
const SAMPLES: Record<RowId, string> = {
  identity: "[session] …/repo ⎇ branch  (model suppressed when a model line-part exists)",
  model: "glm-5.3-flash · max  — bare lead; compose e.g. model+ctx",
  ctx: "Ctx: % (used/window) | Tokens: in / out | Cache: % hit",
  money: "REPO $ | DAY $ | 7DAY $ | 30DAY $",
  quota: "5HRS %/% (reset) | 7DAY %/% (reset)  — also hosts the OpenRouter `or` row",
  deen: "Fajr 04:35 ✓ | Dhuhr 11:52 (2h) | Asr | Maghrib | Isha",
  ambient: "clock | coding span | commits 27 | hijri | Jakarta",
};

export function rowsLegendMessage(current: string[]): string {
  const all = Object.keys(SAMPLES) as RowId[];
  const known = new Set<string>(all);
  const lines = [
    `Rows: ${current.join(", ")} (valid: ${all.join(", ")}; join ids with + to share a line, e.g. model+ctx)`,
    ...current.map((id) => `  ${id.padEnd(8)} → ${known.has(id) ? SAMPLES[id as RowId] : "(unknown id)"}`),
  ];
  return lines.join("\n");
}
