// test/ledger.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLedgerStore, localDayIndex } from "../src/ledger/store.ts";

const SGT = 480; // UTC+8 fixed-offset fixture (RECTOR SGT day boundary)

function entry(id: string, iso: string, cost: number) {
  return {
    type: "message",
    id,
    timestamp: iso,
    message: { role: "assistant", usage: { input: 1, output: 1, cost: { total: cost } } },
  };
}

function line(id: string, ts: number, cost: number, model = "glm-5.2") {
  return JSON.stringify({
    id, ts, provider: "zai", model,
    input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost,
  });
}

test("localDayIndex buckets timestamps by fixed offset", () => {
  // 2026-08-30T16:30:00Z is 2026-08-31 00:30 SGT — next day under SGT, same day under UTC.
  const ts = Date.UTC(2026, 7, 30, 16, 30);
  assert.equal(localDayIndex(ts, 480), localDayIndex(Date.UTC(2026, 7, 31, 0, 30), 480));
  assert.notEqual(localDayIndex(ts, 480), localDayIndex(ts, 0));
});

test("reconcile appends unseen usage entries once and is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({ filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT });
  store.load();
  const entries = [
    entry("a1", "2026-08-30T09:00:00.000Z", 0.5),
    entry("a2", "2026-08-30T09:05:00.000Z", 0.25),
  ];
  assert.equal(store.reconcile(entries), 2);
  assert.equal(store.reconcile(entries), 0); // second pass: all seen — double-count impossible
  const raw = readFileSync(filePath, "utf8").trim().split("\n");
  assert.equal(raw.length, 2);
  assert.deepEqual(JSON.parse(raw[0]!), { id: "a1", provider: "unknown", model: "unknown", repo: "unknown", cost: 0.5, ts: Date.parse("2026-08-30T09:00:00.000Z"), input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 });
  rmSync(dir, { recursive: true, force: true });
});

test("reconcile skips entries without ids or usage", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const store = createLedgerStore({ filePath: join(dir, "l.jsonl"), utcOffsetMinutes: SGT });
  store.load();
  const n = store.reconcile([
    { type: "message", message: { role: "assistant", usage: { cost: { total: 1 } } } },
    { type: "message", id: "u", message: { role: "user" } },
    { type: "custom", id: "c" },
  ]);
  assert.equal(n, 0);
  rmSync(dir, { recursive: true, force: true });
});

test("load seeds the seen-set from an existing file (restart-safe)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  writeFileSync(filePath, `${line("a1", Date.UTC(2026, 7, 30, 9, 0), 0.5)}\n`);
  const store = createLedgerStore({ filePath, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT });
  store.load();
  assert.equal(store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 0.5)]), 0);
  rmSync(dir, { recursive: true, force: true });
});

test("malformed lines are skipped on scan and warn fires at most once", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  writeFileSync(filePath, `not-json\n${line("a1", 1, 0.5)}\n{"id":"bad"}\n`);
  const warnings: string[] = [];
  const store = createLedgerStore({ filePath, utcOffsetMinutes: SGT, warn: (m) => warnings.push(m) });
  store.load();
  assert.equal(warnings.length, 1); // two malformed lines, one warning
  assert.equal(store.reconcile([entry("a2", "2026-08-30T09:00:00.000Z", 1)]), 1);
  rmSync(dir, { recursive: true, force: true });
});

test("getSnapshot aggregates today/7d/30d and 7-day sparkline by local day", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const now = Date.UTC(2026, 7, 30, 10, 0); // 18:00 SGT, still Aug 30 local
  // today (2 entries), yesterday (1), 8 days ago (outside 7d, inside 30d), 40 days ago (outside 30d)
  const lines = [
    line("t1", Date.UTC(2026, 7, 30, 1, 0), 1.0),
    line("t2", Date.UTC(2026, 7, 30, 3, 0), 0.24),
    line("y1", Date.UTC(2026, 7, 29, 3, 0), 2.0),
    line("w1", Date.UTC(2026, 7, 22, 3, 0), 4.0),
    line("o1", Date.UTC(2026, 6, 21, 3, 0), 8.0),
  ].join("\n");
  writeFileSync(filePath, `${lines}\n`);
  const store = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: SGT });
  store.load();
  const snap = store.getSnapshot();
  assert.deepEqual(snap.todayCost, 1.24);
  assert.deepEqual(snap.last7Cost, 1.24 + 2.0);
  assert.deepEqual(snap.last30Cost, 1.24 + 2.0 + 4.0);
  assert.equal(snap.daily.length, 7);
  assert.deepEqual(snap.daily[6], 1.24); // today, newest
  assert.deepEqual(snap.daily[5], 2.0); // yesterday
  assert.deepEqual(snap.daily[0], 0);   // 6 days ago — no spend
  rmSync(dir, { recursive: true, force: true });
});

test("reconcile creates the ledger directory when missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "pi-statusline", "ledger.jsonl");
  const store = createLedgerStore({ filePath, utcOffsetMinutes: SGT });
  store.load();
  store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 0.5)]);
  assert.ok(existsSync(filePath));
  rmSync(dir, { recursive: true, force: true });
});

test("reconcile never throws on persist failure — fail-open, counts persisted only, warns once (spec §10)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-blocked-"));
  const blockingDir = join(dir, "blocking-dir"); // filePath IS a directory → appendFileSync throws EISDIR
  mkdirSync(blockingDir);
  const warnings: string[] = [];
  // Fixed clock: the assertion pins entries to 2026-08-30 and reads day-scoped todayCost —
  // real wall-clock made this fail once the calendar rolled past Aug 30 (SGT).
  const store = createLedgerStore({ filePath: blockingDir, now: () => Date.UTC(2026, 7, 30, 10, 0), utcOffsetMinutes: SGT, warn: (m) => warnings.push(m) });
  store.load();
  const entries = [
    entry("b1", "2026-08-30T09:00:00.000Z", 0.5),
    entry("b2", "2026-08-30T09:01:00.000Z", 0.25),
  ];
  assert.equal(store.reconcile(entries), 0, "returns persisted count — 0 when the disk write fails");
  assert.doesNotThrow(() => store.reconcile(entries), "render-path call must never throw (spec §10)");
  assert.ok(warnings.length >= 1, "a cause-bearing warning fired");
  const appendWarn = warnings.find((w) => /ledger append failed for entry b1/.test(w));
  assert.ok(appendWarn, "the append-failure warning carries the entry id + cause");
  assert.match(appendWarn, /EISDIR/, "cause-bearing (the underlying error message)");
  // Fail-open + seen-marked: the in-memory snapshot still reflects the entries (no double count on retry).
  const snap = store.getSnapshot();
  assert.equal(snap.todayCost, 0.75, "in-memory totals stay consistent (disk lost, memory kept)");
  rmSync(dir, { recursive: true, force: true });
});

test("NaN cost entries are recorded as 0 (guard against JSON null round-trip re-append)", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-nan-"));
  const filePath = join(dir, "ledger.jsonl");
  const store = createLedgerStore({ filePath, utcOffsetMinutes: SGT });
  store.load();
  const nanEntry = {
    type: "message",
    id: "nan1",
    timestamp: "2026-08-30T09:00:00.000Z",
    message: { role: "assistant", usage: { input: 1, output: 1, cost: { total: Number.NaN } } },
  };
  assert.equal(store.reconcile([nanEntry as never]), 1);
  const raw = JSON.parse(readFileSync(filePath, "utf8").trim().split("\n")[0]!);
  assert.equal(raw.cost, 0, "NaN cost persisted as 0 — reload parses it, no per-restart re-append");
  rmSync(dir, { recursive: true, force: true });
});

test("repo attribution: lines record cwd basename; repoCost sums only the current repo", () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  const filePath = join(dir, "ledger.jsonl");
  const now = Date.UTC(2026, 7, 30, 10, 0);
  // `store` is re-created mid-test to re-scan the file after direct writes.
  let store = createLedgerStore({
    filePath, now: () => now, utcOffsetMinutes: SGT,
    repo: () => "pi-statusline",
  });
  store.load();
  const other = JSON.stringify({ id: "x1", ts: now, provider: "unknown", model: "unknown", repo: "other-repo", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: 5 });
  writeFileSync(filePath, `${other}\n`);
  store = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: SGT, repo: () => "pi-statusline" });
  store.load();
  store.reconcile([entry("a1", "2026-08-30T09:00:00.000Z", 1.24)]);
  const snap = store.getSnapshot();
  assert.deepEqual(snap.repoCost, 1.24); // other-repo's 5.00 excluded
  const raw = readFileSync(filePath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(raw[1]!.repo, "pi-statusline");
  // Lines WITHOUT repo (pre-P2) default to "unknown" and never count toward repoCost.
  // (Appended — the brief's draft wrote the file wholesale, clobbering the prior lines
  // and making this assertion vacuously 0.)
  const legacy = JSON.stringify({ id: "x2", ts: now, provider: "unknown", model: "unknown", input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: 2 });
  appendFileSync(filePath, `${legacy}\n`);
  const store2 = createLedgerStore({ filePath, now: () => now, utcOffsetMinutes: SGT, repo: () => "pi-statusline" });
  store2.load();
  assert.deepEqual(store2.getSnapshot().repoCost, 1.24);
  rmSync(dir, { recursive: true, force: true });
});
