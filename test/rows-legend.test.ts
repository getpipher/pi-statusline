// test/rows-legend.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsLegendMessage } from "../src/tui/legend.ts";
import { KNOWN_ROW_IDS } from "../src/types.ts";

test("first line: current order + valid list (existing contract)", () => {
  const msg = rowsLegendMessage(["ctx", "identity"]);
  const first = msg.split("\n")[0]!;
  assert.match(first, /^Rows: ctx, identity /);
  assert.match(first, /\(valid: identity, ctx, money, quota, deen, ambient\)/);
});

test("legend lines follow the CURRENT order, one per row, with a → sample", () => {
  const msg = rowsLegendMessage(["quota", "deen", "ctx", "money", "identity", "ambient"]);
  const lines = msg.split("\n").slice(1).filter((l) => l.trim());
  assert.equal(lines.length, KNOWN_ROW_IDS.length);
  assert.match(lines[0]!, /^\s*quota\s+→/);
  assert.match(lines[1]!, /^\s*deen\s+→/);
  for (const id of KNOWN_ROW_IDS) {
    assert.ok(msg.includes(`${id} →`) || new RegExp(`${id}\\s+→`).test(msg), `legend line for ${id}`);
  }
});

test("each sample hints at the row's real fragments", () => {
  const msg = rowsLegendMessage([...KNOWN_ROW_IDS]);
  assert.match(msg, /identity\s+→.*model/);
  assert.match(msg, /ctx\s+→.*Cache/);
  assert.match(msg, /money\s+→.*REPO/);
  assert.match(msg, /quota\s+→.*5HRS/);
  assert.match(msg, /deen\s+→.*Fajr/);
  assert.match(msg, /ambient\s+→.*clock/);
});
