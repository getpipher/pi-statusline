// src/rows/ambient.ts
import { formatClock, formatSpan } from "../format.ts";
import type { Row, RowSnapshot } from "./registry.ts";

export function createAmbientRow(): Row {
  return {
    id: "ambient",
    priority: 3,
    render(snapshot: RowSnapshot): NonNullable<ReturnType<Row["render"]>> {
      const frags: Array<{ text: string; color: "dim" }> = [
        { text: formatClock(snapshot.now), color: "dim" },
        { text: ` | coding ${formatSpan(snapshot.session.spanMs)}`, color: "dim" },
      ];
      // v1 good-citizen preservation: other extensions' setStatus text surfaces here.
      // The 30s ticker re-renders, which re-pulls statuses (fixes v1's refresh gap).
      if (snapshot.statuses) {
        frags.push({ text: ` | ${snapshot.statuses}`, color: "dim" });
      }
      return frags;
    },
  };
}
