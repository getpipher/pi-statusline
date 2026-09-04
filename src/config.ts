// src/config.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { KNOWN_ROW_IDS, parseLineSpec } from "./types.ts";
import type { GlyphStyle } from "./glyphs.ts";

export interface StatuslineConfig {
  enabled: boolean;
  zai: {
    tier: "auto" | "lite" | "pro" | "max";
    pollIntervalMs: number;
  };
  deen: {
    city: string;            // "auto" → IP-geo resolution
    country: string;
    method: string;          // "auto" → aladhan default
    escalateMinutes: number;
  };
  providers: {
    openrouter: {
      enabled: boolean;
      pollIntervalMs: number;
    };
  };
  display: {
    rows: string[];         // display lines: row ids, or compounds joined by "+" (v0.5.0)
                            // e.g. ["identity", "model+ctx", …] — one line per entry
    bars: boolean;
    showTokens: boolean;
    showContext: boolean;
    showGit: boolean;
    showSession: boolean;
    showVersions: boolean; // ambient SL/PI stamps (spec §15), default off
    theme: string; // named preset — validated at use, unknown-row precedent
    glyphs: GlyphStyle; // segment decoration style (visual upgrade)
  };
}

export interface ConfigLoadResult {
  config: StatuslineConfig;
  unknownRows: string[]; // display.rows entries not in KNOWN_ROW_IDS — surface via one-time notify
}

export const DEFAULT_CONFIG: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  deen: { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 },
  providers: { openrouter: { enabled: true, pollIntervalMs: 600_000 } },
  display: {
    // Canonical default (v0.5.0): the 6 original lines — `model` is a known id but NOT
    // in the default (identity still renders the model there; zero-change contract).
    rows: ["identity", "ctx", "money", "quota", "deen", "ambient"],
    bars: true,
    showTokens: true,
    showContext: true,
    showGit: true,
    showSession: true,
    showVersions: false,
    theme: "default",
    glyphs: "unicode",
  },
};

const VALID_TIERS = ["auto", "lite", "pro", "max"] as const;

export function loadConfig(path: string): ConfigLoadResult {
  const unknownRows: string[] = [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { config: structuredClone(DEFAULT_CONFIG), unknownRows };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { config: structuredClone(DEFAULT_CONFIG), unknownRows };
  }
  if (!parsed || typeof parsed !== "object") {
    return { config: structuredClone(DEFAULT_CONFIG), unknownRows };
  }

  const cfg = structuredClone(DEFAULT_CONFIG);

  if (typeof parsed.enabled === "boolean") cfg.enabled = parsed.enabled;

  if (parsed.zai && typeof parsed.zai === "object") {
    const z = parsed.zai as Record<string, unknown>;
    if (typeof z.tier === "string") {
      if (!VALID_TIERS.includes(z.tier as typeof VALID_TIERS[number])) {
        throw new Error(`tier must be one of: ${VALID_TIERS.join(", ")}`);
      }
      cfg.zai.tier = z.tier as StatuslineConfig["zai"]["tier"];
    }
    if (typeof z.pollIntervalMs === "number" && z.pollIntervalMs > 0) {
      cfg.zai.pollIntervalMs = z.pollIntervalMs;
    }
  }

  if (parsed.deen && typeof parsed.deen === "object") {
    const d = parsed.deen as Record<string, unknown>;
    if (typeof d.city === "string") cfg.deen.city = d.city;
    if (typeof d.country === "string") cfg.deen.country = d.country;
    if (typeof d.method === "string") cfg.deen.method = d.method;
    if (typeof d.escalateMinutes === "number" && d.escalateMinutes > 0) cfg.deen.escalateMinutes = d.escalateMinutes;
  }

  if (parsed.providers && typeof parsed.providers === "object") {
    const p = parsed.providers as Record<string, unknown>;
    if (p.openrouter && typeof p.openrouter === "object") {
      const o = p.openrouter as Record<string, unknown>;
      if (typeof o.enabled === "boolean") cfg.providers.openrouter.enabled = o.enabled;
      if (typeof o.pollIntervalMs === "number" && o.pollIntervalMs > 0) cfg.providers.openrouter.pollIntervalMs = o.pollIntervalMs;
    }
  }

  if (parsed.display && typeof parsed.display === "object") {
    const d = parsed.display as Record<string, unknown>;
    if (typeof d.showTokens === "boolean") cfg.display.showTokens = d.showTokens;
    if (typeof d.showContext === "boolean") cfg.display.showContext = d.showContext;
    if (typeof d.showGit === "boolean") cfg.display.showGit = d.showGit;
    if (typeof d.showSession === "boolean") cfg.display.showSession = d.showSession;
    if (typeof d.bars === "boolean") cfg.display.bars = d.bars;
    if (typeof d.showVersions === "boolean") cfg.display.showVersions = d.showVersions;
    if (typeof d.theme === "string") cfg.display.theme = d.theme;
    if (d.glyphs === "nerd" || d.glyphs === "unicode" || d.glyphs === "ascii") cfg.display.glyphs = d.glyphs;
    if (Array.isArray(d.rows)) {
      const valid: string[] = [];
      for (const entry of d.rows) {
        if (typeof entry !== "string" || entry.trim().length === 0) continue;
        // Compound line specs (v0.5.0): "model+ctx" — every part must be a known id.
        const parts = parseLineSpec(entry);
        const unknown = parts.filter((p) => !(KNOWN_ROW_IDS as readonly string[]).includes(p));
        if (parts.length === 0 || unknown.length > 0) {
          if (!unknownRows.includes(entry)) unknownRows.push(entry); // D6: dropped + reported
          continue;
        }
        const spec = [...new Set(parts)].join("+"); // dedupe parts, first occurrence wins
        if (!valid.includes(spec)) valid.push(spec);
      }
      if (valid.length > 0) cfg.display.rows = valid;
    }
  }

  return { config: cfg, unknownRows };
}

export function saveConfig(path: string, cfg: StatuslineConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
