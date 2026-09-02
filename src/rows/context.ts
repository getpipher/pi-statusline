// src/rows/context.ts
import { formatTokensHuman } from "../format.ts";
import type { ColorToken, Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// CCS traffic-light defaults (claude-code-statusline context_window: medium 50 → yellow,
// warn 75 → yellow, critical 90 → red): <50 success, 50–89 warning, ≥90 error.
function contextHeat(percent: number): ColorToken {
  if (percent >= 90) return "error";
  if (percent >= 50) return "warning";
  return "success";
}

export function createContextRow(): Row {
  return {
    id: "ctx",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const s = snapshot.session;
      const display = snapshot.config.display;
      const frags: Fragment[] = [{ text: "Ctx:", color: "dim" }];

      // Ratio: precomputed percent when present, else tokens/window (v1 fallback kept).
      const percent =
        s.contextPercent !== null && Number.isFinite(s.contextPercent)
          ? s.contextPercent
          : s.contextTokens !== null && s.contextWindow > 0
            ? (s.contextTokens / s.contextWindow) * 100
            : null;

      const showPct = display.showContext && percent !== null;
      if (showPct) {
        // CCS presentation (v0.4.6): `Ctx: 34% (68.0K/200.0K)` — pct + window ratio share
        // the traffic-light color; CCS token formatting (one decimal, uppercase K/M).
        const heat = contextHeat(percent);
        frags.push({ text: ` ${Math.round(percent)}%`, color: heat });
        if (detail >= 2 && s.contextTokens !== null && s.contextWindow > 0) {
          frags.push({ text: ` (${formatTokensHuman(s.contextTokens)}/${formatTokensHuman(s.contextWindow)})`, color: heat });
        }
      }
      if (display.showTokens && detail >= 1) {
        frags.push({ text: ` | Tokens: ${formatTokensHuman(s.usage.input)} in / ${formatTokensHuman(s.usage.output)} out`, color: "toolTitle" });
      }
      if (detail >= 2) {
        const cacheDenominator = s.usage.cacheRead + s.usage.input;
        if (cacheDenominator > 0) {
          const hit = Math.round((s.usage.cacheRead / cacheDenominator) * 100);
          frags.push({ text: ` | Cache: ${hit}% hit`, color: "success" });
        }
      }
      return frags.length > 1 ? frags : null;
    },
  };
}
