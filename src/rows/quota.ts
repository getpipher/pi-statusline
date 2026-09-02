// src/rows/quota.ts
import { resolveQuotaAdapter, type AdapterSegment, type ProviderRowAdapter } from "../adapters/types.ts";
import type { ColorToken, Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// Usage heat mirrors the ctx escalation bands: accent <70%, warning ≥70%, error ≥90%.
// Null/absent heat → neutral muted.
function heatColorFromValue(heat: number | null | undefined): ColorToken {
  if (heat === null || heat === undefined || !Number.isFinite(heat)) return "muted";
  if (heat >= 90) return "error";
  if (heat >= 70) return "warning";
  return "accent";
}

function heatColor<D>(adapter: ProviderRowAdapter<D>, data: D): ColorToken {
  return heatColorFromValue(adapter.heat?.(data));
}

// Segment color: dim wins when the adapter's provider is inactive; else the segment's
// explicit color override; else its own heat mapping (5h% and weekly% tint independently).
function segmentColor<D>(adapter: ProviderRowAdapter<D>, data: D, seg: AdapterSegment, dim: boolean): ColorToken {
  if (dim) return "dim";
  return seg.color ?? heatColorFromValue(seg.heat ?? adapter.heat?.(data));
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

      const frags: Fragment[] = [];
      if (winner.segments) {
        for (const seg of winner.segments(data, snapshot.now)) {
          frags.push({ text: seg.text, color: segmentColor(winner, data, seg, dim) });
        }
      } else {
        frags.push({ text: winner.render(data, dim), color: dim ? "dim" : heatColor(winner, data) });
      }
      return frags;
    },
  };
}
