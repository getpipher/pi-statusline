# pi-statusline

> Adaptive, provider-aware footer (statusline) for the Pi Coding Agent.

v2 renders a multi-line **Editorial Dashboard**: an identity line, a context
line with bar + tokens, a money line, a provider quota line, a deen prayer
line, and an ambient line. For z.ai (GLM Coding Plan) the quota line shows the
**authoritative** 5h + weekly credit balance polled from the console API
(`/quota/limit`); spend across all providers accumulates in a local ledger;
the deen line tracks the five daily prayers with a live next-prayer countdown.

## Render preview

```
v2-p1 pi-statusline ⎇ main* ↑2 ↓1 | glm-5.2 · high
Ctx: 34% (68.0K/200.0K) | Tokens: 48.0K in / 6.2K out | Cache: 68% hit
REPO $12.34 | DAY $8.40 | 7DAY $31.20 | 30DAY $118.75
zai 5HRS 75%/42% (2.0k) reset 2h55m | 7DAY 15%/86% (10k) reset 1d0h
deen Fajr 05:00 ✓ | Dhuhr 12:00 (2h) | Asr 15:30 | Maghrib 18:00 | Isha 19:30 | 17 Rabīʿ al-awwal 1448 | Jakarta
04:12 | coding 3h12m | commits 7 | SL:0.4.0 · PI:0.84.4
```

Color semantics (theme-integrated hues): money values `success` (green), git branch
and token flow `toolTitle` (blue), model `accent`; the ctx percentage traffic-lights CCS-style
(`success` <50%, `warning` 50–89%, `error` ≥90% — window ratio shares the color, `Cache:` is
`success`); the quota row tints each window segment by
its own usage heat (`accent`, escalating to `warning`/`error` at ≥70%/≥90%); each window
segment carries its own `reset` countdown (v0.4.6), riding the window's heat color; values
`text`; dirty `*` + ahead/behind
` ↑n ↓n` marks ride the branch in `toolTitle`; labels/separators dim; ambient row fully dim.
The model is followed by the **thinking level** (v0.4.6, dim ` · high`) — the requested
reasoning effort pi will use for future turns (`off` included, so a disabled state is visible).
Separator is ` | `. The deen strip uses CCS prayer states (v0.4.1): the **next prayer is
green** (`success`), past prayers dim with `✓`, upcoming prayers plain `text` — steady colors,
no proximity escalation (see **Deen**).
With `display.theme: "mono"` the multi-hue tokens (`success`/`toolTitle`/`accent`) flatten to
`text` while escalation (`warning`/`error`) and hierarchy (dim/muted) are preserved.

## Install

In `~/.pi/agent/settings.json`:

```json
{ "packages": ["@getpipher/pi-statusline"] }
```

## Config

`~/.pi/agent/pi-statusline.json` (schema v2):

```json
{
  "enabled": true,
  "zai": { "tier": "auto", "pollIntervalMs": 180000 },
  "deen": { "city": "Jakarta", "country": "Indonesia", "method": "auto", "escalateMinutes": 30 },
  "providers": { "openrouter": { "enabled": true, "pollIntervalMs": 600000 } },
  "display": {
    "rows": ["identity", "ctx", "money", "quota", "deen", "ambient"],
    "bars": true,
    "showVersions": false,
    "theme": "default"
  }
}
```

- **`display.rows`** — which rows render and in what order; a subset/reorder
  of the registry (`identity`, `ctx`, `money`, `quota`, `deen`, `ambient`),
  never an invention. Unknown ids are dropped with a one-time warning (surfaced
  as a notify, once per id per session — handy for typo-spotting).
- **`display.bars`** — inert since v0.4.1 (the ctx and quota bars were removed per RECTOR; the key is still accepted for back-compat).
- **`display.sparkline` / `display.burnAnchor`** — removed in v0.4.6 (sparkline + burn rate decluttered away per RECTOR); the keys are ignored.
- **`display.showVersions`** — appends `SL:<version> · PI:<version>` stamps to the
  ambient line (default off). `SL` is this package; `PI` is the linked
  `@earendil-works/pi-coding-agent` (omitted when unresolvable).
- **`display.theme`** — named color preset. `"default"` (identity — pi's live
  theme resolves every token), `"mono"` (flattens `success`/`toolTitle`/`accent`
  to `text`, keeping escalation bands), or a full-palette truecolor preset:
  `"gruvbox"`, `"tokyo-night"`, `"pastel"`, `"solarized"`. Palette presets emit
  truecolor ANSI directly (bypassing pi-theme) so colors are identical across
  hosts. Unknown values fall back to `default` with a one-time warning.
- **`display.glyphs`** — segment decoration style: `"unicode"` (default; the
  established marks, e.g. `⎇ main`), `"nerd"` (Nerd Font glyphs, e.g. the
  branch icon — needs a Nerd Font terminal), or `"ascii"` (plain text, e.g.
  `git: main`). Unknown values are ignored (default retained).
- **`display.barStyle`** — progress-bar character style for bar-rendering
  formats: `"blocks"` (default, `████░░░░░░`), `"rounded"` (`▰▰▰▰▰▱▱▱▱▱`),
  `"dots"` (`●●●●●○○○○○`), `"shaded"` (`▓▓▓▓▓░░░░░`). Plumbed through the
  render snapshot; inert until a bar format consumes it.
- **`providers.openrouter`** — the OpenRouter credits row: `enabled` (default
  `true`; a missing `openrouter.key` in `~/.pi/agent/auth.json` leaves the row
  inert) and `pollIntervalMs` (default 600000). The row shows
  `or $X.XX left · $X.XX today · top: <model> $X.XX` — `today`/`top` come from
  the **local ledger's** attributed spend (the credits API has no per-window or
  per-model breakdown).
- **`deen`** — prayer-tracker settings (see **Deen** below). `city` may be
  `"auto"` for IP-based geolocation; `method` is the [aladhan calculation
  method](https://aladhan.com/calculation-methods) ("auto" = aladhan default);
  `escalateMinutes` is inert since v0.4.1 (the proximity escalation was retired in favor of CCS prayer states; the key is still accepted for back-compat).
- **Back-compat:** v1 config files load cleanly — the v1 `showTokens` /
  `showContext` / `showGit` / `showSession` flags are still honored where the
  merged rows allow, and a file without `rows` gets the full default order.
  A file without a `deen` section gets the defaults (Jakarta / Indonesia /
  auto / 30) — the row renders once data is fetched.

## Ledger

Spend is accumulated in `~/.pi/agent/pi-statusline/ledger.jsonl` — an
append-only JSONL file keyed by session-entry id (restart-safe; the same entry
is never counted twice). Since v0.3.0 each line records the **repo** it was
spent in (the cwd basename at write time), and since v0.4.0 also the live
**provider/model** attribution — which powers the OpenRouter row's
`today`/`top:` fragments and the quota row's per-provider queries. Legacy
lines without a field record `"unknown"` and never count toward the REPO total
or provider-scoped sums; historical lines are never re-attributed. The money
line leads with
`REPO $X` — the all-time total for the current repo (once the repo has
recorded any spend; a fresh ledger renders without the lead). It is safe to
delete at any time: the footer rebuilds
from an empty ledger and **historical sessions are not re-scanned** — day/7d/
30d totals simply start over from the next session.

## Deen

The deen line tracks the five daily prayers (Fajr → Isha) in the **city's
timezone** with a live countdown to the next prayer, the Hijri date, and the
city. Data comes from the [aladhan](https://aladhan.com/) `timingsByCity` API
(one call per local day), cached 24h at
`~/.pi/agent/pi-statusline/deen-cache.json`; when a fetch fails the last-good
timetable is served with a `stale Nm` marker. Prayer states are CCS-faithful
(as of v0.4.1, matching claude-code-statusline's presentation): the **next prayer renders
green** (`success`), past prayers render dim with `✓` — the just-started prayer reads
completed immediately, with no separate adhan marker — and upcoming prayers render plain.

With `city: "auto"`, the city is resolved once via IP geolocation (ipwho.is,
cached 7 days alongside the timetable). Location is set with
`/statusline deen <city|auto>` — persisted, and the strip is force-refreshed
immediately.

Until v0.3.x the strip escalated by proximity to the next prayer (dim → `text` →
`accent` bands); v0.4.1 replaced that with the steady CCS states above, so the strip reads
identically no matter how close the next adhan is.

## Commands

- `/statusline refresh` — force a quota poll now
- `/statusline on` / `/statusline off` — enable/disable; `off` restores pi's native footer until `on`
- `/statusline tier <auto|lite|pro|max>` — tier override
- `/statusline deen <city|auto>` — set the prayer location; persists to config and force-refreshes
- `/statusline rows [id,id,...]` — bare `rows` lists the current display order
  (with the valid ids); `rows identity,money,quota` reorders/subsets the footer,
  validated against the registry and persisted (typos are rejected with the
  valid list)

Arguments are lenient: case-insensitive, surrounding whitespace tolerated, and
trailing extra arguments are ignored.

## Status parity

The footer now tracks the Claude Code statusline's live surface at ~14/14
groups (identity/session, branch + dirty/ahead-behind, model, context +
window, token flow, cache hit, day/7d/30d spend, quota windows + per-window
reset, git commits-today, version
stamps) — with the deen prayer strip and pluggable provider adapters beyond it.
