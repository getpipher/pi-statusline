import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { activateStatusline } from "../src/index.ts";
import type { QuotaResult } from "../src/quota/zai.ts";
import type { ProviderRowAdapter } from "../src/adapters/types.ts";

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
    onBranchChange: (_callback: () => void) => () => {},
  };

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
    fakeZaiAdapter, counters: { get started() { return started; }, get stopped() { return stopped; }, get fetched() { return fetched; } },
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
