// src/rows/context.ts
import { formatTokenCount } from "../format.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createContextRow(): Row {
  return {
    id: "ctx",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const s = snapshot.session;
      const display = snapshot.config.display;
      const frags: Fragment[] = [{ text: "ctx", color: "dim" }];

      // Ratio: precomputed percent when present, else tokens/window. The bar was removed
      // in v0.4.1 (RECTOR) — plain percent + tokens read cleaner; `display.bars` is inert.
      const ratio =
        s.contextPercent !== null && Number.isFinite(s.contextPercent)
          ? s.contextPercent / 100
          : s.contextTokens !== null && s.contextWindow > 0
            ? s.contextTokens / s.contextWindow
            : null;

      const showPct = display.showContext && ratio !== null;
      if (showPct) {
        frags.push({ text: ` ${Math.round(ratio * 100)}%`, color: "text" });
        if (detail >= 2 && s.contextTokens !== null && s.contextWindow > 0) {
          frags.push({ text: ` ${formatTokenCount(s.contextTokens)}/${formatTokenCount(s.contextWindow)}`, color: "text" });
        }
      }
      if (display.showTokens && detail >= 1) {
        frags.push({ text: ` | ↑${formatTokenCount(s.usage.input)} ↓${formatTokenCount(s.usage.output)}`, color: "toolTitle" });
      }
      if (detail >= 2) {
        const cacheDenominator = s.usage.cacheRead + s.usage.input;
        if (cacheDenominator > 0) {
          const hit = Math.round((s.usage.cacheRead / cacheDenominator) * 100);
          frags.push({ text: ` | cache ${hit}%`, color: "muted" });
        }
      }
      return frags.length > 1 ? frags : null;
    },
  };
}
