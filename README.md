# pi-statusline

> Adaptive, provider-aware footer (statusline) for the Pi Coding Agent.

Replaces pi's native footer with a multi-segment bar. For z.ai (GLM Coding Plan)
it shows **authoritative** 5h + weekly credit balance polled from the console API
(`/quota/limit`); per-provider `$ cost` (OpenRouter etc.) is deferred.

## Install

In `~/.pi/agent/settings.json`:

```json
{ "packages": ["@getpipher/pi-statusline"] }
```

## Config

`~/.pi/agent/pi-statusline.json`:

```json
{
  "enabled": true,
  "zai": { "tier": "auto", "pollIntervalMs": 180000 },
  "display": { "showTokens": true, "showContext": true, "showGit": true, "showSession": true }
}
```

## Commands

v1 ships a notify-based command surface (no interactive panel — the TUI panel
is deferred):

- `/statusline refresh` — force a quota poll now
- `/statusline on` / `/statusline off` — enable/disable; `off` restores pi's native footer until `on`
- `/statusline tier <auto|lite|pro|max>` — tier override

Arguments are lenient: case-insensitive, surrounding whitespace tolerated, and
trailing extra arguments are ignored.
