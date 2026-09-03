// test/tui-status.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStatusMessage, type StatusInput } from "../src/tui/status.ts";

const BASE: StatusInput = {
  version: "0.5.1",
  rows: ["identity", "model+ctx", "money", "quota", "deen", "ambient"],
  lastRender: {
    at: 1_000_000_000_000,
    lines: ["identity line", " glm-5.3-flash · max | Ctx: 0% | Tokens: 0 in / 0 out", "REPO $1 | DAY $2"],
  },
  now: 1_000_000_000_000 + 12_000,
  session: { provider: "zai", model: "glm-5.3-flash", thinking: "max", contextPercent: 23 },
  adapters: [
    { id: "zai", state: "ok", detail: "5h 34%/53% · weekly 25%/11% · fetched 3m ago" },
    { id: "or", state: "inert", detail: "no openrouter.key" },
  ],
  deen: { detail: "Jakarta · next Dhuhr 11:52 (4h 16m) · fresh" },
  git: { detail: "main · clean · 27 commits today" },
  ledger: { detail: "REPO $1.82 · DAY $1.60 · 7DAY $276.19" },
};

test("header: version + current rows", () => {
  const msg = formatStatusMessage(BASE);
  const first = msg.split("\n")[0]!;
  assert.match(first, /^pi-statusline 0\.5\.1 — rows: identity, model\+ctx, money, quota, deen, ambient/);
});

test("last render block: age + every rendered line (ground truth of what the user sees)", () => {
  const msg = formatStatusMessage(BASE);
  assert.match(msg, /rendered 12s ago/);
  assert.match(msg, /L1: identity line/);
  assert.match(msg, /L3: REPO \$1 \| DAY \$2/);
});

test("age buckets: never / seconds / minutes / hours", () => {
  assert.match(formatStatusMessage({ ...BASE, lastRender: null }, ), /rendered: never/);
  assert.match(
    formatStatusMessage({ ...BASE, now: BASE.lastRender!.at + 90_000 }),
    /rendered 1m ago/,
  );
  assert.match(
    formatStatusMessage({ ...BASE, now: BASE.lastRender!.at + 3_600_000 }),
    /rendered 1h ago/,
  );
});

test("sources block: session, adapters, deen, git, ledger — one line each", () => {
  const msg = formatStatusMessage(BASE);
  assert.match(msg, /session\s+→ zai\/glm-5.3-flash · thinking max · ctx 23%/);
  assert.match(msg, /zai\s+→ ok — 5h 34%\/53%/);
  assert.match(msg, /or\s+→ inert — no openrouter\.key/);
  assert.match(msg, /deen\s+→ Jakarta · next Dhuhr/);
  assert.match(msg, /git\s+→ main · clean · 27 commits today/);
  assert.match(msg, /ledger\s+→ REPO \$1\.82/);
});

test("long rendered lines are truncated to 100 chars", () => {
  const long = "x".repeat(300);
  const msg = formatStatusMessage({ ...BASE, lastRender: { at: BASE.lastRender!.at, lines: [long] } });
  const line = msg.split("\n").find((l) => l.includes("L1:"))!;
  assert.ok(line.length < 120, `line too long: ${line.length}`);
});
