// src/tui/settings.ts
export type StatuslineAction =
  | { action: "open-panel" }
  | { action: "refresh" }
  | { action: "set-enabled"; enabled: boolean }
  | { action: "set-tier"; tier: "auto" | "lite" | "pro" | "max" }
  | { action: "set-deen-city"; city: string }
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
    default:
      return { action: "error", message: `unknown command: ${cmd}` };
  }
}
