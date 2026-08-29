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
import { composeSegments, truncateSegments } from "./footer.ts";
import { parseStatuslineArgs } from "./tui/settings.ts";

const AUTH_JSON = join(homedir(), ".pi", "agent", "auth.json");
const CONFIG_PATH = join(homedir(), ".pi", "agent", "pi-statusline.json");

export default function (pi: ExtensionAPI): void {
  let config = loadConfig(CONFIG_PATH);
  let poller: QuotaPoller | null = null;
  let requestRenderFn: (() => void) | null = null;
  let sessionCtx: ExtensionContext | null = null;
  let footerInstalled = false;

  function startPoller(): void {
    stopPoller();
    const apiKey = readZaiKey(AUTH_JSON);
    if (!apiKey) return;

    poller = createQuotaPoller({
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
    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRenderFn = () => tui.requestRender();

      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          stopPoller();
        },
        invalidate() {
          tui.requestRender();
        },
        render(width: number): string[] {
          const modelId = ctx.model?.id;
          const branch = footerData.getGitBranch();

          let tokensStr = "";
          if (config.display.showTokens) {
            const entries = ctx.sessionManager.getBranch() as unknown as Array<Record<string, unknown>>;
            tokensStr = renderTokensSegment(entries as never);
          }

          let ctxPct = "";
          if (config.display.showContext) {
            const usage = ctx.getContextUsage();
            ctxPct = renderContextSegment(usage ? { tokens: usage.tokens ?? 0, maxTokens: (usage as { maxTokens?: number }).maxTokens ?? 0 } : null);
          }

          // A5 quota dimming: bright when the session draws on the z.ai plan,
          // dimmed when the active provider is something else (subscription status).
          const quotaDimmed = !isZaiProvider(modelId);
          const quotaStr = renderQuotaSegment(poller?.get() ?? null, quotaDimmed);

          // Build the canonical segment ARRAY, truncate it, THEN join —
          // never re-split a joined string (quota segment contains spaces).
          const segs = composeSegments({
            modelId,
            gitBranch: branch,
            tokens: tokensStr,
            ctxPct,
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
    config = loadConfig(CONFIG_PATH);
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

  // Re-render on model change (provider switch affects quota dimming)
  pi.on("model_select", () => {
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
          saveConfig(CONFIG_PATH, config);
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
          saveConfig(CONFIG_PATH, config);
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
