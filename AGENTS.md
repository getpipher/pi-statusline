<!-- Satellite context file — extends the global hub (~/.pi/agent/AGENTS.md | ~/.claude/CLAUDE.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# pi-statusline

> Adaptive, provider-aware footer (statusline) extension for the Pi Coding Agent. Replaces pi's native footer with a multi-segment bar whose billing metric adapts to the active provider (z.ai credits vs OpenRouter $ vs local tokens).

**Org:** getpipher (CIPHER pi-packages org). **npm:** `@getpipher/pi-statusline`. **Host:** Pi Coding Agent only — TypeScript extension, not bash.

## Status

**Current:** Design phase (v1 draft). Repo: empty of code; `docs/` populated.
**Next:** spec sign-off → implementation plan → build.

## Read first

1. [`docs/design/2026-08-12-pi-statusline-design.md`](docs/design/2026-08-12-pi-statusline-design.md) — the design (all locked decisions A1–A7).
2. [`docs/research/2026-08-12-zai-quota-research.md`](docs/research/2026-08-12-zai-quota-research.md) — z.ai credit model (formula, multipliers, tiers, error codes). The headline feature depends on this.

## Locked decisions (do not re-litigate without RECTOR)

- **A1** Replace pi's footer via `ctx.ui.setFooter()` (not additive `setStatus`). *(pending final user confirm — see open Q1 in design doc)*
- **A2** Provider-adaptive: metrics + segments adapt to active provider. Stable line count.
- **A3** z.ai path = **local credit tracking** via z.ai's published formula. No quota API exists; no polling.
- **A4** z.ai tier = **manual config** (Lite/Pro/Max), default `lite`. No detection API.
- **A5** OpenRouter path = per-message `$ cost` from pi `usage.cost.total`.
- **A6** Config = `~/.pi/agent/pi-statusline.json` + `/statusline` TUI (`registerCommand` + `ctx.ui.custom()`) + direct args.
- **A7** TypeScript pi extension on `@earendil-works/pi-tui`. No bash, no TOML theme engine — reuse pi's native theme.

## pi extension mechanics (verified)

- Footer replace: `ctx.ui.setFooter((tui, theme, footerData) => ({ render(width): string[], dispose, invalidate }))`
- Data: `ctx.model`, `ctx.sessionManager.getBranch()` (per-message `usage`), `ctx.getContextUsage()`, `footerData.getGitBranch()` / `onBranchChange()`, `after_provider_response` (`event.status`, `event.headers`).
- Theme: `theme.fg(color, text)` / `theme.bg(color, text)` — colors: `text accent muted dim success warning error toolTitle`.
- Command: `pi.registerCommand("statusline", { handler })` → `ctx.ui.custom()`.
- No declarative extension-config API; persist our own JSON via Node `fs`.

## Conventions

- Spelling: the org is **getpipher** (get·pi·pher — two p's). Never `getpither`. (See global memory.)
- No AI attribution in commits/PRs/files.
- 2-space indent, TypeScript.
- MIT license.

## Open questions (resolve next session)

1. Confirm A1 (replace footer) with RECTOR.
2. Verify the usage object shape for the user's `glm-5.2` provider — does it carry cached-token counts? (Needed for the z.ai formula's cached term.)
3. Off-peak SGT clock handling.
4. Segment priority / truncation under narrow widths.
