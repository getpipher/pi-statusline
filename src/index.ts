// src/index.ts
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { loadConfig, saveConfig, type StatuslineConfig } from "./config.ts";
import { readZaiKey, createQuotaPoller, type QuotaPoller } from "./quota/zai.ts";
import { isZaiProvider } from "./provider.ts";
import { renderTokensSegment } from "./segments/tokens.ts";
import { renderContextSegment } from "./segments/context.ts";
import { renderQuotaSegment } from "./segments/quota.ts";
import { renderSessionSegment } from "./segments/session.ts";
import { composeSegments, truncateSegments } from "./footer.ts";
import { parseStatuslineArgs } from "./tui/settings.ts";

const AUTH_JSON = join(homedir(), ".pi", "agent", "auth.json");
const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-statusline.json");

export interface StatuslineRuntimeDependencies {
  authJsonPath: string;
  configPath: string;
  readKey: typeof readZaiKey;
  makePoller: typeof createQuotaPoller;
}

const DEFAULT_DEPENDENCIES: StatuslineRuntimeDependencies = {
  authJsonPath: AUTH_JSON,
  configPath: CONFIG_PATH,
  readKey: readZaiKey,
  makePoller: createQuotaPoller,
};

export function activateStatusline(
  pi: ExtensionAPI,
  dependencyOverrides: Partial<StatuslineRuntimeDependencies> = {},
): void {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const loaded = loadConfig(dependencies.configPath);
  let config = loaded.config;
  const pendingRowWarnings = new Set(loaded.unknownRows);
  let poller: QuotaPoller | null = null;
  let requestRenderFn: (() => void) | null = null;
  let sessionCtx: ExtensionContext | null = null;
  let activeModel: { provider: string | undefined; id: string | undefined } = {
    provider: undefined,
    id: undefined,
  };
  let footerInstalled = false;

  function startPoller(): void {
    stopPoller();
    const apiKey = dependencies.readKey(dependencies.authJsonPath);
    if (!apiKey) return;

    poller = dependencies.makePoller({
      apiKey,
      intervalMs: config.zai.pollIntervalMs,
      onRefresh: () => requestRenderFn?.(),
    });
    poller.start();
  }

  function stopPoller(): void {
    poller?.stop();
    poller = null;
  }

  function installFooter(ctx: ExtensionContext): void {
    if (footerInstalled) return;
    activeModel = { provider: ctx.model?.provider, id: ctx.model?.id };
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRenderFn = () => tui.requestRender();

      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          stopPoller();
          // pi may dispose the footer at session end — clear the install guard so the
          // next session_start reinstalls (and the stale render fn can't fire after dispose).
          footerInstalled = false;
          requestRenderFn = null;
        },
        invalidate() {
          tui.requestRender();
        },
        render(width: number): string[] {
          // ExtensionContext exposes the active model as live state. Keep event state as
          // a fallback for hosts that update model_select before refreshing the context.
          const modelProvider = ctx.model?.provider ?? activeModel.provider;
          const modelId = ctx.model?.id ?? activeModel.id;
          activeModel = { provider: modelProvider, id: modelId };
          const branch = footerData.getGitBranch();
          // FooterData has no status-change subscription. Statuses refresh on normal TUI
          // renders, branch/model changes, and quota refreshes without adding a timer.
          const statuses = [...footerData.getExtensionStatuses().values()]
            .filter(Boolean)
            .join(" · ");

          let tokensStr = "";
          if (config.display.showTokens) {
            // getEntries() is Pi's complete session-entry accessor and is also what
            // the native footer uses for cumulative assistant usage totals.
            tokensStr = renderTokensSegment(ctx.sessionManager.getEntries());
          }

          let ctxPct = "";
          if (config.display.showContext) {
            ctxPct = renderContextSegment(ctx.getContextUsage());
          }

          // A5 quota dimming: bright when the session draws on the z.ai plan,
          // dimmed when the active provider is something else (subscription status).
          const quotaDimmed = !isZaiProvider(modelProvider);
          const quotaStr = renderQuotaSegment(poller?.get() ?? null, quotaDimmed);

          // Build the canonical segment ARRAY, truncate it, THEN join —
          // never re-split a joined string (quota segment contains spaces).
          const segs = composeSegments({
            modelId,
            sessionName: config.display.showSession
              ? renderSessionSegment(ctx.sessionManager.getSessionName?.())
              : "",
            gitBranch: branch,
            tokens: tokensStr,
            ctxPct,
            statuses,
            quota: quotaStr || null,
            config,
          });
          const kept = truncateSegments(segs, width);

          // Theme: model badge accent; quota dim only when dimmed; rest muted.
          const modelBadge = segs[0]!;
          const line = kept
            .map((seg) => {
              if (quotaStr && seg === quotaStr) return theme.fg(quotaDimmed ? "dim" : "text", seg);
              if (seg === modelBadge) return theme.fg("accent", seg);
              return theme.fg("muted", seg);
            })
            .join(" ");
          return [line];
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
      startPoller();
      if (sessionCtx) installFooter(sessionCtx);
    } else {
      stopPoller();
    }
    requestRenderFn?.();
  }

  // Wire footer + poller on session start
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    sessionCtx = ctx;
    if (config.enabled) {
      installFooter(ctx);
      startPoller();
    }
  });

  // Update model state and re-render on provider/model switches.
  pi.on("model_select", (event) => {
    activeModel = { provider: event.model.provider, id: event.model.id };
    requestRenderFn?.();
  });

  // Register /statusline command
  pi.registerCommand("statusline", {
    description: "Configure the statusline (refresh | on | off | tier <auto|lite|pro|max>)",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      const action = parseStatuslineArgs(args);

      switch (action.action) {
        case "open-panel":
          ctx.ui.notify("Use /statusline refresh | on | off | tier <auto|lite|pro|max>", "info");
          break;
        case "refresh":
          if (poller) {
            await poller.refresh();
            requestRenderFn?.();
            ctx.ui.notify("Quota refreshed", "info");
          } else {
            ctx.ui.notify("z.ai not configured — no poller running", "warning");
          }
          break;
        case "set-enabled": {
          config = { ...config, enabled: action.enabled };
          saveConfig(dependencies.configPath, config);
          if (action.enabled) {
            reloadConfig(); // starts poller + installs footer mid-session (no restart needed)
            ctx.ui.notify("Statusline enabled", "info");
          } else {
            // Explicit user disable is the ONE legitimate yield-to-native:
            // A5's "never yield" rule governs provider switches, not /off.
            ctx.ui.setFooter(undefined);
            footerInstalled = false;
            stopPoller();
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
