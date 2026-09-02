// src/tui/settings.ts
import { KNOWN_ROW_IDS, type RowId } from "../types.ts";

export type StatuslineAction =
  | { action: "open-panel" }
  | { action: "refresh" }
  | { action: "set-enabled"; enabled: boolean }
  | { action: "set-tier"; tier: "auto" | "lite" | "pro" | "max" }
  | { action: "set-deen-city"; city: string }
  | { action: "list-rows" }
  | { action: "set-rows"; ids: RowId[] }
  | { action: "error"; message: string };

const VALID_TIERS = ["auto", "lite", "pro", "max"] as const;

export function parseStatuslineArgs(args: string | undefined): StatuslineAction {
  if (!args || args.trim() === "") return { action: "open-panel" };

  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase();

  switch (cmd) {
    case "refresh":
      return { action: "refresh" };
    case "on":
      return { action: "set-enabled", enabled: true };
    case "off":
      return { action: "set-enabled", enabled: false };
    case "tier": {
      const val = parts[1]?.toLowerCase();
      if (!val || !VALID_TIERS.includes(val as typeof VALID_TIERS[number])) {
        return { action: "error", message: `tier must be one of: ${VALID_TIERS.join(", ")}` };
      }
      return { action: "set-tier", tier: val as typeof VALID_TIERS[number] };
    }
    case "deen": {
      // Everything after the first token is the city — case-preserved ("Mecca"),
      // multi-word allowed; cmd lowercased only parts[0] for matching.
      const city = args.trim().slice("deen".length).trim();
      if (!city) return { action: "error", message: "usage: /statusline deen <city|auto>" };
      return { action: "set-deen-city", city };
    }
    case "rows": {
      const rest = args!.trim().slice("rows".length).trim();
      if (!rest) return { action: "list-rows" };
      const parts2 = rest.split(",").map((s) => s.trim()).filter(Boolean);
      const invalid = parts2.filter((id) => !(KNOWN_ROW_IDS as readonly string[]).includes(id));
      if (parts2.length === 0 || invalid.length > 0) {
        return { action: "error", message: `rows must be a comma-separated subset of: ${KNOWN_ROW_IDS.join(", ")}` };
      }
      const ids = [...new Set(parts2)] as RowId[]; // dedupe, first occurrence wins
      return { action: "set-rows", ids };
    }
    default:
      return { action: "error", message: `unknown command: ${cmd}` };
  }
}
