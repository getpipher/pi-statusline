// test/rows-registry.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { createRowRegistry, renderRows, type Row, type RowSnapshot } from "../src/rows/registry.ts";

function fakeRow(id: Row["id"], priority: 1 | 2 | 3, text: string): Row {
  return {
    id,
    priority,
    render: (_snapshot, _detail) => text.split("").map((ch) => ({ text: ch, color: "muted" as const })),
  };
}

/** Detail-aware row: renders widths[2 − detail] — deterministic shrink for phase-S tests. */
function shrinkingRow(id: Row["id"], priority: 1 | 2 | 3, widths: { 2: string; 1: string; 0: string }): Row {
  return {
    id,
    priority,
    render: (_snapshot, detail) => widths[detail].split("").map((ch) => ({ text: ch, color: "muted" as const })),
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
    deen: null,
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

// ── v2 responsive: progressive detail shrink (phase S) before drop (phase D) ──

test("phase S: the widest overflowing row steps 2→1→0 before anything drops", () => {
  // a=20 chars at detail 2, 12 at 1, 4 at 0; b/c are short priority-2/3 rows that fit.
  const a = shrinkingRow("identity", 1, { 2: "a".repeat(20), 1: "a".repeat(12), 0: "aaaa" });
  const b = shrinkingRow("money", 2, { 2: "b".repeat(6), 1: "bbb", 0: "b" });
  const cc = shrinkingRow("ambient", 3, { 2: "c".repeat(6), 1: "ccc", 0: "c" });
  const reg = createRowRegistry([a, b, cc]);
  const order = ["identity", "money", "ambient"] as const;

  // Width 13: a(20) overflows → shrink to 12 → fits. Nothing drops; short rows stay at detail 2.
  let out = renderRows(reg, [...order], makeSnapshot(13));
  assert.equal(out.length, 3, "no row dropped when shrinking fits");
  assert.equal(out[0]!.map((f) => f.text).join(""), "a".repeat(12), "widest row shrank one level");
  assert.equal(out[1]!.map((f) => f.text).join(""), "b".repeat(6), "short row never shrank when it fits");

  // Width 5: a(20) → 12 → 4 fits at detail 0; b/c (6 chars) each shrink one level to fit.
  out = renderRows(reg, [...order], makeSnapshot(5));
  assert.equal(out.length, 3, "everything alive when shrunk forms fit");
  assert.equal(out[0]!.map((f) => f.text).join(""), "aaaa", "widest row reached detail 0");
  assert.equal(out[1]!.map((f) => f.text).join(""), "bbb", "overflowing short row shrank one level");
});

test("phase D fires only when even detail-0 overflows", () => {
  // a's detail-0 form is still 8 chars; at width 4 it must DROP (priority 1 never drops —
  // use priority 2 for the droppable variant) after exhausting its detail levels.
  const a = shrinkingRow("money", 2, { 2: "a".repeat(20), 1: "a".repeat(14), 0: "a".repeat(8) });
  const b = shrinkingRow("identity", 1, { 2: "bbbb", 1: "bbb", 0: "bb" });
  const reg = createRowRegistry([b, a]);
  const out = renderRows(reg, ["identity", "money"], makeSnapshot(4));
  assert.equal(out.length, 1, "droppable row still overflowing at detail 0 is dropped");
  assert.equal(out[0]!.map((f) => f.text).join(""), "bbbb", "priority-1 row survives at full detail");
});

test("phase S tie-break: equal overflow widths → later display order shrinks first", () => {
  const x = shrinkingRow("identity", 1, { 2: "x".repeat(10), 1: "x".repeat(4), 0: "xx" });
  const y = shrinkingRow("ctx", 1, { 2: "y".repeat(10), 1: "y".repeat(4), 0: "yy" });
  const reg = createRowRegistry([x, y]);
  // Width 9: both overflow at 10 chars. y (later display) shrinks first to 4 → fits;
  // x stays at 10 — but 10 > 9, so x then shrinks too (to 4). Both at 4, nothing drops.
  const out = renderRows(reg, ["identity", "ctx"], makeSnapshot(9));
  assert.equal(out.length, 2);
  assert.equal(out[0]!.map((f) => f.text).join(""), "x".repeat(4), "x shrank only after y's shrink failed to clear the overflow");
  assert.equal(out[1]!.map((f) => f.text).join(""), "y".repeat(4), "y shrank first (later display order)");
});
