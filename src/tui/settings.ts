// src/tui/settings.ts
export type StatuslineAction =
  | { action: "open-panel" }
  | { action: "refresh" }
  | { action: "set-enabled"; enabled: boolean }
  | { action: "set-tier"; tier: "auto" | "lite" | "pro" | "max" }
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
    default:
      return { action: "error", message: `unknown command: ${cmd}` };
  }
}
