// test/rows-registry.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { createRowRegistry, renderRows, type Row, type RowSnapshot } from "../src/rows/registry.ts";

function fakeRow(id: Row["id"], priority: 1 | 2 | 3, text: string): Row {
  return {
    id,
    priority,
    render: () => text.split("").map((ch) => ({ text: ch, color: "muted" as const })),
  };
}

// widths: identity=4, ctx=4, money=7, quota=8, ambient=4 — quota is the widest
// priority-2 row, so the reverse-display tie-break (quota drops before money) is
// end-state observable at width 7.
const REGISTRY = createRowRegistry([
  fakeRow("identity", 1, "xxxx"),
  fakeRow("ctx", 1, "xxxx"),
  fakeRow("money", 2, "xxxxxxx"),
  fakeRow("quota", 2, "xxxxxxxx"),
  fakeRow("ambient", 3, "xxxx"),
]);
const ORDER = ["identity", "ctx", "money", "quota", "ambient"] as const;

function makeSnapshot(width: number): RowSnapshot {
  return {
    now: 0,
    width,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: null as never,
    order: [...ORDER],
  };
}

function ids(rendered: ReturnType<typeof renderRows>): string[] {
  return rendered.map((frags) => frags.map((f) => f.text).join(""));
}

test("all rows render untrimmed when width accommodates the widest line", () => {
  assert.deepEqual(ids(renderRows(REGISTRY, [...ORDER], makeSnapshot(20))),
    ["xxxx", "xxxx", "xxxxxxx", "xxxxxxxx", "xxxx"]);
});

test("null render omits a row without breaking others", () => {
  const registry = createRowRegistry([
    { id: "identity", priority: 1, render: () => null },
    fakeRow("ctx", 1, "xxxx"),
  ]);
  assert.deepEqual(ids(renderRows(registry, ["identity", "ctx"], makeSnapshot(50))), ["xxxx"]);
});

test("drop matrix: ambient (priority 3) drops first; tie-break drops quota before money", () => {
  // width 7: only quota (8) overflows. ambient is sacrificed first (priority 3) even
  // though it fits, then the p2 tie-break drops the LATER display row (quota) — money survives.
  assert.deepEqual(ids(renderRows(REGISTRY, [...ORDER], makeSnapshot(7))),
    ["xxxx", "xxxx", "xxxxxxx"]);
});

test("money drops after quota when both must go (width 4)", () => {
  assert.deepEqual(ids(renderRows(REGISTRY, [...ORDER], makeSnapshot(4))), ["xxxx", "xxxx"]);
});

test("priority-1 rows are never dropped as whole rows — they tail-trim instead", () => {
  const rendered = ids(renderRows(REGISTRY, [...ORDER], makeSnapshot(2)));
  assert.equal(rendered.length, 2); // identity + ctx survive at every width
  for (const line of rendered) {
    assert.ok(line.length >= 1, "trim keeps at least one fragment");
    assert.ok(visibleWidth(line) <= 2);
  }
});

test("unregistered known ids in order (deen in P1) are skipped silently", () => {
  assert.equal(renderRows(REGISTRY, [...ORDER, "deen"], makeSnapshot(50)).length, 5);
});

test("every returned line fits the width after trimming", () => {
  for (let w = 1; w <= 20; w++) {
    const rendered = renderRows(REGISTRY, [...ORDER], makeSnapshot(w));
    for (const frags of rendered) {
      const lineWidth = visibleWidth(frags.map((f) => f.text).join(""));
      assert.ok(lineWidth <= w, `width ${w} exceeded by line of ${lineWidth}`);
    }
    assert.ok(rendered.length >= 1, `width ${w} produced zero lines`);
  }
});
