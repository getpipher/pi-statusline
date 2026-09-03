// src/types.ts
export type ColorToken =
  | "text"
  | "muted"
  | "dim"
  | "accent"
  | "warning"
  | "error"
  | "success"
  | "toolTitle";

export interface Fragment {
  text: string;
  color: ColorToken;
}

// Canonical row ids (spec §9). "deen" is a KNOWN id from day one: config accepts it
// without a notify, but no row module is registered until P2 — renderRows skips it silently.
// "model" (v0.5.0): standalone model+thinking row — opt-in via display.rows compounds
// (e.g. "model+ctx"); NOT in the default rows (identity still renders the model there).
export const KNOWN_ROW_IDS = ["identity", "model", "ctx", "money", "quota", "deen", "ambient"] as const;
export type RowId = (typeof KNOWN_ROW_IDS)[number];

// A display line: one row id or multiple joined by "+" (compound line, v0.5.0).
export function parseLineSpec(entry: string): string[] {
  return entry.split("+").map((p) => p.trim()).filter((p) => p.length > 0);
}

// Retention tiers under width pressure: 1 = kept longest (identity/ctx/deen),
// 2 = money/quota, 3 = ambient (dropped first).
export type RowPriority = 1 | 2 | 3;

// Responsive detail levels (CC-style): 2 = full, 1 = compact, 0 = minimal. The
// registry shrinks rows (phase S) BEFORE dropping (phase D) — detail never re-raises.
export type RowDetail = 2 | 1 | 0;
