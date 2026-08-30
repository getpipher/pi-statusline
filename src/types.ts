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
export const KNOWN_ROW_IDS = ["identity", "ctx", "money", "quota", "deen", "ambient"] as const;
export type RowId = (typeof KNOWN_ROW_IDS)[number];

// Retention tiers under width pressure: 1 = kept longest (identity/ctx/deen),
// 2 = money/quota, 3 = ambient (dropped first).
export type RowPriority = 1 | 2 | 3;
