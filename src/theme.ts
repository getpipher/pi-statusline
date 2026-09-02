// src/theme.ts
import type { ColorToken } from "./types.ts";

// Named presets (spec §12): palette presets OVER the theme tokens — a preset remaps
// our semantic tokens onto other tokens; pi's live theme still supplies real colors
// (theme-integrated per the v0.2.3 decision — no hardcoded ANSI, ever).
export const THEME_PRESETS: Record<string, Partial<Record<ColorToken, ColorToken>>> = {
  default: {},
  mono: { success: "text", toolTitle: "text", accent: "text" },
};

export function applyThemeColor(token: ColorToken, presetName: string): { color: ColorToken; known: boolean } {
  const preset = THEME_PRESETS[presetName];
  if (!preset) return { color: token, known: false }; // unknown → identity + one-time notify upstream
  return { color: preset[token] ?? token, known: true };
}
