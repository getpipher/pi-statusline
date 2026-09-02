// src/rows/quota.ts
import { resolveQuotaAdapter, type ProviderRowAdapter } from "../adapters/types.ts";
import { projectBlock } from "../quota/project.ts";
import { formatTokenCount } from "../format.ts";
import type { ColorToken, Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// Usage heat mirrors the ctx bar's escalation bands: accent <70%, warning ≥70%,
// error ≥90%. Adapters without heat() render neutral muted.
function heatColor<D>(adapter: ProviderRowAdapter<D>, data: D): ColorToken {
  const heat = adapter.heat?.(data);
  if (heat === null || heat === undefined || !Number.isFinite(heat)) return "muted";
  if (heat >= 90) return "error";
  if (heat >= 70) return "warning";
  return "accent";
}

export function createQuotaRow(adapters: ProviderRowAdapter<any>[]): Row {
  return {
    id: "quota",
    priority: 2,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const winner = resolveQuotaAdapter(adapters, snapshot.session.provider);
      const data = winner?.current();
      if (!winner || data === null || data === undefined) return null;
      const dim = !winner.matches(snapshot.session.provider);
      const color: ColorToken = dim ? "dim" : heatColor(winner, data);
      const frags: Fragment[] = [{ text: winner.render(data, dim), color }];
      // Est rides the ACTIVE provider's row only (a dim subscription projection is
      // noise), and is the quota row's first shrink casualty (detail >= 2).
      if (detail >= 2 && !dim) {
        const proj = projectBlock(data as Parameters<typeof projectBlock>[0], snapshot.now);
        if (proj) {
          frags.push({ text: ` | est ${formatTokenCount(proj.units)} (${proj.percent}%)`, color: "text" });
        }
      }
      return frags;
    },
  };
}
