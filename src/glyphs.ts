// src/glyphs.ts

export type GlyphStyle = "nerd" | "unicode" | "ascii";

type GlyphTable = Record<string, string>;

const NERD: GlyphTable = {
  git_branch: "\ue725",
  git_dirty: "*",
  git_ahead: "\uf062",
  git_behind: "\uf063",
  model: "\uf085",
  context_gauge: "\u25b6",
  quota_bar: "\u25b6",
  clock: "\uf017",
  coding: "\ue708",
  deen: "\uf17d",
  burn_rate: "\uf200",
  sparkline: "\u25b8",
};

const UNICODE: GlyphTable = {
  git_branch: "\u2387", // ⎇ — matches the identity row's established mark
  git_dirty: "*",
  git_ahead: "\u2191",
  git_behind: "\u2193",
  model: "\u25c6",
  context_gauge: "\u25b8",
  quota_bar: "\u25b8",
  clock: "\u25f7",
  coding: "\u2192",
  deen: "\u263e",
  burn_rate: "\u25b2",
  sparkline: "\u25b8",
};

const ASCII: GlyphTable = {
  git_branch: "git:",
  git_dirty: "*",
  git_ahead: "^",
  git_behind: "v",
  model: "[m]",
  context_gauge: "[|]",
  quota_bar: "[|]",
  clock: "@",
  coding: ">",
  deen: "*",
  burn_rate: "!",
  sparkline: "#",
};

export const GLYPH_TABLES: Record<GlyphStyle, GlyphTable> = { nerd: NERD, unicode: UNICODE, ascii: ASCII };

export function getGlyph(segment: string, style: GlyphStyle): string {
  return GLYPH_TABLES[style]?.[segment] ?? "";
}
