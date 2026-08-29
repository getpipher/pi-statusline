<!-- Satellite context file — extends the global hub (~/.pi/agent/AGENTS.md | ~/.claude/CLAUDE.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# pi-statusline

> Adaptive, provider-aware footer (statusline) extension for the Pi Coding Agent. Replaces pi's native footer with a multi-segment bar. For z.ai (GLM Coding Plan) it shows **authoritative** 5h + weekly credit balance polled from the console API (`/quota/limit`); per-provider `$ cost` (OpenRouter etc.) is deferred.

**Org:** getpipher (CIPHER pi-packages org). **npm:** `@getpipher/pi-statusline`. **Host:** Pi Coding Agent only — TypeScript extension, not bash.

## Status

**Current:** v1 implementation complete on `feat/v1-footer` — footer (model/git/tokens/ctx%/statuses/quota), z.ai quota poller, `/statusline` notify-based commands. Design A1–A7 (A3″/A4′/A5-refined) locked; z.ai quota API confirmed.
**Next:** final merge of `feat/v1-footer`, then deferred follow-ups (interactive TUI panel, Task 8 offline fast-path).

## Read first

1. [`docs/design/2026-08-12-pi-statusline-design.md`](docs/design/2026-08-12-pi-statusline-design.md) — the v2 design (A1–A7, A3″/A4′/A5-refined). Authoritative source.
2. [`docs/research/zai-devpack/`](docs/research/zai-devpack/) — official z.ai Coding Plan docs (scraped 2026-08-12): overview, faq, usage-policy, the 4 MCP servers, etc.
3. [`docs/research/2026-08-12-zai-quota-research.md`](docs/research/2026-08-12-zai-quota-research.md) — z.ai credit model (formula, multipliers, tiers, error codes). Background for the optional local fast-path.
4. [`docs/research/mcp-vs-firecrawl-comparison.md`](docs/research/mcp-vs-firecrawl-comparison.md) — z.ai MCP vs Firecrawl (deferred, evidence-based).

## Locked decisions (do not re-litigate without RECTOR)

- **A1** Replace pi's footer via `ctx.ui.setFooter()` (not additive `setStatus`). ✅ confirmed.
- **A2** Provider-adaptive: metrics + segments adapt to active provider. Stable line count. Architecture is provider-pluggable; v1 ships the z.ai branch.
- **A3″** z.ai quota = **authoritative polling** of `GET https://api.z.ai/api/monitor/usage/quota/limit` (inference-key Bearer; confirmed `200`). Sees all tools' consumption (shared bucket). The published credit formula is kept only as an *optional* sub-minute interpolator + offline fallback.
- **A4′** z.ai tier = **auto-detected** from `data.level` (`lite|pro|max`). `/statusline` keeps a manual override (default `auto`).
- **A5-refined** **Always render** our footer. The z.ai quota segment is **subscription-scoped** (shown whenever a z.ai provider is configured, dimmed when z.ai ≠ active provider); the session segment is **active-provider-scoped**. No v1 per-provider `$ cost` (OpenRouter/Codex/Ollama deferred). **Never yields to native** → no flicker on provider switches.
- **A6** Config = `~/.pi/agent/pi-statusline.json` + `/statusline` TUI (`registerCommand` + `ctx.ui.custom()`) + direct args.
- **A7** TypeScript pi extension on `@earendil-works/pi-tui`. No bash, no TOML theme engine — reuse pi's native theme.

## pi extension mechanics (verified)

- Footer replace: `ctx.ui.setFooter((tui, theme, footerData) => ({ render(width): string[], dispose, invalidate }))`
- Data: `ctx.model`, `ctx.sessionManager.getBranch()` (per-message `usage` — real `zai`/`glm-5.2` shape: `{input, output, cacheRead, cacheWrite, reasoning, totalTokens, cost:{…,total:0}}`), `ctx.getContextUsage()`, `footerData.getGitBranch()` / `onBranchChange()`, `after_provider_response` (`event.status`, `event.headers`).
- **z.ai quota API** (verified 2026-08-12): `GET https://api.z.ai/api/monitor/usage/quota/limit` + `Authorization: Bearer <zai key>` → `data.{limits:[{usage,currentValue,remaining,percentage,nextResetTime(ms-epoch UTC)}], level}`. Same perimeter as inference; zero credit cost to poll.
- **Key access** (build-time verify): prefer a pi extension credential accessor; fallback = read `~/.pi/agent/auth.json` → `zai.key` in-process (never log it).
- Theme: `theme.fg(color, text)` / `theme.bg(color, text)` — colors: `text accent muted dim success warning error toolTitle`.
- Command: `pi.registerCommand("statusline", { handler })` → `ctx.ui.custom()`.
- No declarative extension-config API; persist our own JSON via Node `fs`.

## Conventions

- Spelling: the org is **getpipher** (get·pi·pher — two p's). Never `getpither`. (See global memory.)
- No AI attribution in commits/PRs/files.
- 2-space indent, TypeScript.
- MIT license.

## Resolved / deferred

- **Q1–Q5 resolved** in design doc §12 (A1 confirmed; cached field = `cacheRead`; off-peak = fixed SGT clock in the optional fast-path; truncation order set; sign-off done).
- **Build-time verify:** how the extension obtains the zai key at runtime (pi credential accessor vs reading `auth.json`). Not blocking the spec.
- **Deferred:** evidence-based MCP-vs-Firecrawl comparison (provisional: wire **Vision** only; skip Web Search/Reader for Firecrawl; Zread optional). See `docs/research/mcp-vs-firecrawl-comparison.md`.
- **Deferred:** per-provider `$ cost` for OpenRouter/Codex/Ollama (A5 future).
