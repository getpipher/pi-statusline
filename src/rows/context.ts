// src/rows/context.ts
import { formatTokenCount, splitBar } from "../format.ts";
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
        // Two-tone bar: filled cells carry the escalation color (accent, warning ≥70%,
        // error ≥90%); empty cells stay dim so usage reads as a filled gauge.
        const pct = ratio * 100;
        const fillColor: ColorToken = pct >= 90 ? "error" : pct >= 70 ? "warning" : "accent";
        const { filled, empty } = splitBar(ratio);
        frags.push({ text: filled, color: fillColor });
        frags.push({ text: empty, color: "dim" });
      }
      if (showPct) {
        frags.push({ text: ` ${Math.round(ratio * 100)}%`, color: "text" });
        if (s.contextTokens !== null && s.contextWindow > 0) {
          frags.push({ text: ` ${formatTokenCount(s.contextTokens)}/${formatTokenCount(s.contextWindow)}`, color: "text" });
        }
      }
      if (display.showTokens) {
        frags.push({ text: ` · ↑${formatTokenCount(s.usage.input)} ↓${formatTokenCount(s.usage.output)}`, color: "text" });
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
