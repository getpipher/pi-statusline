# pi-statusline — Design Document

**Status:** Draft v2 — spec finalized (A3″ / A4′ / A5-refined locked; API discovery confirmed)
**Date:** 2026-08-12
**Org / repo:** [getpipher/pi-statusline](https://github.com/getpipher/pi-statusline)
**npm:** `@getpipher/pi-statusline` · **Host:** Pi Coding Agent (`pi`) — TypeScript extension

> **v2 changelog** — the z.ai quota path was upgraded from *local credit estimation* to **authoritative API polling**. RECTOR pointed at the dashboard (`z.ai/manage-apikey/coding-plan/personal/usage`); we reverse-engineered the console's backend (`GET /api/monitor/usage/quota/limit`) and confirmed it returns `200` with the **inference key** (same Bearer perimeter as `chat/completions`). Consequences: quota is now **authoritative** (sees all tools' consumption — the shared-bucket blindness is gone); tier is **auto-detected** from the response (`data.level`); cached-token field corrected to `cacheRead`; fallback refined to always-render; Q1–Q5 resolved.
> Reference: `docs/research/zai-devpack/` (official docs, scraped 2026-08-12) · `docs/research/2026-08-12-zai-quota-research.md` (credit model) · `docs/research/mcp-vs-firecrawl-comparison.md` (MCP wiring, deferred).

---

## 1. Vision

An **adaptive, provider-aware footer** for the Pi Coding Agent. It replaces pi's native footer with a multi-segment bar that shows **the metric that actually matters for the active provider's billing model** — and for z.ai (the GLM Coding Plan), that metric is now **authoritative plan balance**, not an estimate.

- On **z.ai (GLM Coding Plan, flat-rate)** → show **authoritative 5h + weekly credit balance + reset countdown**, polled from z.ai's console API. `$ cost` is meaningless on a flat sub.
- On **other providers** (OpenRouter / OpenAI Codex / Ollama) → v1 shows the subscription-scoped z.ai balance (dimmed) + the active session's tokens. Per-provider `$ cost` is deferred (A5).

This is the product reason this package exists: **the "right" metric depends on how the active provider bills — and for z.ai we can now show ground truth.**

## 2. Goals / Non-goals

**Goals (v1)**
- Replace pi's footer with a clean, multi-segment, themed bar via `ctx.ui.setFooter()`.
- **Authoritative** z.ai quota via the console API (`/quota/limit`) — not local estimation.
- Interactive `/statusline` TUI for configuration + direct-arg form.
- Human- and TUI-editable JSON config.
- Native pi theming (`theme.fg`).

**Non-goals (v1)**
- **No local-formula-as-source-of-truth.** The published credit formula is retained only as an *optional* sub-minute interpolator between polls + offline fallback (demoted from v1).
- No auth-gated console scraping — we have the API now.
- **No per-provider `$ cost` beyond z.ai in v1** (OpenRouter / Codex / Ollama cost deferred — A5).
- No multi-line / variable-height footer (line count stays stable; content varies).
- No 240-setting config surface. Lean config that grows with features.

## 3. Context

### 3a. How pi's footer works (host model — verified)
Pi exposes two footer mechanisms to extensions (verified in `docs/tui.md` + `examples/extensions/custom-footer.ts`):

| Mechanism | API | Behavior |
|---|---|---|
| **Replace** | `ctx.ui.setFooter(factory)` | We render the **entire** footer. `factory(tui, theme, footerData)` returns `{ render(width): string[], dispose?, invalidate? }`. Multi-line capable. |
| **Additive** | `ctx.ui.setStatus(key, text)` | A keyed entry in the footer's status row; coexists with pi's native footer + other extensions. |

`footerData` exposes `getGitBranch()`, `getExtensionStatuses()`, and reactive `onBranchChange(cb)`.

### 3b. Data available to a pi extension (verified)
- **Model** — `ctx.model?.id` / `ctx.model?.provider`; `event.model` on `model_select`.
- **Git branch** — `footerData.getGitBranch()` (+ reactive).
- **Per-message usage** — iterate `ctx.sessionManager.getBranch()`; assistant messages carry `usage: { input, output, cacheRead, cacheWrite, cost: { total, … }, … }`. *(Verified against a real `glm-5.2` response: `{input, output, cacheRead, cacheWrite, reasoning, totalTokens, cost:{…,total:0}}`.)*
- **Context-window estimate** — `ctx.getContextUsage()`.
- **Provider response headers / status** — `after_provider_response` event (`event.status`, `event.headers`).
- **z.ai inference key** — available to the extension (build-time: confirm pi's extension API exposes provider credentials; fallback = read `~/.pi/agent/auth.json` in-process). Needed to poll the quota API.
- **Theme** — `theme.fg(color, text)` / `theme.bg(color, text)`.

### 3c. z.ai billing + the quota API (the v2 differentiator)

z.ai's GLM Coding Plan is flat-rate. Usage is measured in **credits** against two windows (5-hour + weekly), each with a ceiling per tier. **Crucially, all supported coding tools share one quota bucket** (Claude Code, Cursor, Goose, pi) — so only the server sees total consumption.

**The quota API (discovered 2026-08-12, confirmed working):**

```
GET https://api.z.ai/api/monitor/usage/quota/limit
Authorization: Bearer <z.ai inference key>
Accept: application/json

→ 200 {
  "code": 200, "msg": "Operation successful", "success": true,
  "data": {
    "limits": [
      { "type": "CREDIT_LIMIT", "unit": 3, "number": 5,
        "usage": 2000,   "currentValue": 1501, "remaining": 498,
        "percentage": 75, "nextResetTime": 1786539568992 },     // 5-hour window
      { "type": "CREDIT_LIMIT", "unit": 6, "number": 1,
        "usage": 10000, "currentValue": 1501, "remaining": 8498,
        "percentage": 15, "nextResetTime": 1787126084998 }      // weekly window
    ],
    "level": "lite"                                              // tier, auto-detected
  }
}
```

- Same host + Bearer perimeter as inference (`api.z.ai/api/…`). The inference key authorizes it (verified `200`).
- `nextResetTime` is **ms-epoch UTC** → render to local/SGT. (Verified: 1786539568992 = 2026-08-12 12:59:28 UTC = 20:59:28 SGT — matches the dashboard.)
- **Server-side → sees all tools' consumption.** The shared-bucket blindness that killed a local-only approach is fully closed.
- **Zero credit cost to poll** — it's a console API, not model inference.
- `data.level` returns the tier → **no manual tier config needed** (A4′).

## 4. Architecture decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| A1 | **Replace** the footer via `ctx.ui.setFooter()` | Full layout control for the multi-segment bar. Good citizen: `footerData.getExtensionStatuses()` still surfaces neighbors' `setStatus`. |
| A2 | **Provider-adaptive**; stable line count | Metrics/segments vary by provider; height never does. Architecture is provider-pluggable; v1 ships the z.ai branch. |
| **A3″** | **Authoritative polling** of `/quota/limit` (+ optional local fast-path) | The API is ground truth, sees all tools' consumption, costs zero credits. Local per-message formula is demoted to a sub-minute interpolator between polls + offline fallback. |
| **A4′** | **Auto-detect tier** from `data.level` | The API returns the tier; manual config dissolves. `/statusline` keeps a manual **override** as an escape hatch (default: auto). |
| **A5-refined** | **Always render; subscription-scoped quota + provider-scoped session** | The z.ai quota segment is *your plan's balance* — shown whenever a z.ai provider is configured, independent of the active provider (dimmed when z.ai ≠ active). The session segment reflects the active provider. No v1 per-provider `$ cost` (OR/Codex/Ollama deferred). **Never yields to native** → no flicker on provider switches (e.g. `/fleet` flipping to codex). |
| A6 | **Config** = `~/.pi/agent/pi-statusline.json` + `/statusline` TUI + direct args | Pi has no declarative extension-config API; we own the file. |
| A7 | **TypeScript** pi extension on `@earendil-works/pi-tui` | Host-native. No bash, no TOML theme engine. |

## 5. Data sources → segment mapping

| Segment | Source | Notes |
|---|---|---|
| Model badge | `ctx.model.id` (+ `model_select`) | Shorten provider-prefixed ids |
| Git branch | `footerData.getGitBranch()` | Reactive via `onBranchChange` |
| Tokens (in/out/cached) | sum over `ctx.sessionManager.getBranch()` assistant `usage` | active-session only |
| Context % | `ctx.getContextUsage()` | % of active model's window |
| **z.ai quota (5h + weekly)** | **`GET /quota/limit`** (authoritative) | subscription-scoped; always on when z.ai configured |
| **z.ai reset countdown** | `nextResetTime` (ms-epoch UTC) from the same poll | render local/SGT |
| Other extensions' statuses | `footerData.getExtensionStatuses()` | surfaced so we don't break neighbors |

The z.ai quota segment is **not** tied to the active provider — it's the user's subscription balance. Provider detection (`ctx.model.provider`) only affects the session segment's labeling and (future) per-provider cost.

## 6. z.ai quota — authoritative polling

**Cadence** — poll `GET /quota/limit` on: extension startup, every ~3–5 min, on `/statusline refresh`, and (optionally) after each assistant message. Conservative to be a good citizen; it's a lightweight console GET, not inference. Cache the latest result; the footer renders from cache and refreshes on each poll.

**Key access** — the extension needs the z.ai inference key. Options, in priority order (confirm at build):
1. pi extension API credential accessor (cleanest — stays in pi's trust boundary).
2. read `~/.pi/agent/auth.json` directly in-process (the probe demonstrated this safe pattern — key read, never logged).
3. user-configured key in our own config (last resort — duplicates the secret; avoided per the secrets convention).

**Local fast-path (optional, demoted)** — between polls, nudge the displayed number using the published formula `credits = (input·inMult + cacheRead·cachedMult + output·outMult)/10_000 × offPeak`, with GLM-5.2 mults (in 6.9 / cached 1.7 / out 24) and off-peak 50% (Mon–Fri 14:00–18:00 SGT, fixed UTC+8 clock). Snapped back to truth on every successful poll. Offline fallback when the API is unreachable.

**MCP credits** — z.ai MCP tools (Vision / Web Search / Web Reader / Zread) draw from the **same** plan bucket, so the authoritative poll counts them automatically. No special handling. (The optional local fast-path would add `mcp_credits = calls × outMult` if we track MCP calls locally — not required since we poll authoritative.)

**Error calibration** — on a z.ai `429` (codes `1308`/`1310`/`1316`/`1317`), parse `{nextResetTime}` if present and snap the reset clock. Reactive supplement; the poll is primary.

## 7. Segment layout (v2 — stable 1 line)

```
[provider badge] [model] (git) | ↑in ↓out ctx% | <quota segment>
```
- **z.ai quota segment** (subscription-scoped, always on): `⚡ zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m`
- **session segment** reflects the active provider (`glm-5.2` / `gpt-5.6-sol` / …).
- **quota segment dimmed** when the active provider ≠ z.ai (reads "subscription status, not this-session cost").
- Exact spacing/colors TBD during build (uses `theme.fg`). Stable width; responsive truncation.
- **Truncation order** (drop right→left as width shrinks): `quota` → `ctx%` → `tokens` → `git` → (always keep) `model badge`.

## 8. Config schema (v1)

File: `~/.pi/agent/pi-statusline.json`. Written on first run with defaults. **Shrunk from v1** — the API now supplies tier, ceilings, and reset, so we no longer store them.

```json
{
  "$schema": "./schema.v1.json",
  "enabled": true,
  "zai": {
    "tier": "auto",
    "pollIntervalMs": 180000
  },
  "display": {
    "showTokens": true,
    "showContext": true,
    "showGit": true
  }
}
```
- `zai.tier` — `"auto"` (default; uses `data.level`) | `"lite" | "pro" | "max"` (manual override / escape hatch).
- `zai.pollIntervalMs` — poll cadence (default 3 min).
- `display.*` — segment toggles. Grows as features land.

## 9. `/statusline` command UX

- **`/statusline`** → interactive settings TUI via `ctx.ui.custom()`: master on/off, display toggles, tier selector (Auto / Lite / Pro / Max), poll-cadence field, manual **refresh** action.
- **`/statusline refresh`** → force a quota poll now.
- **`/statusline tier auto|lite|pro|max`** → direct-arg tier override.
- **`/statusline on` / `/statusline off`** → toggle.

All mutations write through to `pi-statusline.json`; the footer re-reads on change.

## 10. Package / file layout (proposed)

```
pi-statusline/
├─ src/
│  ├─ index.ts                 # entry: registerCommand, event hooks, setFooter
│  ├─ config.ts                # load/save ~/.pi/agent/pi-statusline.json + defaults
│  ├─ provider.ts              # detect active provider from ctx.model
│  ├─ quota/
│  │  ├─ zai.ts                # GET /quota/limit client + poller + cache
│  │  └─ local-fast-path.ts    # optional formula interpolator + offline fallback
│  ├─ segments/                # one module per segment (model, git, tokens, ctx%, quota)
│  ├─ footer.ts                # setFooter factory: composes segments → render(width)
│  └─ tui/
│     └─ settings.ts           # /statusline interactive component
├─ docs/  (design + research/zai-devpack/ + research/mcp-vs-firecrawl-comparison.md)
├─ package.json                # pi package manifest (pi.extension entrypoint)
├─ AGENTS.md · README.md · LICENSE
```

## 11. Out of scope (v1) / future

- **Per-provider `$ cost`** for OpenRouter / OpenAI Codex / Ollama (A5 future) — the provider-pluggable architecture (A2) makes this additive; ship z.ai first.
- **MCP wiring deep-comparison** (Vision / Web Search / Web Reader / Zread vs Firecrawl + `gh`) — deferred, evidence-based. Provisional: wire **Vision only** (no Firecrawl equivalent; fills GLM-5.2's no-vision gap); skip Web Search/Reader (full Firecrawl overlap); Zread optional. See [`research/mcp-vs-firecrawl-comparison.md`](../research/mcp-vs-firecrawl-comparison.md).
- **Per-provider styling presets / icons** (A2c) — polish, later.
- **Multi-line footer** — stable line count by design.

## 12. Settled questions (were open in v1)

| Q | Resolution |
|---|---|
| Q1 — confirm A1 (replace vs additive) | ✅ **Replace** (confirmed by RECTOR). |
| Q2 — does glm-5.2 usage carry cached tokens? | ✅ Yes — field is **`cacheRead`** (verified on a real `zai`/`glm-5.2` response: `cacheRead: 7872`). v1 doc's `cacheReadInput` was wrong; corrected. |
| Q3 — off-peak tz | Fixed **SGT clock** (Mon–Fri 14:00–18:00 UTC+8). Applies inside the optional local fast-path; the authoritative poll is unaffected. |
| Q4 — truncation under narrow widths | Drop order: `quota` → `ctx%` → `tokens` → `git`; keep `model badge` always. |
| Q5 — sign-off checkpoint | This conversation (2026-08-12) was the sign-off. |
| *new* — tier source | **Auto** from `data.level` (A4′). |
| *new* — quota source | **Authoritative** `/quota/limit` poll (A3″). |
| *new* — fallback when provider ≠ z.ai | **Always render**; quota subscription-scoped (dimmed), session provider-scoped; never yield to native (A5-refined). |
