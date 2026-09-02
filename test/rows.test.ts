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
    git: null,
    quotaWindow: null,
    versions: { sl: "0.4.0", pi: "0.84.4" },
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

// ── context (ctx) row ──
import { createContextRow } from "../src/rows/context.ts";

const CTX_SESSION = session({
  usage: { input: 48_000, output: 6200, cacheRead: 100_000, cacheWrite: 0, cost: 0, count: 5 },
  contextTokens: 68_000,
  contextWindow: 200_000,
  contextPercent: 34,
});

// v0.4.6 (FB6): CCS adoption — `Ctx: 34% (68.0K/200.0K) | Tokens: 48.0K in / 6.2K out |
// Cache: 68% hit`; pct traffic-light (CCS defaults: <50 success, 50–89 warning, ≥90 error).
test("ctx row CCS: Ctx:/Tokens:/Cache: labels, traffic-light pct, human tokens (detail 2)", () => {
  const row = createContextRow();
  const frags = row.render(snap({ session: CTX_SESSION }), 2)!;
  assert.deepEqual(frags, [
    { text: "Ctx:", color: "dim" },
    { text: " 34%", color: "success" },
    { text: " (68.0K/200.0K)", color: "success" },
    { text: " | Tokens: 48.0K in / 6.2K out", color: "toolTitle" },
    { text: " | Cache: 68% hit", color: "success" },
  ]);
});

test("ctx row CCS: pct traffic-light bands — success <50, warning 50–89, error ≥90", () => {
  const row = createContextRow();
  const colorAt = (pct: number) =>
    row.render(snap({ session: { ...CTX_SESSION, contextPercent: pct } }), 0)![1]!.color;
  assert.equal(colorAt(49), "success");
  assert.equal(colorAt(50), "warning");
  assert.equal(colorAt(89), "warning");
  assert.equal(colorAt(90), "error");
});

test("ctx row CCS: detail 1 drops window + cache; detail 0 pct only", () => {
  const row = createContextRow();
  const one = plain(row.render(snap({ session: CTX_SESSION }), 1)!);
  assert.equal(one, "Ctx: 34% | Tokens: 48.0K in / 6.2K out");
  const zero = plain(row.render(snap({ session: CTX_SESSION }), 0)!);
  assert.equal(zero, "Ctx: 34%");
});

test("ctx row CCS: cache hit uses cacheRead/(cacheRead+input); omitted when denominator 0", () => {
  const row = createContextRow();
  const out = plain(row.render(snap({ session: CTX_SESSION }), 2));
  assert.ok(out.includes("Cache: 68% hit")); // 100_000/(100_000+48_000) = 0.6757… → Math.round → 68
  const zero = row.render(snap({ session: session({ usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 } }) }), 2);
  assert.ok(!plain(zero).includes("cache"));
});

test("ctx row CCS: percent falls back to tokens/window when contextPercent is null", () => {
  const row = createContextRow();
  const out = plain(row.render(snap({ session: { ...CTX_SESSION, contextPercent: null } }), 0)!);
  assert.equal(out, "Ctx: 34%"); // 68_000/200_000 = 34%
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
    { text: " | DAY $8.40", color: "success" },
    { text: " | 7DAY $31.20", color: "success" },
    { text: " | 30DAY $118.75", color: "success" },
    { text: " api-eq", color: "dim" },
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
  assert.ok(one.includes("REPO $12.34") && one.includes("$1.24 sess") && one.includes("DAY $8.40") && one.includes("$0.39/hr"), `detail 1: ${one}`);
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

// ── Task 4: quota row est fragment ──
import { createQuotaRow } from "../src/rows/quota.ts";
import type { ProviderRowAdapter } from "../src/adapters/types.ts";
import type { QuotaResult } from "../src/quota/zai.ts";

const QUOTA_DATA: QuotaResult = {
  tier: "lite",
  fiveHour: {
    unit: 3, number: 5, usage: 2000, currentValue: 1500, remaining: 500,
    percentage: 75,
    nextResetTime: Date.UTC(2026, 7, 30, 12, 0),
  },
  weekly: null,
  fetchedAt: Date.UTC(2026, 7, 30, 10, 0),
};

// Projection math (projectBlock, Task 3): start = reset − 5h = 07:00Z; at NOW 08:00Z
// elapsed = 1h (≥ 60s gate), remaining = 4h, usage 2000 > 0 → rate 1500/h →
// projected 1500 + 1500×4 = 7500 → "7.5k", percent round(7500/2000×100) = 375.
// (The brief's "4.5k (225%)" mixed a 1h elapsed with a 2h remaining — impossible
// for reset 12:00 / NOW 08:00. Numbers re-derived from projectBlock's code.)
const NOW = Date.UTC(2026, 7, 30, 8, 0);

function fakeAdapter(renderText = "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h"): ProviderRowAdapter<QuotaResult> {
  return {
    id: "zai",
    matches: (p) => p === "zai",
    current: () => QUOTA_DATA,
    fetch: async () => QUOTA_DATA,
    render: () => renderText,
    // heat: percentage 75 → "warning" (≥70 band); without heat() the row renders
    // neutral "muted", so the fake must expose it to pin the adapter-fragment color.
    heat: (d) => d.fiveHour?.percentage ?? null,
    start: () => {},
    stop: () => {},
  };
}

test("quota row detail 2: est fragment appended (projected units + %)", () => {
  const row = createQuotaRow([fakeAdapter()]);
  const frags = row.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 2)!;
  assert.deepEqual(frags, [
    { text: "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h", color: "warning" },
    { text: " | est 7.5k (375%)", color: "text" },
  ]);
});

test("quota row detail 1: est dropped, adapter string only (shrink-before-drop contract)", () => {
  const row = createQuotaRow([fakeAdapter()]);
  const frags = row.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 1)!;
  assert.deepEqual(frags, [{ text: "zai ▕███████░░░▏ 75% 1.5k/2.0k 5h", color: "warning" }]);
});

test("quota row est omitted for dim (inactive) provider and when projection is null", () => {
  const row = createQuotaRow([fakeAdapter()]);
  // inactive provider → dim → no est
  const dimFrags = row.render(snap({ now: NOW, session: session({ provider: "anthropic" }) }), 2)!;
  assert.equal(dimFrags.length, 1);
  // projection null (weekly-only data) → no est
  const noFiveHour = createQuotaRow([{
    ...fakeAdapter(),
    current: () => ({ ...QUOTA_DATA, fiveHour: null }),
  }]);
  const frags = noFiveHour.render(snap({ now: NOW, session: session({ provider: "zai" }) }), 2)!;
  assert.equal(frags.length, 1);
});

// ── Task 5: burn anchor ──
const BURN_BLOCK = { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, burnAnchor: "block" as const } };
const BURN_SESSION_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 99, count: 5 };

test("money row block anchor: $/hr from quotaWindow cost over block elapsed", () => {
  const s = snap({
    now: Date.UTC(2026, 7, 30, 9, 0),
    ledger: LEDGER,
    quotaWindow: { startMs: Date.UTC(2026, 7, 30, 7, 0), endMs: Date.UTC(2026, 7, 30, 12, 0), cost: 3.0 },
    config: BURN_BLOCK,
    session: session({ usage: BURN_SESSION_USAGE, spanMs: 60_000 }),
  });
  const frags = createMoneyRow().render(s, 1)!;
  assert.ok(frags.some((f) => f.text === " | $1.50/hr"), `expected block burn, got: ${frags.map((f) => f.text).join("")}`); // 3.0 over 2h
});

test("money row block anchor falls back to session when window missing/young/stale", () => {
  // quotaWindow null → session formula (99 cost over 1h span)
  const s1 = snap({
    ledger: LEDGER,
    config: BURN_BLOCK,
    session: session({ usage: BURN_SESSION_USAGE, spanMs: 3_600_000 }),
  });
  assert.ok(createMoneyRow().render(s1, 1)!.some((f) => f.text === " | $99.00/hr"));
  // elapsed < 60s → session fallback too
  const s2 = snap({
    ledger: LEDGER,
    quotaWindow: { startMs: Date.UTC(2026, 7, 30, 8, 59, 30), endMs: Date.UTC(2026, 7, 30, 12, 0), cost: 3.0 },
    config: BURN_BLOCK,
    session: session({ usage: BURN_SESSION_USAGE, spanMs: 3_600_000 }),
    now: Date.UTC(2026, 7, 30, 9, 0),
  });
  assert.ok(createMoneyRow().render(s2, 1)!.some((f) => f.text === " | $99.00/hr"));
  // now past endMs (stale window) → session fallback too — covers the now ≤ endMs guard
  const s3 = snap({
    ledger: LEDGER,
    quotaWindow: { startMs: Date.UTC(2026, 7, 30, 7, 0), endMs: Date.UTC(2026, 7, 30, 9, 0), cost: 3.0 },
    config: BURN_BLOCK,
    session: session({ usage: BURN_SESSION_USAGE, spanMs: 3_600_000 }),
    now: Date.UTC(2026, 7, 30, 9, 30),
  });
  assert.ok(createMoneyRow().render(s3, 1)!.some((f) => f.text === " | $99.00/hr"));
});

// ── Task 6: version stamps ──

test("ambient versions fragment: gated by showVersions + detail 2; PI omitted when null", () => {
  const row = createAmbientRow();
  const cfg = { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, showVersions: true } };
  const on = row.render(snap({ config: cfg, session: session({}) }), 2)!;
  assert.deepEqual(on.slice(-2), [
    { text: " | SL:0.4.0", color: "dim" },
    { text: " · PI:0.84.4", color: "dim" },
  ]);
  const noPi = row.render(snap({ config: cfg, session: session({}), versions: { sl: "0.4.0", pi: null } }), 2)!;
  assert.deepEqual(noPi.slice(-1), [{ text: " | SL:0.4.0", color: "dim" }]);
  // off by default
  const off = row.render(snap({ session: session({}) }), 2)!;
  assert.ok(!off.some((f) => f.text.includes("SL:")));
  // detail 1 → omitted (periphery, same gate as statuses)
  const d1 = row.render(snap({ config: cfg, session: session({}) }), 1)!;
  assert.ok(!d1.some((f) => f.text.includes("SL:")));
});

// ── Task 7: git wiring ──

test("identity row: dirty * and ahead/behind ride the branch fragment (detail >= 1 only)", () => {
  const row = createIdentityRow();
  const g = { dirty: true, ahead: 2, behind: 1, commitsToday: 4 };
  const frags = row.render(snap({ session: session({ branch: "main" }), git: g }), 2)!;
  assert.deepEqual(frags[2], { text: " ⎇ main", color: "toolTitle" });
  assert.deepEqual(frags[3], { text: "*", color: "toolTitle" });
  assert.deepEqual(frags[4], { text: " ↑2 ↓1", color: "toolTitle" });
  // clean + no upstream → no extra fragments (model follows the branch directly)
  const clean = row.render(snap({ session: session({ branch: "main" }), git: { dirty: false, ahead: null, behind: null, commitsToday: 0 } }), 2)!;
  assert.deepEqual(clean[3], { text: " | glm-5.2", color: "accent" });
  assert.equal(clean.length, 4);
  // detail 1 with branch → marks still render; detail 0 (no branch) → none
  assert.ok(row.render(snap({ session: session({ branch: "main" }), git: g }), 1)!.some((f) => f.text === "*"));
  assert.ok(!row.render(snap({ session: session({ branch: "main" }), git: g }), 0)!.some((f) => f.text === "*"));
});

test("ambient row: commits-today fragment at detail >= 1, dim", () => {
  const row = createAmbientRow();
  const frags = row.render(snap({ session: session({}), git: { dirty: false, ahead: null, behind: null, commitsToday: 4 } }), 1)!;
  assert.ok(frags.some((f) => f.text === " | commits 4" && f.color === "dim"));
  const none = row.render(snap({ session: session({}), git: { dirty: false, ahead: null, behind: null, commitsToday: null } }), 1)!;
  assert.ok(!none.some((f) => f.text.includes("commits")));
});
