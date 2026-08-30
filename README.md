# pi-statusline

> Adaptive, provider-aware footer (statusline) for the Pi Coding Agent.

v2 renders a multi-line **Editorial Dashboard**: an identity line, a context
line with bar + tokens, a money line, a provider quota line, and an ambient
line. For z.ai (GLM Coding Plan) the quota line shows the **authoritative**
5h + weekly credit balance polled from the console API (`/quota/limit`); spend
across all providers accumulates in a local ledger.

## Render preview

```
v2-p1 pi-statusline ⎇ main | glm-5.2
ctx ▕███░░░░░░░▏ 34% 68k/200k | ↑48k ↓6.2k | cache 68%
$ 1.24 sess | 8.40 day | 31.20 7d | 118.75 30d ▁▁▂▄▂▁▇ | $0.39/hr
zai ▕████████░░▏ 75% 1.5k/2.0k 5h | wk 15% | reset 2h55m
04:12 | coding 3h12m
```

Color semantics (theme-integrated hues): money values + sparkline `success` (green), git branch
and token flow `toolTitle` (blue), model + bar fills `accent` (escalating to `warning`/`error`
at ≥70%/≥90%), quota row tints by usage heat (same bands); values `text`; labels/separators dim;
ambient row fully dim. Separator is ` | `.

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
  "display": {
    "rows": ["identity", "ctx", "money", "quota", "ambient"],
    "bars": true,
    "sparkline": true
  }
}
```

- **`display.rows`** — which rows render and in what order; a subset/reorder
  of the registry (`identity`, `ctx`, `money`, `quota`, `deen`, `ambient`),
  never an invention. Unknown ids are dropped with a one-time warning (surfaced
  as a notify, once per id per session — handy for typo-spotting).
- **`display.bars`** — gates the ctx row's progress bar.
- **`display.sparkline`** — gates the 7-day sparkline in the money line.
- **Back-compat:** v1 config files load cleanly — the v1 `showTokens` /
  `showContext` / `showGit` / `showSession` flags are still honored where the
  merged rows allow, and a file without `rows` gets the full default order.
  `deen` is accepted now but has no row module yet — it lights up in v0.3.0
  (accepted silently, no warning).

## Ledger

Spend is accumulated in `~/.pi/agent/pi-statusline/ledger.jsonl` — an
append-only JSONL file keyed by session-entry id (restart-safe; the same entry
is never counted twice). It is safe to delete at any time: the footer rebuilds
from an empty ledger and **historical sessions are not re-scanned** — day/7d/
30d totals simply start over from the next session.

## Commands

- `/statusline refresh` — force a quota poll now
- `/statusline on` / `/statusline off` — enable/disable; `off` restores pi's native footer until `on`
- `/statusline tier <auto|lite|pro|max>` — tier override

Arguments are lenient: case-insensitive, surrounding whitespace tolerated, and
trailing extra arguments are ignored.
