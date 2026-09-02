// src/rows/ambient.ts
import { formatClock, formatSpan } from "../format.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createAmbientRow(): Row {
  return {
    id: "ambient",
    priority: 3,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const frags: Fragment[] = [{ text: formatClock(snapshot.now), color: "dim" }];
      if (detail >= 1) {
        frags.push({ text: ` | coding ${formatSpan(snapshot.session.spanMs)}`, color: "dim" });
        const g = snapshot.git;
        if (g && g.commitsToday !== null) {
          frags.push({ text: ` | commits ${g.commitsToday}`, color: "dim" });
        }
        // Hijri date + city moved here from the deen strip (RECTOR) — muted, deen-gated.
        if (snapshot.deen) {
          frags.push({ text: ` | ${snapshot.deen.hijri}`, color: "muted" });
          frags.push({ text: ` | ${snapshot.deen.city}`, color: "muted" });
        }
        // v1 good-citizen preservation: other extensions' setStatus text surfaces here.
        // The 30s ticker re-renders, which re-pulls statuses (fixes v1's refresh gap).
        if (detail >= 2 && snapshot.statuses) {
          frags.push({ text: ` | ${snapshot.statuses}`, color: "dim" });
        }
        // Version stamps (spec §15): SL = our package, PI = linked pi host package.
        // Periphery → dim, detail-2 only, off unless display.showVersions.
        if (detail >= 2 && snapshot.config.display.showVersions && snapshot.versions.sl) {
          frags.push({ text: ` | SL:${snapshot.versions.sl}`, color: "dim" });
          if (snapshot.versions.pi) frags.push({ text: ` · PI:${snapshot.versions.pi}`, color: "dim" });
        }
      }
      return frags;
    },
  };
}
