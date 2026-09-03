// test/arrange-model.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDraftState, moveLine, selectLine, addComponent, removeLine, applyDraft,
} from "../src/tui/arrangeModel.ts";

const START = ["identity", "model+ctx", "money", "quota", "deen", "ambient"];

test("createDraftState: lines copied, selection 0", () => {
  const d = createDraftState(START);
  assert.deepEqual(d.lines, START);
  assert.equal(d.selected, 0);
});

test("moveLine: down then up, clamped at edges, original untouched", () => {
  const d = createDraftState(START);
  const down = moveLine(d, 1);
  assert.deepEqual(down.lines, ["model+ctx", "identity", "money", "quota", "deen", "ambient"]);
  assert.equal(down.selected, 1);
  const up = moveLine(down, -1);
  assert.deepEqual(up.lines, START);
  assert.equal(up.selected, 0);
  assert.equal(moveLine(d, -1).selected, 0, "clamped at top");
  assert.equal(moveLine(createDraftState(START), 99).selected, 0, "move past edge = stay put");
  assert.deepEqual(d.lines, START, "immutable: original untouched");
});

test("selectLine: clamps", () => {
  const d = createDraftState(START);
  assert.equal(selectLine(d, 3).selected, 3);
  assert.equal(selectLine(d, -5).selected, 0);
  assert.equal(selectLine(d, 99).selected, START.length - 1);
});

test("addComponent: appends deduped within the line", () => {
  const d = createDraftState(START);
  const withQuota = addComponent(d, 1, "quota");
  assert.equal(withQuota.lines[1], "model+ctx+quota");
  assert.equal(addComponent(withQuota, 1, "model").lines[1], "model+ctx+quota", "deduped within line = unchanged");
  assert.equal(addComponent(d, 99, "ctx"), d, "out-of-range lineIndex → unchanged");
});

test("removeLine: removes, selection clamps, applyDraft strips empties", () => {
  const d = createDraftState(START);
  const one = removeLine(d, 1);
  assert.deepEqual(one.lines, ["identity", "money", "quota", "deen", "ambient"]);
  assert.equal(one.selected, 1, "selection stays at removed index");
  let empty = createDraftState(START);
  for (let i = 0; i < 6; i++) empty = removeLine(empty, 0);
  assert.deepEqual(applyDraft(empty), [], "all removed → empty spec list");
  assert.equal(empty.selected, 0);
  assert.equal(removeLine(d, 99), d, "out-of-range → unchanged");
});

test("applyDraft: passes lines through verbatim", () => {
  const d = createDraftState(["identity", "model+ctx"]);
  assert.deepEqual(applyDraft(d), ["identity", "model+ctx"]);
});
