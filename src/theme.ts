// src/theme.ts
import type { ColorToken } from "./types.ts";

export const DEFAULT_THEME_NAME = "default";

export interface ThemePreset {
  name: string;
  tokens: Partial<Record<ColorToken, string>>; // hex truecolor per token
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
  default: { name: "default", tokens: {} },
  mono: { name: "mono", tokens: { success: "text", toolTitle: "text", accent: "text" } },
  gruvbox: {
    name: "gruvbox",
    tokens: {
      text: "#ebdbb2", dim: "#928374", muted: "#7c6f64",
      accent: "#fabd2f", success: "#b8bb26", warning: "#fe8019",
      error: "#fb4934", toolTitle: "#83a598",
    },
  },
  "tokyo-night": {
    name: "tokyo-night",
    tokens: {
      text: "#a9b1d6", dim: "#565f89", muted: "#414868",
      accent: "#7aa2f7", success: "#9ece6a", warning: "#e0af68",
      error: "#f7768e", toolTitle: "#7dcfff",
    },
  },
  pastel: {
    name: "pastel",
    tokens: {
      text: "#d6d6d6", dim: "#8f8f8f", muted: "#6a6a6a",
      accent: "#c5a3ff", success: "#a8e6cf", warning: "#ffd3b6",
      error: "#ffaaa5", toolTitle: "#89ceb6",
    },
  },
  solarized: {
    name: "solarized",
    tokens: {
      text: "#839496", dim: "#657b83", muted: "#586e75",
      accent: "#b58900", success: "#859900", warning: "#cb4b16",
      error: "#dc322f", toolTitle: "#268bd2",
    },
  },
};

/**
 * Resolve a semantic token to its rendered color under a named theme preset.
 * Returns a truecolor hex string for non-default presets, or the original
 * token for default/unknown themes (pi's live theme resolves those).
 */
export function resolveThemeToken(token: ColorToken, themeName: string): string {
  const preset = THEME_PRESETS[themeName];
  if (!preset) return token;
  return preset.tokens[token] ?? token;
}

export function applyThemeColor(token: ColorToken, presetName: string): { color: string; known: boolean } {
  const preset = THEME_PRESETS[presetName];
  if (!preset) return { color: token, known: false };
  return { color: preset.tokens[token] ?? token, known: true };
}
