// src/config.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StatuslineConfig {
  enabled: boolean;
  zai: {
    tier: "auto" | "lite" | "pro" | "max";
    pollIntervalMs: number;
  };
  display: {
    showTokens: boolean;
    showContext: boolean;
    showGit: boolean;
    showSession: boolean;
  };
}

export const DEFAULT_CONFIG: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  display: { showTokens: true, showContext: true, showGit: true, showSession: true },
};

const VALID_TIERS = ["auto", "lite", "pro", "max"] as const;

export function loadConfig(path: string): StatuslineConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
  if (!parsed || typeof parsed !== "object") {
    return structuredClone(DEFAULT_CONFIG);
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

  if (parsed.display && typeof parsed.display === "object") {
    const d = parsed.display as Record<string, unknown>;
    if (typeof d.showTokens === "boolean") cfg.display.showTokens = d.showTokens;
    if (typeof d.showContext === "boolean") cfg.display.showContext = d.showContext;
    if (typeof d.showGit === "boolean") cfg.display.showGit = d.showGit;
    if (typeof d.showSession === "boolean") cfg.display.showSession = d.showSession;
  }

  return cfg;
}

export function saveConfig(path: string, cfg: StatuslineConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
