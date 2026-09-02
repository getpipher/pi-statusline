import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { activateStatusline } from "../src/index.ts";
import type { QuotaResult } from "../src/quota/zai.ts";
import type { ProviderRowAdapter } from "../src/adapters/types.ts";
import type { DeenSource, DeenSnapshot } from "../src/deen/source.ts";

type Handler = (...args: unknown[]) => unknown;
type Command = { handler: (args: string | undefined, ctx: ExtensionContext) => Promise<void> };
type FooterComponent = { render(width: number): string[]; dispose(): void; invalidate(): void };
type FooterFactory = (
  tui: { requestRender(): void },
  theme: { fg(color: string, text: string): string },
  data: {
    getGitBranch(): string;
    getExtensionStatuses(): ReadonlyMap<string, string>;
    onBranchChange(callback: () => void): () => void;
  },
) => FooterComponent;

const QUOTA: QuotaResult = {
  tier: "lite",
  fiveHour: {
    unit: 3,
    number: 5,
    usage: 2000,
    currentValue: 1500,
    remaining: 500,
    percentage: 75,
    nextResetTime: Date.now() + 3_600_000,
  },
  weekly: {
    unit: 6,
    number: 1,
    usage: 10000,
    currentValue: 1500,
    remaining: 8500,
    percentage: 15,
    nextResetTime: Date.now() + 86_400_000,
  },
  fetchedAt: Date.now(),
};

// The wiring harness: fake pi/ctx/tui/theme/footerData in the v1 shape, v2 entry
// fixtures (id + ISO timestamp + usage.cost.total), and a fake adapter injected
// whole through makeAdapters (the makePoller seam is gone).
function makeHarness() {
  const tmp = mkdtempSync(join(tmpdir(), "pi-statusline-wiring-"));
  const configPath = join(tmp, "pi-statusline.json");
  const handlers = new Map<string, Handler>();
  const commands = new Map<string, Command>();
  const colors: Array<{ color: string; text: string }> = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string>([
    ["fleet", "fleet ready"],
    ["memory", "memory warm"],
  ]);
  let renderRequests = 0;
  let setFooterCalls = 0;
  const footerHolder: { current: FooterComponent | null } = { current: null };

  const tui = { requestRender: () => { renderRequests++; } };
  const theme = {
    fg: (color: string, text: string): string => {
      colors.push({ color, text });
      return text;
    },
  };
  const footerData = {
    getGitBranch: () => "main",
    getExtensionStatuses: () => statuses,
    onBranchChange: (callback: () => void) => { branchChangeCallback = callback; return () => {}; },
  };
  let branchChangeCallback: (() => void) | null = null;

  const model = {
    provider: "zai",
    id: "glm-5.2",
    name: "GLM 5.2",
    api: "openai-completions",
    baseUrl: "https://api.z.ai",
  };
  // v2 entry fixtures: id + ISO timestamp + cost.total (ledger + money row inputs).
  const entries = [
    {
      type: "message",
      id: "msg-1",
      timestamp: "2026-08-30T09:00:00.000Z",
      message: { role: "assistant", usage: { input: 500, output: 200, cost: { total: 0.25 } } },
    },
    {
      type: "message",
      id: "msg-2",
      timestamp: "2026-08-30T09:05:00.000Z",
      message: { role: "assistant", usage: { input: 1000, output: 500, cost: { total: 0.75 } } },
    },
  ];

  const ctxObject = {
    model,
    sessionManager: {
      getEntries: () => entries,
      getSessionName: () => "wiring-smoke",
      getBranch: () => { throw new Error("token totals must use getEntries()"); },
    },
    getContextUsage: () => ({ tokens: 50_000, contextWindow: 200_000, percent: 25 }),
    ui: {
      setFooter: (factory: FooterFactory | undefined) => {
        setFooterCalls++;
        footerHolder.current?.dispose();
        footerHolder.current = factory ? factory(tui, theme, footerData) : null;
      },
      notify: (message: string, level: string) => notifications.push({ message, level }),
    },
  };
  const ctx = ctxObject as unknown as ExtensionContext;

  const piObject = {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    registerCommand: (name: string, command: Command) => commands.set(name, command),
  };

  // Controllable fake git source (Task 7): data set by the test, refreshes recorded.
  const gitRefreshes: Array<boolean | undefined> = [];
  let gitData: import("../src/git/source.ts").GitSnapshot | null = null;
  const fakeGitSource = {
    refresh: (force?: boolean) => { gitRefreshes.push(force); },
    get: () => gitData,
  };
  const pi = piObject as unknown as ExtensionAPI;

  let started = 0;
  let stopped = 0;
  let fetched = 0;
  const fakeZaiAdapter: ProviderRowAdapter<QuotaResult> = {
    id: "zai",
    matches: (p) => p === "zai",
    current: () => QUOTA,
    fetch: async () => { fetched++; return QUOTA; },
    render: (_d: QuotaResult, dim: boolean) => (dim ? "zai-dim" : "zai-quota-line"),
    start: () => { started++; },
    stop: () => { stopped++; },
  };

  return {
    tmp, configPath, handlers, commands, colors, notifications, renderRequests: () => renderRequests,
    setFooterCalls: () => setFooterCalls, footerHolder, ctxObject, ctx, pi,
    fakeZaiAdapter, fakeGitSource,
    git: {
      set: (d: import("../src/git/source.ts").GitSnapshot | null) => { gitData = d; },
      refreshes: () => [...gitRefreshes],
      triggerBranchChange: () => branchChangeCallback?.(),
    },
    counters: { get started() { return started; }, get stopped() { return stopped; }, get fetched() { return fetched; } },
  };
}

test("v2 wiring: multi-line render, matrix dimming, ledger, commands, dispose", async () => {
  const h = makeHarness();
  try {
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
          makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
    });

    // (1) session_start → setFooter once; multi-line render (≥4 rows).
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.equal(h.setFooterCalls(), 1);
    assert.ok(h.footerHolder.current);
    const lines = h.footerHolder.current.render(500);
    assert.ok(lines.length >= 4, `expected ≥4 rows, got ${lines.length}`);
    const flat = lines.join("\n");
    // identity
    assert.match(flat, /wiring-smoke/);
    assert.match(flat, /glm-5\.2/);
    assert.match(flat, /⎇ main/);
    // ctx
    assert.match(flat, /↑1\.5k ↓700/);
    assert.match(flat, /25%/);
    // money
    assert.match(flat, /sess/);
    // quota line, colored muted (active provider)
    assert.ok(lines.some((l) => l.includes("zai-quota-line")), "quota line present");
    assert.equal(h.colors.find((c) => c.text.includes("zai-quota-line"))?.color, "muted");
    // ambient
    assert.match(flat, /fleet ready | memory warm/);

    // (2) provider switch zai → anthropic → quota line dimmed (A5-refined preserved).
    h.colors.length = 0;
    h.ctxObject.model.provider = "anthropic";
    h.ctxObject.model.id = "claude-sonnet-4";
    h.handlers.get("model_select")?.({ model: { provider: "anthropic", id: "claude-sonnet-4" } }, h.ctx);
    assert.ok(h.renderRequests() > 0, "model_select forces a re-render");
    const switchedLines = h.footerHolder.current.render(500);
    const switchedFlat = switchedLines.join("\n");
    assert.match(switchedFlat, /claude-sonnet-4/, "identity shows the switched model");
    assert.ok(switchedLines.some((l) => l.includes("zai-dim")), "quota line dims for non-matching provider");
    assert.equal(h.colors.find((c) => c.text.includes("zai-dim"))?.color, "dim");

    // (3) adapter with current() → null: quota row absent, money row still honest.
    {
      const h2 = makeHarness();
      try {
        // Local-provider shape: entries WITHOUT cost data (the 0.00-sess honesty case).
        for (const e of h2.ctxObject.sessionManager.getEntries() as Array<{ message: { usage: Record<string, unknown> } }>) {
          delete e.message.usage.cost;
        }
        activateStatusline(h2.pi, {
          authJsonPath: join(h2.tmp, "auth.json"),
          configPath: h2.configPath,
          ledgerPath: join(h2.tmp, "ledger.jsonl"),
          readKey: () => "fixture-key",
          makeGitSource: () => h2.fakeGitSource,
          makeAdapters: () => [{ ...h2.fakeZaiAdapter, current: () => null }],
        });
        h2.handlers.get("session_start")?.({}, h2.ctx);
        assert.ok(h2.footerHolder.current, "scenario-3 footer installed");
        const lines2 = h2.footerHolder.current.render(500);
        const flat2 = lines2.join("\n");
        assert.ok(!lines2.some((l) => l.includes("zai-quota-line") || l.includes("zai-dim")), "quota row omitted when adapter holds no data");
        assert.match(flat2, /0\.00 sess/, "money row still renders (session honesty)");
      } finally {
        h2.footerHolder.current?.dispose();
        rmSync(h2.tmp, { recursive: true, force: true });
      }
    }

    // (4) ledger integration: file exists, one line per usage entry, reconcile idempotent.
    const ledgerPath = join(h.tmp, "ledger.jsonl");
    assert.ok(existsSync(ledgerPath), "ledger file created on session_start");
    let raw = readFileSync(ledgerPath, "utf8").trim().split("\n");
    assert.equal(raw.length, 2, "one line per usage entry");
    const ids = raw.map((l) => (JSON.parse(l) as { id: string }).id);
    assert.ok(ids.includes("msg-1") && ids.includes("msg-2"), "ledger ids match fixtures");
    h.footerHolder.current.render(500); // re-render → reconcile again
    h.footerHolder.current.render(500);
    raw = readFileSync(ledgerPath, "utf8").trim().split("\n");
    assert.equal(raw.length, 2, "reconcile idempotent through the wiring (no duplicates)");

    // (5) /statusline commands: refresh → fetch + notify; off → yield + stop; on → reinstall + restart; tier persists.
    const command = h.commands.get("statusline");
    assert.ok(command);
    await command.handler("refresh", h.ctx);
    assert.ok(h.counters.fetched > 0, "refresh calls adapter.fetch");
    assert.ok(h.notifications.some((n) => n.message.includes("Quota refreshed")));
    await command.handler("off", h.ctx);
    // Opaque probe: a direct null check narrows the property type for the rest of the
    // test body (TS keeps property narrowing across awaited calls) — route it through a
    // helper so no narrowing survives.
    const footerIsNull = (f: { current: FooterComponent | null }): boolean => f.current === null;
    assert.ok(footerIsNull(h.footerHolder), "off yields to the native footer");
    assert.ok(h.counters.stopped >= 1, "off stops adapters");
    await command.handler("on", h.ctx);
    const reinstalled = h.footerHolder.current;
    assert.ok(reinstalled, "on reinstalls the footer");
    assert.ok(h.counters.started >= 2, "on restarts adapters");
    await command.handler("tier pro", h.ctx);
    const persisted = JSON.parse(readFileSync(h.configPath, "utf8")) as { zai: { tier: string } };
    assert.equal(persisted.zai.tier, "pro");
    assert.ok(h.notifications.some(({ message }) => message.includes("Tier override set to pro")));

    // (6) unknown-row notify fires once per id per session.
    {
      const h3 = makeHarness();
      try {
        writeFileSync(h3.configPath, JSON.stringify({ display: { rows: ["identity", "bogus"] } }));
        activateStatusline(h3.pi, {
          authJsonPath: join(h3.tmp, "auth.json"),
          configPath: h3.configPath,
          ledgerPath: join(h3.tmp, "ledger.jsonl"),
          readKey: () => "fixture-key",
          makeGitSource: () => h3.fakeGitSource,
          makeAdapters: () => [h3.fakeZaiAdapter],
        });
        h3.handlers.get("session_start")?.({}, h3.ctx);
        const first = h3.notifications.filter((n) => n.message.includes("bogus"));
        assert.equal(first.length, 1, "exactly one unknown-row notify");
        assert.ok(first[0] && (first[0].level === "info" || first[0].level === "warning"), `level is info|warning, got ${first[0]?.level}`);
        h3.handlers.get("session_start")?.({}, h3.ctx);
        const second = h3.notifications.filter((n) => n.message.includes("bogus"));
        assert.equal(second.length, 1, "one-time per id per session");
      } finally {
        h3.footerHolder.current?.dispose();
        rmSync(h3.tmp, { recursive: true, force: true });
      }
    }

    // (7) perf smoke: sync render under 50ms (design budget <1ms; loose CI bound).
    const perfFooter = h.footerHolder.current;
    assert.ok(perfFooter, "footer present for perf smoke");
    const t0 = process.hrtime.bigint();
    perfFooter.render(500);
    const ms = Number(process.hrtime.bigint() - t0) / 1_000_000;
    assert.ok(ms < 50, `render(500) took ${ms.toFixed(2)}ms (< 50ms CI bound)`);

    // (8) dispose() stops the adapter and clears the install guard → reinstall works.
    const disposeFooter = h.footerHolder.current;
    assert.ok(disposeFooter, "footer present for dispose check");
    const stoppedBeforeDispose = h.counters.stopped;
    disposeFooter.dispose();
    assert.ok(h.counters.stopped > stoppedBeforeDispose, "dispose stops adapters");
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.ok(h.footerHolder.current, "install guard cleared — session_start reinstalls");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P2 wiring: DeenSource lifecycle, snapshot.deen, /statusline deen command ──

const DEEN_SNAPSHOT: DeenSnapshot = {
  schedule: [
    { name: "Fajr", wallMin: 276, minutesUntil: -300, state: "past" },
    { name: "Dhuhr", wallMin: 720, minutesUntil: 120, state: "next" },
    { name: "Asr", wallMin: 920, minutesUntil: 320, state: "upcoming" },
    { name: "Maghrib", wallMin: 1080, minutesUntil: 500, state: "upcoming" },
    { name: "Isha", wallMin: 1170, minutesUntil: 660, state: "upcoming" },
  ],
  escalation: "calm", hijri: "17 Rabīʿ al-awwal 1448", city: "Jakarta",
  timezone: "Asia/Jakarta", staleMinutes: null,
};

test("v2 P2 wiring: deen source flows to the footer; session_start + deen command refresh; P2-19 bare money lead", async () => {
  const h = makeHarness();
  let deenRefreshes = 0;
  let forcedRefreshes = 0;
  const fakeDeen: DeenSource = {
    current: () => DEEN_SNAPSHOT,
    refresh: async (force?: boolean) => { deenRefreshes += 1; if (force) forcedRefreshes += 1; },
    geo: () => null,
  };
  try {
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
          makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
      deenCachePath: join(h.tmp, "deen-cache.json"),
      makeDeenSource: () => fakeDeen,
    });

    // (1) session_start → deen source refreshed + the strip renders with hijri + city.
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.ok(deenRefreshes >= 1, "session_start refreshes the deen source");
    // Refresh completion must trigger a re-render (cold-cache first paint): without it
    // the deen row stays absent until the 30s ticker. session_start itself requests
    // no render, so any increase here comes from refreshDeen's .then.
    const renderBefore = h.renderRequests();
    await new Promise((r) => setImmediate(r)); // let the async refresh + .then settle
    assert.ok(h.renderRequests() > renderBefore, "deen refresh completion requests a re-render");
    assert.ok(h.footerHolder.current, "footer installed");
    const lines = h.footerHolder.current.render(500);
    const flat = lines.join("\n");
    // v2 responsive: the deen label is gone (RECTOR) — the strip starts at the first prayer.
    assert.match(flat, /Fajr .*✓.*Dhuhr.*(2h)/, "deen strip with past ✓ + next countdown");
    assert.match(flat, /17 Rabīʿ al-awwal 1448/, "hijri flowed via snapshot.deen");
    assert.match(flat, /Jakarta/, "city flowed via snapshot.deen");

    // (2) reinstall scenario: a second session_start refreshes again (source survives).
    const before = deenRefreshes;
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.ok(deenRefreshes > before, "second session_start refreshes the deen source again");

    // Fix wave (review): the ledger repo accessor is wired (basename(cwd) — "pi-statusline"
    // under the test runner), so both harness entries attribute to it → repoCost 1.00
    // (0.25 + 0.75) and the money row leads with the all-time REPO total.
    const moneyLine = lines.find((l) => l.includes(" sess"));
    assert.ok(moneyLine, "money line present");
    assert.match(moneyLine, /REPO \$1\.00/, "REPO all-time total renders end-to-end (repo accessor wired)");
    assert.ok(!/^\s*\|/.test(moneyLine), "no orphan leading separator");

    // (3) /statusline deen Mecca → persisted + notified + forced refresh.
    const command = h.commands.get("statusline");
    assert.ok(command);
    await command.handler("deen Mecca", h.ctx);
    const persisted = JSON.parse(readFileSync(h.configPath, "utf8")) as { deen: { city: string } };
    assert.equal(persisted.deen.city, "Mecca");
    assert.ok(h.notifications.some((n) => n.message.includes("Deen location set to Mecca")), "notify sent");
    assert.ok(forcedRefreshes >= 1, "forced (force=true) refresh after setting the city");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

test("v2 P2 wiring: null deen snapshot → row omitted, no crash", async () => {
  const h = makeHarness();
  const fakeNull: DeenSource = {
    current: () => null,
    refresh: async () => {},
    geo: () => null,
  };
  try {
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
          makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
      deenCachePath: join(h.tmp, "deen-cache.json"),
      makeDeenSource: () => fakeNull,
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    const lines = h.footerHolder.current!.render(500);
    assert.ok(lines.length >= 4, "other rows unaffected");
    assert.ok(!lines.some((l) => l.includes("Fajr") || l.includes("Rabīʿ")), "deen line absent when current() is null");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P3 wiring: burnAnchor "block" — $/hr from the zai 5h window + ledger.costSince ──

test("v2 P3 wiring: burnAnchor block derives $/hr from quotaWindow cost", async () => {
  const h = makeHarness();
  try {
    // Window: QUOTA.fiveHour.nextResetTime = (module-load) now + 1h → window ≈ [now−4h, now+1h].
    // Put both usage entries inside that window (now−2h, now−1h) with cost 0.5 + 1.0.
    const now = Date.now();
    const entries = h.ctxObject.sessionManager.getEntries() as Array<{
      timestamp: string;
      message: { usage: { cost: { total: number } } };
    }>;
    entries[0]!.timestamp = new Date(now - 2 * 3_600_000).toISOString();
    entries[1]!.timestamp = new Date(now - 3_600_000).toISOString();
    entries[0]!.message.usage.cost = { total: 0.5 };
    entries[1]!.message.usage.cost = { total: 1.0 };

    writeFileSync(h.configPath, JSON.stringify({ display: { burnAnchor: "block" } }));
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
          makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.ok(h.footerHolder.current, "footer installed");
    const moneyLine = h.footerHolder.current.render(500).find((l) => l.includes(" sess"));
    assert.ok(moneyLine, "money line present");
    // Block cost 1.5; elapsed = renderNow − (reset − 5h) = 4h + δ where δ = module-load→render
    // drift (≪ 1s here) → perHour = 0.37499… → "$0.37/hr" — block-derived, NOT the
    // session formula (session span ≈ 0 would render a huge $/hr). δ would need to
    // exceed 394 s to flip the rounding — impossible for a single test run.
    assert.match(moneyLine, /\$0\.37\/hr/, `block burn on money line: ${moneyLine}`);
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P3 wiring: GitSource — refresh triggers + snapshot passthrough to rows ──

test("v2 P3 wiring: git source refreshes on session_start/branch change and feeds the rows", async () => {
  const h = makeHarness();
  try {
    writeFileSync(h.configPath, JSON.stringify({}));
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
      makeGitSource: () => h.fakeGitSource,
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    // session_start forces a git refresh
    assert.deepEqual(h.git.refreshes(), [true], "session_start → refresh(true)");

    // no data yet → no git marks anywhere
    const bare = h.footerHolder.current!.render(500).join("\n");
    assert.ok(!bare.includes("*") || !bare.includes("⎇ main*"), "no marks before data");

    // simulated data arrival → render picks up get() through the snapshot
    h.git.set({ dirty: true, ahead: 2, behind: 1, commitsToday: 4 });
    const flat = h.footerHolder.current!.render(500).join("\n");
    assert.match(flat, /⎇ main\* ↑2 ↓1/, "identity marks from snapshot.git");
    assert.match(flat, /\| commits 4/, "ambient commits-today from snapshot.git");

    // branch change → forced refresh + repaint
    const before = h.git.refreshes().length;
    h.git.triggerBranchChange();
    assert.deepEqual(h.git.refreshes().slice(before), [true], "onBranchChange → refresh(true)");
    assert.ok(h.renderRequests() > 0, "onBranchChange still requests a render");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P3 wiring: makeAdapters receives the ledger getter (ensureLedger runs first) ──

test("v2 P3 wiring: makeAdapters deps include a resolving ledger getter", async () => {
  const h = makeHarness();
  try {
    let seen: import("../src/ledger/store.ts").LedgerStore | null | undefined;
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
      makeGitSource: () => h.fakeGitSource,
      makeAdapters: (deps) => {
        seen = deps.ledger();
        return [h.fakeZaiAdapter];
      },
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    assert.ok(seen, "ledger getter resolves to the live store (ensureLedger ran before makeAdapters)");
    assert.equal(typeof seen!.providerTodayCost, "function", "store is the full LedgerStore (Task 1 queries present)");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P3 wiring: named theme presets — remap through theme.fg + one-time unknown notify ──

test("v2 P3 wiring: mono theme remaps hue tokens; unknown theme notifies once", async () => {
  // (a) mono: no success/toolTitle color names reach theme.fg; content unchanged
  {
    const h = makeHarness();
    try {
      writeFileSync(h.configPath, JSON.stringify({ display: { theme: "mono" } }));
      activateStatusline(h.pi, {
        authJsonPath: join(h.tmp, "auth.json"),
        configPath: h.configPath,
        ledgerPath: join(h.tmp, "ledger.jsonl"),
        readKey: () => "fixture-key",
        makeGitSource: () => h.fakeGitSource,
        makeAdapters: () => [h.fakeZaiAdapter],
      });
      h.handlers.get("session_start")?.({}, h.ctx);
      h.colors.length = 0;
      const flat = h.footerHolder.current!.render(500).join("\n");
      const colorNames = new Set(h.colors.map((c) => c.color));
      assert.ok(!colorNames.has("success"), `mono must flatten success, saw: ${[...colorNames]}`);
      assert.ok(!colorNames.has("toolTitle"), `mono must flatten toolTitle, saw: ${[...colorNames]}`);
      assert.ok(colorNames.has("text"), "flattened tokens land on text");
      assert.match(flat, /⎇ main/, "content unchanged — only token remap");
      assert.equal(h.notifications.filter((n) => n.message.includes("display.theme")).length, 0, "mono is known — no notify");
    } finally {
      h.footerHolder.current?.dispose();
      rmSync(h.tmp, { recursive: true, force: true });
    }
  }
  // (b) unknown theme: identity mapping + exactly ONE warning across two renders
  {
    const h = makeHarness();
    try {
      writeFileSync(h.configPath, JSON.stringify({ display: { theme: "nope" } }));
      activateStatusline(h.pi, {
        authJsonPath: join(h.tmp, "auth.json"),
        configPath: h.configPath,
        ledgerPath: join(h.tmp, "ledger.jsonl"),
        readKey: () => "fixture-key",
        makeGitSource: () => h.fakeGitSource,
        makeAdapters: () => [h.fakeZaiAdapter],
      });
      h.handlers.get("session_start")?.({}, h.ctx);
      h.colors.length = 0;
      h.footerHolder.current!.render(500);
      h.footerHolder.current!.render(500);
      const warns = h.notifications.filter((n) => n.message.includes('unknown display.theme "nope"'));
      assert.equal(warns.length, 1, "exactly one unknown-theme notify across two renders");
      assert.ok(warns[0] && warns[0].level === "warning", "notify level is warning");
      // identity fallback: hue tokens still reach theme.fg unchanged
      assert.ok(new Set(h.colors.map((c) => c.color)).has("toolTitle"), "unknown theme → default identity mapping");
    } finally {
      h.footerHolder.current?.dispose();
      rmSync(h.tmp, { recursive: true, force: true });
    }
  }
});

// ── v2 P3 wiring: /statusline rows — persist order + notify + re-render ──

test("v2 P3 wiring: rows command persists display order and notifies", async () => {
  const h = makeHarness();
  try {
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
      makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    const command = h.commands.get("statusline");
    assert.ok(command);

    // list-rows: notify with current order + valid hint
    await command.handler("rows", h.ctx);
    const listed = h.notifications.filter((n) => n.message.startsWith("Rows:"));
    assert.equal(listed.length, 1);
    assert.match(listed[0]!.message, /identity, ctx, money, quota, deen, ambient/);
    assert.match(listed[0]!.message, /\(valid: /);

    // set-rows: persisted to the config file + notify + re-render
    const before = h.renderRequests();
    await command.handler("rows deen,identity", h.ctx);
    const persisted = JSON.parse(readFileSync(h.configPath, "utf8")) as { display: { rows: string[] } };
    assert.deepEqual(persisted.display.rows, ["deen", "identity"]);
    assert.ok(h.notifications.some((n) => n.message === "Row order set: deen, identity"), "set-rows notify");
    assert.ok(h.renderRequests() > before, "set-rows forces a re-render");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});

// ── v2 P3 integration sweep: the assembled footer across the whole P3 surface ──

test("v2 P3 sweep: est + block burn + git marks + versions + mono, one render", async () => {
  const h = makeHarness();
  try {
    // Entries inside the active 5h window (block burn needs ledger cost there).
    const now = Date.now();
    const entries = h.ctxObject.sessionManager.getEntries() as Array<{
      timestamp: string;
      message: { usage: { cost: { total: number } } };
    }>;
    entries[0]!.timestamp = new Date(now - 2 * 3_600_000).toISOString();
    entries[1]!.timestamp = new Date(now - 3_600_000).toISOString();
    entries[0]!.message.usage.cost = { total: 0.5 };
    entries[1]!.message.usage.cost = { total: 1.0 };

    writeFileSync(h.configPath, JSON.stringify({
      display: { showVersions: true, burnAnchor: "block", theme: "mono" },
    }));
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
      makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    h.git.set({ dirty: true, ahead: 2, behind: 1, commitsToday: 4 });

    h.colors.length = 0;
    const lines = h.footerHolder.current!.render(500);
    const flat = lines.join("\n");

    // identity: branch + dirty mark + ahead/behind
    assert.match(flat, /⎇ main\* ↑2 ↓1/, "git marks beside the branch");
    // quota: est projection fragment rides the active provider's line
    const quotaLine = lines.find((l) => l.includes("zai-quota-line"));
    assert.ok(quotaLine, "quota line present");
    assert.match(quotaLine, / \| est \d+(\.\d+)?k \(\d+%\)/, `est fragment: ${quotaLine}`);
    // money: block-anchored burn (1.5 over ≈4h — see the Task 5 wiring test for the bounds)
    const moneyLine = lines.find((l) => l.includes(" sess"));
    assert.ok(moneyLine, "money line present");
    assert.match(moneyLine, /\$0\.37\/hr/, `block burn: ${moneyLine}`);
    // ambient: commits-today + version stamps
    const ambientLine = lines.find((l) => l.includes("commits 4"));
    assert.ok(ambientLine, "commits-today on ambient line");
    assert.match(ambientLine, /SL:\d/, "SL stamp on the same line");
    // mono: no hue tokens reach theme.fg; flattened tokens land on text
    const colorNames = new Set(h.colors.map((c) => c.color));
    assert.ok(!colorNames.has("success") && !colorNames.has("toolTitle"), `mono flattens hues, saw: ${[...colorNames]}`);
    assert.ok(colorNames.has("text"), "flattened tokens land on text");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});
