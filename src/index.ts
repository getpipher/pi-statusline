// src/index.ts
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadConfig, saveConfig, type StatuslineConfig } from "./config.ts";
import { readZaiKey } from "./quota/zai.ts";
import { createSessionStore, type SessionStore } from "./session/store.ts";
import { createLedgerStore, type LedgerStore } from "./ledger/store.ts";
import { createZaiAdapter } from "./adapters/zai.ts";
import { resolveQuotaAdapter, type ProviderRowAdapter } from "./adapters/types.ts";
import { createRowRegistry, renderRows, type Row, type RowSnapshot } from "./rows/registry.ts";
import { createIdentityRow } from "./rows/identity.ts";
import { createContextRow } from "./rows/context.ts";
import { createMoneyRow } from "./rows/money.ts";
import { createQuotaRow } from "./rows/quota.ts";
import { createAmbientRow } from "./rows/ambient.ts";
import { createDeenRow } from "./rows/deen.ts";
import { createDeenSource, type DeenSource } from "./deen/source.ts";
import { createTicker, type Ticker } from "./ticker.ts";
import { parseStatuslineArgs } from "./tui/settings.ts";

const AUTH_JSON = join(homedir(), ".pi", "agent", "auth.json");
const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-statusline.json");
const LEDGER_PATH = join(homedir(), ".pi", "agent", "pi-statusline", "ledger.jsonl");
const DEEN_CACHE_PATH = join(homedir(), ".pi", "agent", "pi-statusline", "deen-cache.json");

export interface StatuslineRuntimeDependencies {
  authJsonPath: string;
  configPath: string;
  ledgerPath: string;
  deenCachePath: string;
  readKey: typeof readZaiKey;
  makeAdapters: (deps: { authJsonPath: string; readKey: typeof readZaiKey; config: () => StatuslineConfig; onRefresh: () => void }) => ProviderRowAdapter<any>[];
  makeDeenSource: (deps: { cachePath: string; config: () => StatuslineConfig }) => DeenSource;
}

const DEFAULT_DEPENDENCIES: StatuslineRuntimeDependencies = {
  authJsonPath: AUTH_JSON,
  configPath: CONFIG_PATH,
  ledgerPath: LEDGER_PATH,
  deenCachePath: DEEN_CACHE_PATH,
  readKey: readZaiKey,
  makeAdapters: ({ authJsonPath, readKey, config, onRefresh }) => [
    createZaiAdapter({ authJsonPath, readKey, pollIntervalMs: () => config().zai.pollIntervalMs, onRefresh }),
  ],
  makeDeenSource: ({ cachePath, config }) => createDeenSource({ cachePath, config: () => config().deen }),
};

export function activateStatusline(
  pi: ExtensionAPI,
  dependencyOverrides: Partial<StatuslineRuntimeDependencies> = {},
): void {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const loaded = loadConfig(dependencies.configPath);
  let config = loaded.config;
  const pendingRowWarnings = new Set(loaded.unknownRows);
  const notifiedRowWarnings = new Set<string>();

  let sessionCtx: ExtensionContext | null = null;
  let sessionStore: SessionStore = createSessionStore();
  let ledgerStore: LedgerStore | null = null;
  let adapters: ProviderRowAdapter<any>[] = [];
  let registry = createRowRegistry([]);
  let ticker: Ticker | null = null;
  let requestRenderFn: (() => void) | null = null;
  let footerInstalled = false;

  // DeenSource lives for the whole activateStatusline lifetime — ONE source, never
  // recreated on session reinstall (its in-memory last-good state must survive).
  const deenSource = dependencies.makeDeenSource({
    cachePath: dependencies.deenCachePath,
    config: () => config,
  });
  let lastDeenRefresh = 0;
  // Cheap throttle: the 30s ticker must not hammer the API (refresh is cache-first,
  // but a no-op call is still a disk read + freshness check).
  const deenNeedsRefresh = (): boolean => Date.now() - lastDeenRefresh > 60_000;
  const refreshDeen = (force = false): void => {
    void deenSource.refresh(force)
      .then(() => {
        lastDeenRefresh = Date.now();
        // Repaint on completion (cold-cache first paint): without this the deen row
        // stays absent until the 30s tick — mirrors the zai adapter's onRefresh pattern.
        // Safe no-op while the footer is uninstalled (requestRenderFn null).
        requestRenderFn?.();
      })
      .catch(() => { /* fire-and-forget: deen failures degrade to null/stale, never throw */ });
  };

  function buildAdapters(): void {
    for (const a of adapters) a.stop();
    adapters = dependencies.makeAdapters({
      authJsonPath: dependencies.authJsonPath,
      readKey: dependencies.readKey,
      config: () => config,
      onRefresh: () => requestRenderFn?.(),
    });
    registry = createRowRegistry([
      createIdentityRow(),
      createContextRow(),
      createMoneyRow(),
      createQuotaRow(adapters),
      createDeenRow(),
      createAmbientRow(),
    ]);
    if (config.enabled) for (const a of adapters) a.start();
  }

  function ensureLedger(): LedgerStore {
    if (!ledgerStore) {
      // Task-6 wiring tail: attribute lines with the current repo so the REPO all-time
      // total renders. pi launches in the project dir — basename(cwd) matches
      // SessionStore's repoName default (identity-row consistency).
      ledgerStore = createLedgerStore({ filePath: dependencies.ledgerPath, repo: () => basename(process.cwd()) });
      ledgerStore.load();
    }
    return ledgerStore;
  }

  function startTicker(): void {
    ticker?.stop();
    ticker = createTicker({
      intervalMs: 30_000,
      onTick: () => {
        if (sessionCtx) {
          ensureLedger().reconcile(sessionCtx.sessionManager.getEntries());
        }
        if (deenNeedsRefresh()) refreshDeen();
        requestRenderFn?.();
      },
    });
    ticker.start();
  }

  function stopTicker(): void {
    ticker?.stop();
    ticker = null;
  }

  function drainRowWarnings(): void {
    if (!sessionCtx) return;
    for (const id of pendingRowWarnings) {
      if (notifiedRowWarnings.has(id)) continue;
      notifiedRowWarnings.add(id);
      sessionCtx.ui.notify(`pi-statusline: unknown display.rows id "${id}" — dropped (valid: identity, ctx, money, quota, deen, ambient)`, "warning");
    }
    pendingRowWarnings.clear();
  }

  function installFooter(ctx: ExtensionContext): void {
    if (footerInstalled) return;
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRenderFn = () => tui.requestRender();
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          for (const a of adapters) a.stop();
          stopTicker();
          // pi may dispose the footer at session end — clear the install guard so the
          // next session_start reinstalls (v1 lesson).
          footerInstalled = false;
          requestRenderFn = null;
        },
        invalidate() {
          tui.requestRender();
        },
        render(width: number): string[] {
          const branch = footerData.getGitBranch();
          sessionStore.update(ctx, branch);
          const ledger = ensureLedger();
          ledger.reconcile(ctx.sessionManager.getEntries());
          // Active 5h window (block burn anchor + est context): resolve like the quota
          // row does, read fiveHour.nextResetTime defensively (adapters are any-typed).
          let quotaWindow: RowSnapshot["quotaWindow"] = null;
          const winner = resolveQuotaAdapter(adapters, sessionStore.getSnapshot().provider);
          const winData = winner?.current() as { fiveHour?: { nextResetTime?: number } } | null | undefined;
          const reset = winData?.fiveHour?.nextResetTime;
          if (typeof reset === "number" && Number.isFinite(reset) && reset > Date.now()) {
            const startMs = reset - 5 * 3_600_000;
            quotaWindow = { startMs, endMs: reset, cost: ledger.costSince(startMs) };
          }
          const snapshot: RowSnapshot = {
            now: Date.now(),
            width,
            session: sessionStore.getSnapshot(),
            ledger: ledger.getSnapshot(),
            statuses: [...footerData.getExtensionStatuses().values()].filter(Boolean).join(" | "),
            config,
            deen: deenSource.current(),
            git: null,
            quotaWindow,
          };
          const lines = renderRows(registry, config.display.rows, snapshot);
          // One theme pass: fragment colors → theme.fg; fragments own all spacing.
          return lines.map((frags) => frags.map((f) => theme.fg(f.color, f.text)).join(""));
        },
      };
    });
    footerInstalled = true;
  }

  function reloadConfig(): void {
    const reloaded = loadConfig(dependencies.configPath);
    config = reloaded.config;
    for (const id of reloaded.unknownRows) pendingRowWarnings.add(id);
    if (config.enabled) {
      buildAdapters(); // restarts adapters so pollIntervalMs changes take effect
      if (sessionCtx) {
        installFooter(sessionCtx);
        drainRowWarnings();
      }
      startTicker();
    } else {
      for (const a of adapters) a.stop();
      stopTicker();
    }
    requestRenderFn?.();
  }

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    if (config.enabled) {
      sessionStore = createSessionStore(); // fresh span per session
      ensureLedger().reconcile(ctx.sessionManager.getEntries());
      buildAdapters();
      installFooter(ctx);
      drainRowWarnings();
      startTicker();
      refreshDeen(); // async, off the render path — print-mode safe (no new timers)
    }
  });

  pi.on("model_select", (_event) => {
    // SessionStore pulls ctx.model per render; the event just forces a re-render.
    requestRenderFn?.();
  });

  pi.registerCommand("statusline", {
    description: "Configure the statusline (refresh | on | off | tier <auto|lite|pro|max> | deen <city|auto>)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      const action = parseStatuslineArgs(args);
      switch (action.action) {
        case "open-panel":
          ctx.ui.notify("Use /statusline refresh | on | off | tier <auto|lite|pro|max> | deen <city|auto>", "info");
          break;
        case "refresh": {
          if (adapters.length === 0) {
            ctx.ui.notify("No provider adapters configured", "warning");
            break;
          }
          for (const a of adapters) await a.fetch();
          requestRenderFn?.();
          ctx.ui.notify("Quota refreshed", "info");
          break;
        }
        case "set-enabled": {
          config = { ...config, enabled: action.enabled };
          saveConfig(dependencies.configPath, config);
          if (action.enabled) {
            reloadConfig();
            ctx.ui.notify("Statusline enabled", "info");
          } else {
            // Explicit user disable is the ONE legitimate yield-to-native (A5 exception).
            ctx.ui.setFooter(undefined);
            footerInstalled = false;
            for (const a of adapters) a.stop();
            stopTicker();
            ctx.ui.notify("Statusline disabled — native footer restored", "info");
          }
          break;
        }
        case "set-tier": {
          config = { ...config, zai: { ...config.zai, tier: action.tier } };
          saveConfig(dependencies.configPath, config);
          ctx.ui.notify(`Tier override set to ${action.tier} (auto = use data.level from the API)`, "info");
          break;
        }
        case "set-deen-city": {
          config = { ...config, deen: { ...config.deen, city: action.city } };
          saveConfig(dependencies.configPath, config);
          try {
            await deenSource.refresh(true); // force: new city may need a fresh geo+timetable
          } catch { /* refresh never throws per contract; belt-and-braces for injected fakes */ }
          ctx.ui.notify(`Deen location set to ${action.city}`, "info");
          requestRenderFn?.();
          break;
        }
        case "error":
          ctx.ui.notify(action.message, "error");
          break;
      }
    },
  });
}

export default function (pi: ExtensionAPI): void {
  activateStatusline(pi);
}
