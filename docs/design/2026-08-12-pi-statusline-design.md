# pi-statusline — Design Document

**Status:** Draft v1 (brainstorm output, pre-implementation)
**Date:** 2026-08-12
**Org / repo:** [getpipher/pi-statusline](https://github.com/getpipher/pi-statusline)
**npm:** `@getpipher/pi-statusline` (scoped, under the CIPHER pi-packages org)
**Host:** Pi Coding Agent (`pi`) — TypeScript extension

> Companion research: [`../research/2026-08-12-zai-quota-research.md`](../research/2026-08-12-zai-quota-research.md). Read it for the z.ai credit-model details that drive the headline feature.

---

## 1. Vision

An **adaptive, provider-aware footer** for the Pi Coding Agent. It replaces pi's native footer with a multi-segment bar that shows **the metrics that actually matter for the active provider's billing model** — not a one-size-fits-all number.

- On **z.ai (GLM Coding Plan, flat-rate)** → show **credits consumed / remaining** against the plan, with 5-hour + weekly windows and reset countdowns. `$ cost` is meaningless on a flat sub.
- On **OpenRouter (pay-per-token)** → show **`$ cost`** (real money).
- On **Ollama / local** → cost is zero; show tokens-only.

This is the product reason this package exists: **the "right" metric depends on how the active provider bills.**

## 2. Goals / Non-goals

**Goals (v1)**
- Replace pi's footer with a clean, multi-segment, themed bar via `ctx.ui.setFooter()`.
- Provider-adaptive metrics + segments (z.ai credits path, OpenRouter cost path).
- Accurate z.ai credit tracking using z.ai's published credit formula — no API polling.
- Interactive `/statusline` TUI for configuration (plan tier, toggles) + direct-arg form.
- Human- and TUI-editable JSON config.
- Native pi theming (`theme.fg`) — ships well with the user's Catppuccin Mocha, no separate theme engine.

**Non-goals (v1)**
- No multi-line / variable line-count footer (line count stays stable; content varies). Varying height is jarring.
- No scraping of z.ai's auth-gated web console for quota (undocumented, fragile, credential-handling risk).
- No re-implementation of every pi native footer feature — only the segments we actively choose to own.
- No 240-setting config surface. Lean config that grows with features.

## 3. Context

### 3a. How pi's footer works (host model)
Pi exposes two footer mechanisms to extensions (verified in `docs/tui.md` + `docs/extensions.md` + `examples/extensions/custom-footer.ts`):

| Mechanism | API | Behavior |
|---|---|---|
| **Replace** | `ctx.ui.setFooter(factory)` | We render the **entire** footer. `factory(tui, theme, footerData)` returns `{ render(width): string[], dispose?, invalidate? }`. Multi-line capable. |
| **Additive** | `ctx.ui.setStatus(key, text)` | A keyed entry in the footer's status row; coexists with pi's native footer + other extensions. |

`footerData` exposes data not otherwise reachable: `getGitBranch()`, `getExtensionStatuses()`, and reactive `onBranchChange(cb)`.

### 3b. Data available to a pi extension (all verified)
- **Model** — `ctx.model?.id`, `event.model` on `model_select` (`{provider, id}`)
- **Git branch** — `footerData.getGitBranch()` (+ reactive)
- **Per-message usage** — iterate `ctx.sessionManager.getBranch()`; assistant messages carry `usage: { input, output, cacheReadInput?, cost: { total, ... } }`
- **Context-window estimate** — `ctx.getContextUsage()` → `{ tokens, ... }`
- **Provider response headers / status** — `after_provider_response` event (`event.status`, `event.headers`)
- **Session file / name** — `ctx.sessionManager.getSessionFile()`
- **Theme** — `theme.fg(color, text)`, `theme.bg(color, text)`; colors: `text`, `accent`, `muted`, `dim`, `success`, `warning`, `error`, `toolTitle`, etc.

### 3c. z.ai billing model
Flat-rate **GLM Coding Plan** ("devpack"). Usage measured in **credits** computed from tokens × per-model multipliers. Two windows: rolling **5-hour** + **weekly (7-day)**, each with a credit ceiling per plan tier. Off-peak hours billed at 50%. **There is no public quota/subscription API** (see research doc) — quota is web-console-only (auth-gated) or surfaced reactively in limit-error responses.

## 4. Architecture decisions (locked in brainstorm)

| # | Decision | Rationale |
|---|---|---|
| A1 | **Replace the footer** via `ctx.ui.setFooter()` (not additive `setStatus`) | The adaptive multi-segment bar needs full layout control. Additive mode can't render a multi-segment bar. We stay a good citizen: `footerData.getExtensionStatuses()` still lets us surface other extensions' `setStatus` calls inside our bar. |
| A2 | **Provider-adaptive**: metrics **(a)** + segments **(b)** adapt to the active provider | The core product thesis — show the metric that matches the billing model. Styling-per-provider **(c)** is optional polish for later. Line count stays **stable (d)**. |
| A3 | **z.ai path = local credit tracking** via z.ai's published formula | No quota API exists. The formula is deterministic and fully published, so we compute credits ourselves from per-message usage. Zero extra API calls, works offline. |
| A4 | **z.ai tier = manual config** (Lite/Pro/Max), default **Lite** | No API to detect the tier. Detection was explored (behavioral ceiling inference + error calibration) but the user chose clean manual config. Tier is a one-time setting. |
| A5 | **OpenRouter path = per-message `$ cost`** from pi's `usage.cost.total` | Already carried by pi; just sum it. |
| A6 | **Config = `~/.pi/agent/pi-statusline.json`** + `/statusline` TUI + direct args | Pi has no declarative extension-config API; we own the file (documented Node-`fs` pattern). TUI is a convenience layer over the file; both stay in sync. |
| A7 | **TypeScript pi extension** on `@earendil-works/pi-tui` primitives | Host-native. No bash, no TOML theme engine — reuse pi's theme system. |

## 5. Data sources → segment mapping

| Segment | Source | Notes |
|---|---|---|
| Model badge | `ctx.model.id` (+ `model_select`) | Shorten provider-prefixed ids |
| Git branch | `footerData.getGitBranch()` | Reactive via `onBranchChange` |
| Tokens (in/out/cached) | sum over `ctx.sessionManager.getBranch()` assistant `usage` | cached term needed for z.ai credit math |
| Context % | `ctx.getContextUsage()` | Show as % of active model's window |
| **z.ai credits** (5h / wk) | computed locally via formula (§6) | only when provider == z.ai |
| **z.ai reset countdown** | rolling-window timestamps + error-code calibration | only when provider == z.ai |
| **`$ cost`** | sum `usage.cost.total` | only when provider != z.ai (e.g. OpenRouter) |
| Other extensions' statuses | `footerData.getExtensionStatuses()` | surfaced so we don't break neighbors |

**Provider detection** keys off `ctx.model.provider` (or the model id's prefix). The active provider selects which of the billing-specific segments render.

## 6. z.ai credit model (the differentiator) — summary

Full detail in the [research doc](../research/2026-08-12-zai-quota-research.md). Summary:

- **Formula:** `credits = (input×inMult + cachedInput×cachedMult + output×outMult) / 10_000`
- **Multipliers (GLM-5.2):** in `6.9`, cached `1.7`, out `24` (GLM-4.7: 4.6/1.2/16; GLM-4.6V: 1.2/0.3/2.7)
- **Off-peak:** 50% of standard rate. Peak = Mon–Fri 14:00–18:00 SGT (UTC+8).
- **Windows + ceilings (Lite):** 5h = 2,000 · weekly = 10,000. (Pro: 12,000 / 60,000. Max: 28,000 / 140,000.)
- **Reset:** 5h credits refresh 5h after consumption (sliding); weekly resets every 7 days from subscription anchor.
- **Calibration hook:** on z.ai error `1316`/`1317` (5h/7d limit), parse `{next_flush_time}` and snap local state to authoritative reset.

**Tracking approach:** on `message_end` (assistant), compute credits for that message using the active model's multipliers + off-peak factor, append timestamped debit records into two rolling windows (5h, 7d), and render consumed/remaining + next-reset countdown.

## 7. Proposed v1 segment layout (stable 1 line, content varies by provider)

```
[provider badge] [model] (git) | ↑in ↓out ctx% | <billing segment>
```
- **z.ai billing segment:** `z.ai ⚡ 5h: 1.2k/2.0k ████░░ reset 2h13m · wk: 7.8k/10k`
- **OpenRouter billing segment:** `$0.0423 · turn $0.0031`
- **local:** tokens only (no billing segment)

Exact spacing / dividers / colors TBD during build (uses `theme.fg`). Stable width, responsive truncation via pi's `truncateToWidth` / `visibleWidth`.

## 8. Config schema (v1)

File: `~/.pi/agent/pi-statusline.json`. Written on first run with defaults.

```json
{
  "$schema": "./schema.v1.json",
  "enabled": true,
  "zai": {
    "tier": "lite",
    "weekAnchor": "2026-08-12T16:00:00+08:00"
  },
  "display": {
    "showTokens": true,
    "showContext": true,
    "showGit": true
  }
}
```

- `zai.tier` — `"lite" | "pro" | "max"`. Selects credit ceilings. Default `"lite"`.
- `zai.weekAnchor` — ISO timestamp of the weekly cycle anchor (subscription start). Used for weekly reset countdown. Auto-set on first run if absent.
- `display.*` — segment toggles. Grow as features land.

**Tier table** (internal constant, derived from z.ai docs):
```ts
const ZAI_TIERS = {
  lite: { h5: 2000,  week: 10000  },
  pro:  { h5: 12000, week: 60000  },
  max:  { h5: 28000, week: 140000 },
};
```

## 9. `/statusline` command UX

- **`/statusline`** → opens interactive settings TUI via `ctx.ui.custom()`:
  - Plan tier selector (Lite / Pro / Max)
  - Master on/off
  - Display toggles (`showTokens`, `showContext`, `showGit`)
  - *(grows as features land)*
- **`/statusline tier pro`** → direct-arg form (quick / scriptable, no TUI)
- **`/statusline off` / `/statusline on`** → toggle

All mutations write through to `pi-statusline.json`; the footer re-reads on change.

## 10. Package / file layout (proposed)

```
pi-statusline/
├─ src/
│  ├─ index.ts                 # entry: registerCommand, event hooks, setFooter
│  ├─ config.ts                # load/save ~/.pi/agent/pi-statusline.json + defaults
│  ├─ provider.ts              # detect active provider from ctx.model
│  ├─ credits/
│  │  ├─ zai.ts                # formula, multipliers, tier ceilings, windows
│  │  └─ cost.ts               # OpenRouter/local $ cost + token sums
│  ├─ segments/                # one module per segment (model, git, tokens, ctx%, billing)
│  ├─ footer.ts                # setFooter factory: composes segments → render(width)
│  └─ tui/
│     └─ settings.ts           # /statusline interactive component
├─ docs/
│  ├─ design/2026-08-12-pi-statusline-design.md
│  └─ research/2026-08-12-zai-quota-research.md
├─ package.json                # pi package manifest (pi.extension entrypoint)
├─ AGENTS.md                   # satellite project context
├─ README.md
└─ LICENSE
```

## 11. Out of scope (v1) / future

- **Tier auto-detection** (behavioral inference + error calibration) — explicitly deferred; revisit if users ask. Manual config ships first.
- **z.ai web-console sync** — auth-gated, fragile, deferred indefinitely.
- **Per-provider styling presets / icons** (decision A2c) — polish, later.
- **More providers** (Anthropic direct, Bedrock, etc.) — architecture is provider-pluggable; add as needed.
- **Multi-line footer** — stable line count by design.

## 12. Open questions to resolve in the next session

1. **Confirm A1 (replace vs additive).** The adaptive bar implies replace; user hasn't explicitly confirmed. Recommend replace.
2. **Verify the usage object shape** for the user's `glm-5.2` provider — does it carry `cacheReadInput` / `cached_tokens`? Needed for the z.ai formula's cached term. (Implementation-time check, not blocking design.)
3. **Off-peak detection** — confirm timezone handling (peak = Mon–Fri 14:00–18:00 SGT). Use a fixed SGT clock, not local tz.
4. **Segment priority + truncation** under narrow widths — which segments drop first?
5. **Decide whether `/statusline` is also the review checkpoint** for spec sign-off before implementation begins (brainstorming flow).
