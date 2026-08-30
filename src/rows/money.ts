// src/rows/money.ts
import { formatMoney, renderSparkline } from "../format.ts";
import type { Fragment } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createMoneyRow(): Row {
  return {
    id: "money",
    priority: 2,
    render(snapshot: RowSnapshot): Fragment[] | null {
      const { usage } = snapshot.session;
      const ledger = snapshot.ledger;
      const frags: Fragment[] = [{ text: "$", color: "dim" }];

      // Session cost is pi-native real data (D4) — works for every provider.
      frags.push({ text: ` ${formatMoney(usage.cost)} sess`, color: "text" });
      frags.push({ text: ` · ${formatMoney(ledger.todayCost)} day`, color: "muted" });
      frags.push({ text: ` · ${formatMoney(ledger.last7Cost)} 7d`, color: "muted" });
      frags.push({ text: ` · ${formatMoney(ledger.last30Cost)} 30d`, color: "muted" });

      if (snapshot.config.display.sparkline) {
        const spark = renderSparkline(ledger.daily);
        if (spark) frags.push({ text: ` ${spark}`, color: "accent" });
      }

      // Burn rate = session cost over active-session wall time; needs ≥2 usage entries.
      if (usage.count >= 2 && snapshot.session.spanMs > 0) {
        const perHour = usage.cost / (snapshot.session.spanMs / 3_600_000);
        frags.push({ text: ` · $${formatMoney(perHour)}/hr`, color: "muted" });
      } else {
        frags.push({ text: " · —", color: "muted" });
      }
      return frags;
    },
  };
}
