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
  "display": { "showTokens": true, "showContext": true, "showGit": true }
}
```

Run `/statusline` for the interactive settings panel.
