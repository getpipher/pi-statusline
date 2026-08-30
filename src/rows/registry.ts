// src/rows/registry.ts
import { visibleWidth } from "@earendil-works/pi-tui";
import type { Fragment, RowDetail, RowId, RowPriority } from "../types.ts";
import type { StatuslineConfig } from "../config.ts";
import type { SessionSnapshot } from "../session/store.ts";
import type { LedgerSnapshot } from "../ledger/store.ts";
import type { DeenSnapshot } from "../deen/source.ts";

export interface RowSnapshot {
  now: number;
  width: number;
  session: SessionSnapshot;
  ledger: LedgerSnapshot;
  statuses: string;
  config: StatuslineConfig;
  deen: DeenSnapshot | null; // P2 — null until DeenSource provides data (row omitted)
  order?: RowId[]; // optional echo of the display order (unused by rows; kept for debugging)
}

export interface Row {
  id: RowId;
  priority: RowPriority;
  // null → row omitted (source unavailable/failed). Fragments own all spacing/separators;
  // the renderer joins them with "" and applies theme colors. `detail` is the responsive
  // level the registry requests (phase S shrinks widest-first before dropping).
  render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null;
}

export interface RowRegistry {
  get(id: RowId): Row | undefined;
  all(): Row[];
}

export function createRowRegistry(rows: Row[]): RowRegistry {
  const byId = new Map<string, Row>();
  for (const row of rows) byId.set(row.id, row);
  return {
    get: (id) => byId.get(id),
    all: () => rows.slice(),
  };
}

interface RenderedRow {
  row: Row;
  displayIndex: number;
  fragments: Fragment[];
  width: number;
  detail: RowDetail;
}

function lineWidth(frags: Fragment[]): number {
  return visibleWidth(frags.map((f) => f.text).join(""));
}

// Drop worst-first: higher priority number drops before lower; equal priority breaks by
// reverse display order (later row drops first — quota before money per spec §4.2).
function dropOrder(rendered: RenderedRow[]): RenderedRow[] {
  return [...rendered].sort((a, b) =>
    b.row.priority - a.row.priority || b.displayIndex - a.displayIndex
  );
}

export function renderRows(registry: RowRegistry, order: RowId[], snapshot: RowSnapshot): Fragment[][] {
  const resolved = order
    .map((id) => registry.get(id))
    .filter((row): row is Row => row !== undefined); // known-but-unregistered ids (deen in P1) skip silently

  const rendered: RenderedRow[] = [];
  resolved.forEach((row, displayIndex) => {
    const fragments = row.render(snapshot, 2);
    if (fragments && fragments.length > 0) {
      rendered.push({ row, displayIndex, fragments, width: lineWidth(fragments), detail: 2 });
    }
  });

  const width = snapshot.width;
  let current = rendered;

  // Phase S — progressive detail shrink: while any line overflows, re-render the WIDEST
  // overflowing row with detail > 0 one level down (tie → later display order). Each row
  // can shrink at most twice per render, so the phase terminates; detail never re-raises.
  for (;;) {
    const candidates = current.filter((r) => r.width > width && r.detail > 0);
    if (candidates.length === 0) break;
    const target = candidates
      .sort((a, b) => b.width - a.width || b.displayIndex - a.displayIndex)[0]!;
    target.detail = (target.detail - 1) as RowDetail;
    const next = target.row.render(snapshot, target.detail);
    if (next && next.length > 0) {
      target.fragments = next;
      target.width = lineWidth(next);
    }
  }

  // Phase D — whole-row drop (priority > 1 only; identity/ctx are never dropped).
  let droppable = dropOrder(current.filter((r) => r.row.priority > 1));
  while (droppable.length > 0 && current.some((r) => r.width > width)) {
    const worst = droppable.shift()!;
    current = current.filter((r) => r !== worst);
  }

  // Phase 2 — tail-fragment trim as last resort (all rows incl. priority 1; ≥1 fragment kept).
  for (const candidate of dropOrder(current)) {
    while (candidate.fragments.length > 1 && lineWidth(candidate.fragments) > width) {
      candidate.fragments = candidate.fragments.slice(0, -1);
    }
  }

  return current.map((r) => r.fragments);
}
