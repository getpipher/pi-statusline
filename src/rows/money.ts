// src/rows/money.ts
import { formatMoney } from "../format.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createMoneyRow(): Row {
  return {
    id: "money",
    priority: 2,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const ledger = snapshot.ledger;
      // v0.4.6 (FB6): CCS label-first money row — REPO | DAY | 7DAY | 30DAY. Session cost,
      // api-eq marker, sparkline, and burn rate were removed (RECTOR: redundant declutter).
      const frags: Fragment[] = [];
      if (detail >= 1 && ledger.repoCost > 0) frags.push({ text: `REPO $${formatMoney(ledger.repoCost)}`, color: "text" });
      if (detail >= 1) frags.push({ text: `${frags.length ? " | " : ""}DAY $${formatMoney(ledger.todayCost)}`, color: "success" });
      if (detail >= 2) {
        frags.push({ text: ` | 7DAY $${formatMoney(ledger.last7Cost)}`, color: "success" });
        frags.push({ text: ` | 30DAY $${formatMoney(ledger.last30Cost)}`, color: "success" });
      }
      return frags.length > 0 ? frags : null;
    },
  };
}
