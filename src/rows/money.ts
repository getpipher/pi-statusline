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
      if (detail >= 1) frags.push({ text: ` | DAY $${formatMoney(ledger.todayCost)}`, color: "success" });
      if (detail >= 2) {
        frags.push({ text: ` | 7DAY $${formatMoney(ledger.last7Cost)}`, color: "success" });
        frags.push({ text: ` | 30DAY $${formatMoney(ledger.last30Cost)}`, color: "success" });
        // API-equivalence marker (RECTOR): the $ meter is tokens × published API rates —
        // i.e. what this usage would cost on pay-as-you-go. Labels the comparison at a glance.
        frags.push({ text: " api-eq", color: "dim" });
        if (snapshot.config.display.sparkline) {
          const spark = renderSparkline(ledger.daily);
          if (spark) frags.push({ text: ` ${spark}`, color: "success" });
        }
        // Plan benefit: with the flat Coding Plan price configured, the 30DAY rolling
        // API-equivalent minus that price = what the plan saved this month. Understated
        // while the ledger is younger than 30 days (honest — we only count recorded days).
        const plan = snapshot.config.zai.planPrice;
        if (plan > 0 && ledger.last30Cost > plan) {
          frags.push({ text: ` | plan saves $${Math.round(ledger.last30Cost - plan)}/mo`, color: "success" });
        }
      }

      // Burn rate: block-anchored (CC-style) when configured + window data exists;
      // otherwise session cost over active-session wall time (needs ≥2 usage entries).
      if (detail >= 1) {
        const anchor = snapshot.config.display.burnAnchor ?? "session";
        const win = snapshot.quotaWindow;
        const elapsedMs = win ? snapshot.now - win.startMs : 0;
        if (anchor === "block" && win && elapsedMs >= 60_000 && snapshot.now <= win.endMs) {
          const perHour = win.cost / (elapsedMs / 3_600_000);
          frags.push({ text: ` | $${formatMoney(perHour)}/hr`, color: "muted" });
        } else if (usage.count >= 2 && snapshot.session.spanMs > 0) {
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
