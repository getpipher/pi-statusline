// src/rows/quota.ts
import { resolveQuotaAdapter, type ProviderRowAdapter } from "../adapters/types.ts";
import type { ColorToken, Fragment } from "../types.ts";
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
    render(snapshot: RowSnapshot): Fragment[] | null {
      const winner = resolveQuotaAdapter(adapters, snapshot.session.provider);
      const data = winner?.current();
      if (!winner || data === null || data === undefined) return null;
      const dim = !winner.matches(snapshot.session.provider);
      const color: ColorToken = dim ? "dim" : heatColor(winner, data);
      return [{ text: winner.render(data, dim), color }];
    },
  };
}
