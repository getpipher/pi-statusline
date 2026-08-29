import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { activateStatusline } from "../src/index.ts";
import type { QuotaPoller, QuotaResult } from "../src/quota/zai.ts";

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

test("entry wiring uses real pi model, usage, token, status, and command shapes", async () => {
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
  const entries = [
    { type: "message", message: { role: "assistant", usage: { input: 500, output: 200 } } },
    { type: "message", message: { role: "assistant", usage: { input: 1000, output: 500 } } },
  ];

  const ctxObject = {
    model,
    sessionManager: {
      getEntries: () => entries,
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
  const poller: QuotaPoller = {
    get: () => QUOTA,
    start: () => {},
    stop: () => {},
    refresh: async () => {},
  };

  try {
    activateStatusline(pi, {
      authJsonPath: join(tmp, "auth.json"),
      configPath,
      readKey: () => "fixture-key",
      makePoller: () => poller,
    });

    handlers.get("session_start")?.({}, ctx);
    assert.equal(setFooterCalls, 1);
    assert.ok(footerHolder.current);

    const line = footerHolder.current.render(500)[0] ?? "";
    assert.match(line, /glm-5\.2/);
    assert.match(line, /↑1\.5k ↓700/);
    assert.match(line, /25%/);
    assert.match(line, /fleet ready · memory warm/);
    assert.equal(colors.find((entry) => entry.text.includes("⚡zai"))?.color, "text");

    colors.length = 0;
    ctxObject.model.provider = "anthropic";
    ctxObject.model.id = "claude-sonnet-4";
    handlers.get("model_select")?.({ model: { provider: "anthropic", id: "claude-sonnet-4" } }, ctx);
    assert.ok(renderRequests > 0);
    assert.ok(footerHolder.current);
    const switchedLine = footerHolder.current.render(500)[0] ?? "";
    assert.match(switchedLine, /claude-sonnet-4/);
    assert.equal(colors.find((entry) => entry.text.includes("⚡zai"))?.color, "dim");

    const command = commands.get("statusline");
    assert.ok(command);
    await command.handler("off", ctx);
    assert.equal(footerHolder.current, null);
    await command.handler("on", ctx);
    assert.ok(footerHolder.current);
    await command.handler("tier pro", ctx);

    const persisted = JSON.parse(readFileSync(configPath, "utf8")) as { zai: { tier: string } };
    assert.equal(persisted.zai.tier, "pro");
    assert.ok(notifications.some(({ message }) => message.includes("Tier override set to pro")));
  } finally {
    footerHolder.current?.dispose();
    rmSync(tmp, { recursive: true, force: true });
  }
});
