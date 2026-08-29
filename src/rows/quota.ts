// src/rows/quota.ts
import { resolveQuotaAdapter, type ProviderRowAdapter } from "../adapters/types.ts";
import type { Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createQuotaRow(adapters: ProviderRowAdapter<any>[]): Row {
  return {
    id: "quota",
    priority: 2,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const winner = resolveQuotaAdapter(adapters, snapshot.session.provider);
      const data = winner?.current();
      if (!winner || data === null || data === undefined) return null;
      const dim = !winner.matches(snapshot.session.provider);
      return [{ text: winner.render(data, dim), color: dim ? "dim" : "muted" }];
    },
  };
}
