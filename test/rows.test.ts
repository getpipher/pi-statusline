// test/rows.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Row, RowSnapshot } from "../src/rows/registry.ts";
import { createIdentityRow } from "../src/rows/identity.ts";
import { createAmbientRow } from "../src/rows/ambient.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: Date.UTC(2026, 7, 30, 4, 12),
    width: 500,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: DEFAULT_CONFIG,
    deen: null,
    ...partial,
  };
}

function session(partial: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    sessionName: "v2-p1",
    repoName: "pi-statusline",
    branch: "main",
    modelId: "glm-5.2",
    provider: "zai",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
    contextTokens: null,
    contextWindow: 0,
    contextPercent: null,
    spanMs: (3 * 60 + 12) * 60_000,
    ...partial,
  };
}

function plain(frags: ReturnType<Row["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("identity row: session name bright lead, repo dim, branch mid with ⎇, model accent", () => {
  const row = createIdentityRow();
  const frags = row.render(snap({ session: session({}) }), 2)!;
  assert.deepEqual(frags, [
    { text: "v2-p1", color: "text" },
    { text: " pi-statusline", color: "dim" },
    { text: " ⎇ main", color: "toolTitle" },
    { text: " | glm-5.2", color: "accent" },
  ]);
});

test("identity row: detail 1 drops repo; detail 0 keeps name + model only", () => {
  const row = createIdentityRow();
  const one = plain(row.render(snap({ session: session({}) }), 1)!);
  assert.equal(one, "v2-p1 ⎇ main | glm-5.2");
  const zero = plain(row.render(snap({ session: session({}) }), 0)!);
  assert.equal(zero, "v2-p1 | glm-5.2");
  const noNameZero = plain(row.render(snap({ session: session({ sessionName: undefined }) }), 0)!);
  assert.equal(noNameZero, "glm-5.2", "unset name → bare model at detail 0 (no orphan separator)");
});

test("identity row: strips provider prefix and variant from model id", () => {
  const row = createIdentityRow();
  const out = plain(row.render(snap({ session: session({ modelId: "ollama/glm-5.2:cloud" }) }), 2));
  assert.ok(out.includes(" | glm-5.2"));
});

test("identity row: omits name when unset or showSession=false; omits branch when null", () => {
  const row = createIdentityRow();
  assert.equal(plain(row.render(snap({ session: session({ sessionName: undefined }) }), 2)), "pi-statusline ⎇ main | glm-5.2");
  const noSession = snap({ session: session({}), config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, showSession: false } } });
  assert.equal(plain(row.render(noSession, 2)), "pi-statusline ⎇ main | glm-5.2");
  assert.equal(plain(row.render(snap({ session: session({ branch: null }) }), 2)), "v2-p1 pi-statusline | glm-5.2");
});

const DEEN = {
  schedule: [
    { name: "Fajr", wallMin: 276, minutesUntil: -300, state: "past" },
    { name: "Dhuhr", wallMin: 720, minutesUntil: 120, state: "next" },
    { name: "Asr", wallMin: 920, minutesUntil: 320, state: "upcoming" },
    { name: "Maghrib", wallMin: 1080, minutesUntil: 500, state: "upcoming" },
    { name: "Isha", wallMin: 1170, minutesUntil: 660, state: "upcoming" },
  ],
  escalation: "calm", hijri: "17 Rabīʿ al-awwal 1448", city: "Jakarta",
  timezone: "Asia/Jakarta", staleMinutes: null,
} as const;

test("ambient row: clock, coding span, hijri + city (from deen), extension statuses", () => {
  const row = createAmbientRow();
  const frags = row.render(snap({ statuses: "fleet ready | memory warm", session: session({}), deen: DEEN as never }), 2)!;
  const d = new Date(Date.UTC(2026, 7, 30, 4, 12)); // same instant — local-getter (TZ-deterministic)
  const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  assert.deepEqual(frags, [
    { text: clock, color: "dim" },
    { text: " | coding 3h12m", color: "dim" },
    { text: " | 17 Rabīʿ al-awwal 1448", color: "muted" },
    { text: " | Jakarta", color: "muted" },
    { text: " | fleet ready | memory warm", color: "dim" },
  ]);
});

test("ambient row: hijri/city omitted when deen is null; detail 1 drops statuses; detail 0 clock only", () => {
  const row = createAmbientRow();
  const nullDeen = plain(row.render(snap({ statuses: "s", session: session({}), deen: null }), 2)!);
  assert.ok(!nullDeen.includes("Rabīʿ") && !nullDeen.includes("Jakarta"), "no hijri/city without deen data");
  const one = plain(row.render(snap({ statuses: "fleet ready", session: session({}), deen: DEEN as never }), 1)!);
  assert.ok(one.includes("17 Rabīʿ al-awwal 1448") && one.includes("Jakarta"), "hijri/city kept at detail 1");
  assert.ok(!one.includes("fleet ready"), "statuses dropped at detail 1");
  const zero = plain(row.render(snap({ statuses: "fleet ready", session: session({}), deen: DEEN as never }), 0)!);
  const d = new Date(Date.UTC(2026, 7, 30, 4, 12));
  const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  assert.equal(zero, clock, "detail 0 is the clock alone");
});

test("ambient row: clock is rendered from snapshot.now in local time", () => {
  const row = createAmbientRow();
  const d = new Date(Date.UTC(2026, 7, 30, 4, 12)); // same instant as the snap() fixture
  const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const out = plain(row.render(snap({ statuses: "", session: session({}) }), 2));
  assert.ok(out.startsWith(expected), `expected clock ${expected}, got: ${out}`);
  assert.ok(out.includes(" | coding 3h12m"));
  assert.ok(!out.endsWith(" ·")); // no dangling separator when statuses empty
});

// ── Task 7: context (ctx) row ──
import { createContextRow } from "../src/rows/context.ts";

const CTX_SESSION = session({
  usage: { input: 48_000, output: 6200, cacheRead: 100_000, cacheWrite: 0, cost: 0, count: 5 },
  contextTokens: 68_000,
  contextWindow: 200_000,
  contextPercent: 34,
});

test("ctx row: bar + percent + window + tokens + cache hit (detail 2; empty cells muted)", () => {
  const row = createContextRow();
  const frags = row.render(snap({ session: CTX_SESSION }), 2)!;
  assert.deepEqual(frags, [
    { text: "ctx", color: "dim" },
    { text: " ▕███", color: "accent" },
    { text: "░░░░░░░▏", color: "muted" },
    { text: " 34%", color: "text" },
    { text: " 68k/200k", color: "text" },
    { text: " | ↑48k ↓6.2k", color: "toolTitle" },
    { text: " | cache 68%", color: "muted" },
  ]);
});

test("ctx row: detail 1 drops window + cache; detail 0 drops tokens too", () => {
  const row = createContextRow();
  const one = plain(row.render(snap({ session: CTX_SESSION }), 1)!);
  assert.ok(one.includes("34%") && one.includes("↑48k ↓6.2k"), "detail 1: bar + % + tokens");
  assert.ok(!one.includes("68k/200k") && !one.includes("cache"), "detail 1: no window, no cache");
  const zero = plain(row.render(snap({ session: CTX_SESSION }), 0)!);
  assert.ok(zero.includes("34%"), "detail 0: bar + %");
  assert.ok(!zero.includes("↑") && !zero.includes("cache"), "detail 0: no tokens, no cache");
});

test("ctx row: bar tints warning at ≥70% and error at ≥90%", () => {
  const row = createContextRow();
  const warn = row.render(snap({ session: { ...CTX_SESSION, contextPercent: 75 } }), 2)!;
  assert.equal(warn[1]!.color, "warning");
  const err = row.render(snap({ session: { ...CTX_SESSION, contextPercent: 91 } }), 2)!;
  assert.equal(err[1]!.color, "error");
});

test("ctx row: cache hit uses cacheRead/(cacheRead+input); omitted when denominator 0", () => {
  const row = createContextRow();
  const out = plain(row.render(snap({ session: CTX_SESSION }), 2));
  assert.ok(out.includes("cache 68%")); // 100_000/(100_000+48_000) = 0.6757… → Math.round → 68
  const zero = row.render(snap({ session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 } }) }), 2);
  assert.ok(!plain(zero).includes("cache"));
});

// ── Task 8: money row ──
import { createMoneyRow } from "../src/rows/money.ts";

const LEDGER = {
  todayCost: 8.4,
  last7Cost: 31.2,
  last30Cost: 118.75,
  daily: [1, 2, 3, 5, 3, 2, 8.4],
  repoCost: 12.34,
};

test("money row: sess/day/7d/30d + sparkline + burn rate", () => {
  const row = createMoneyRow();
  const frags = row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: LEDGER,
  }), 2)!;
  // Sparkline: [1,2,3,5,3,2,8.4] scaled to max 8.4 → level = max(0, floor(v/max*7)-1)
  // (Task 1's pinned mapping) → ▁▁▂▄▂▁▇. Burn: cost 1.24 over span 3h12m = 1.24 / 3.2h = 0.3875 → "0.39".
  // CC-style shape (reconciled): no standalone "$" label — folded into each value; REPO lead when repoCost > 0.
  assert.deepEqual(frags, [
    { text: "REPO $12.34", color: "text" },
    { text: " | $1.24 sess", color: "text" },
    { text: " | $8.40 day", color: "success" },
    { text: " | $31.20 7d", color: "success" },
    { text: " | $118.75 30d", color: "success" },
    { text: " ▁▁▂▄▂▁▇", color: "success" },
    { text: " | $0.39/hr", color: "muted" },
  ]);
});

test("money row: burn rate renders — when fewer than 2 usage entries", () => {
  const row = createMoneyRow();
  const out = plain(row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 5, count: 1 } }),
    ledger: LEDGER,
  }), 2));
  assert.ok(out.includes(" | —"));
});

test("money row: sparkline omitted when display.sparkline=false", () => {
  const row = createMoneyRow();
  const cfgSnap = snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 2 } }),
    ledger: LEDGER,
    config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, sparkline: false } },
  });
  assert.ok(!plain(row.render(cfgSnap, 2)).includes("▁"));

  const one = plain(row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: LEDGER,
  }), 1));
  assert.ok(one.includes("REPO $12.34") && one.includes("$1.24 sess") && one.includes("$8.40 day") && one.includes("$0.39/hr"), `detail 1: ${one}`);
  assert.ok(!one.includes("7d") && !one.includes("30d") && !one.includes("▁"), "detail 1: no 7d/30d/sparkline");
  const zero = plain(row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: LEDGER,
  }), 0));
  assert.equal(zero, "$1.24 sess", "detail 0: session cost alone");
});

test("money row: REPO all-time total leads the row in bright text", () => {
  const row = createMoneyRow();
  const frags = row.render(snap({
    session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 1.24, count: 2 } }),
    ledger: { ...LEDGER, repoCost: 11529.35 },
  }), 2)!;
  assert.deepEqual(frags[0], { text: "REPO $11529.35", color: "text" });
  assert.deepEqual(frags[1], { text: " | $1.24 sess", color: "text" });
});
