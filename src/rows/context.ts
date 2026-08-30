// src/rows/context.ts
import { formatTokenCount, renderBar } from "../format.ts";
import type { ColorToken, Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createContextRow(): Row {
  return {
    id: "ctx",
    priority: 1,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const s = snapshot.session;
      const display = snapshot.config.display;
      const frags: Fragment[] = [{ text: "ctx", color: "dim" }];

      // Ratio: precomputed percent when present, else tokens/window.
      const ratio =
        s.contextPercent !== null && Number.isFinite(s.contextPercent)
          ? s.contextPercent / 100
          : s.contextTokens !== null && s.contextWindow > 0
            ? s.contextTokens / s.contextWindow
            : null;

      const showPct = display.showContext && ratio !== null;
      if (display.bars && ratio !== null && (showPct || s.contextTokens !== null)) {
        // Theme-safe escalation: warning ≥70%, error ≥90%.
        const pct = ratio * 100;
        const barColor: ColorToken = pct >= 90 ? "error" : pct >= 70 ? "warning" : "muted";
        frags.push({ text: ` ${renderBar(ratio)}`, color: barColor });
      }
      if (showPct) {
        frags.push({ text: ` ${Math.round(ratio * 100)}%`, color: "muted" });
        if (s.contextTokens !== null && s.contextWindow > 0) {
          frags.push({ text: ` ${formatTokenCount(s.contextTokens)}/${formatTokenCount(s.contextWindow)}`, color: "muted" });
        }
      }
      if (display.showTokens) {
        frags.push({ text: ` · ↑${formatTokenCount(s.usage.input)} ↓${formatTokenCount(s.usage.output)}`, color: "muted" });
      }
      const cacheDenominator = s.usage.cacheRead + s.usage.input;
      if (cacheDenominator > 0) {
        const hit = Math.round((s.usage.cacheRead / cacheDenominator) * 100);
        frags.push({ text: ` · cache ${hit}%`, color: "muted" });
      }
      return frags.length > 1 ? frags : null;
    },
  };
}
