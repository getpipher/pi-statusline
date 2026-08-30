// src/rows/money.ts
import { formatMoney, renderSparkline } from "../format.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createMoneyRow(): Row {
  return {
    id: "money",
    priority: 2,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const { usage } = snapshot.session;
      const ledger = snapshot.ledger;
      // CC-style shape: no standalone "$" label — folded into each value; REPO leads when > 0.
      const frags: Fragment[] = [];
      if (detail >= 1 && ledger.repoCost > 0) frags.push({ text: `REPO $${formatMoney(ledger.repoCost)}`, color: "text" });
      // Session cost is pi-native real data (D4) — works for every provider.
      frags.push({ text: `${frags.length ? " | " : ""}$${formatMoney(usage.cost)} sess`, color: "text" });
      if (detail >= 1) frags.push({ text: ` | $${formatMoney(ledger.todayCost)} day`, color: "success" });
      if (detail >= 2) {
        frags.push({ text: ` | $${formatMoney(ledger.last7Cost)} 7d`, color: "success" });
        frags.push({ text: ` | $${formatMoney(ledger.last30Cost)} 30d`, color: "success" });
        if (snapshot.config.display.sparkline) {
          const spark = renderSparkline(ledger.daily);
          if (spark) frags.push({ text: ` ${spark}`, color: "success" });
        }
      }

      // Burn rate = session cost over active-session wall time; needs ≥2 usage entries.
      if (detail >= 1) {
        if (usage.count >= 2 && snapshot.session.spanMs > 0) {
          const perHour = usage.cost / (snapshot.session.spanMs / 3_600_000);
          frags.push({ text: ` | $${formatMoney(perHour)}/hr`, color: "muted" });
        } else {
          frags.push({ text: " | —", color: "muted" });
        }
      }
      return frags;
    },
  };
}
