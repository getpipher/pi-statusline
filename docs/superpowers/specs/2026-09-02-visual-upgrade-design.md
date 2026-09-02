# 2026-09-02 — pi-statusline visual upgrade design

Status: **PROPOSAL** — brainstorming output; awaiting RECTOR review before writing-plans.

## Goal

Upgrade pi-statusline's presentation from flat semantic-token text to a colorful, preset-driven, glyph-rich footer — optionally with idle dimming and right-aligned ambient splits — while keeping the theme-token purity, render-path safety, and test discipline that the existing code enforces.

## Approaches considered

| approach | what | why not chosen |
|---|---|---|
| **A. Full visual framework** — theme presets + gradients + powerline separators + right-align + glyphs + animation | ccstatusline's feature list | Over-scoped for v0.5; powerline separators and right-align need renderer surgery (per-segment bg, width-aware padding); gradients need truecolor gating; animation needs sub-tick timers. Ship the visual wins first, add powerline/gradients in a follow-up. |
| **B. Presets + glyphs + polish** (RECOMMENDED) | Named theme presets (gruvbox/tokyo-night/pastel/solarized), Nerd/Unicode/ASCII glyph tables, burn-rate status glyphs with threshold colors, bar style variants, idle dimming | All five are pure render-time logic — no timers, no renderer surgery, no new deps. HIGH visual impact (different personality per preset + glyphs that pop) with zero risk to the render contract. Gradients + powerline + right-align → v0.6 follow-up. |
| **C. Animation-first** | Braille spinners, gradient cycling, sub-tick re-renders | The footer's re-render cadence is event/ticker-driven (30s idle); a 500ms spinner interval is the only honest animation and it only animates while a fetch is in-flight. Low perceived value for the complexity (unref'd timers, lifecycle, test discipline). Deferred to Tier 3. |

**Chosen: Approach B** — the highest visual-per-config-dollars ratio; every item is a pure render-time computation with no architecture changes, no new deps, no timers, no render-path awaits.

## Design

### 1. Named theme presets (`src/theme.ts`)

`THEME_PRESETS` becomes a registry of full token palettes. Each preset maps every semantic token to a truecolor hex string; `applyThemeColor` resolves token → preset hex → `theme.fg`.

```ts
interface ThemePreset {
  name: string;
  tokens: Record<ColorToken, string>;  // hex truecolor per token
}
const THEME_PRESETS: Record<string, ThemePreset> = {
  default:      { … current pi-theme-mapped tokens … },
  mono:         { … all text/dim … },
  gruvbox:      { text: "#ebdbb2", dim: "#928374", accent: "#fabd2f",
                  success: "#b8bb26", warning: "#fe8019", error: "#fb4934",
                  toolTitle: "#83a598", muted: "#7c6f64" },
  "tokyo-night": { … },
  pastel:       { … },
  solarized:    { … },
};
```

- Config: `display.theme: "gruvbox"` etc. — validated at use (unknown → default + one-time warn).
- `applyThemeColor(token, preset)` resolves the token to a truecolor hex, which the renderer emits as `ESC[38;2;R;G;Bm`.
- 16-color / 256-color terminals: precompute the nearest ANSI-256 index per hex (one-time at preset load); a `TERM=xterm` fallback maps to the closest named ANSI color.
- The `mono` preset stays as-is (semantic flattening). The `default` preset passes through pi's live theme unchanged (the current behavior).

### 2. Nerd Font / Unicode / ASCII glyph tables (`src/glyphs.ts`)

A `display.glyphs: "nerd" | "unicode" | "ascii"` config (default `"unicode"`) selects a lookup table per segment:

| segment | nerd | unicode | ascii |
|---|---|---|---|
| git branch | `` | `⑂` | `git:` |
| git dirty | `*` | `*` | `*` |
| git ahead | `↑n` | `↑n` | `↑n` |
| context gauge | `` or `` | `▰▱` | `█░` |
| quota bar | `` | `▰▱` | `█░` |
| model | `󰚩` | `◆` | `[m]` |
| sparkline | `▁▂▃▅▆▇` | same | same |
| deen prayer | ☾ | ☾ | `*` |
| versions | `SL:` / `PI:` | same | same |
| burn rate | `🔥` or `` | `▲` | `!` |

Default = `"unicode"` (renders in any modern terminal without a Nerd Font). `"nerd"` gives the full powerline/NF glyph set. `"ascii"` is the belt-and-braces fallback. The renderer looks up `glyphs[style][segmentName]` at render time.

### 3. Burn-rate / quota status glyphs (threshold-colored status indicators)

A `statusGlyph(value: number, thresholds: [warn, err], style): string` helper that returns the appropriate emoji/nerd/unicode glyph for a value against configured warn/err thresholds. Used by:
- the money row's burn rate (Session cost / time → $/hr, colored by rate bands)
- the quota row's block usage (`remaining / total` % against the 5h window)
- the context row's token % (already has heat bands — reuse the same threshold contract)

### 4. Bar style variants (`src/format.ts` `renderBar`)

`renderBar(ratio, cells, style)` gains a style param: `"blocks"` (current `█░`), `"rounded"` (`▰▱`), `"dots"` (`●●○○○`), `"shaded"` (`▓▒░`). Config: `display.barStyle`. Default stays `"blocks"`.

### 5. Idle dimming (render-path check)

If `Date.now() − lastActivityTs > idleDimMinutes × 60_000` (config, default 10), the renderer wraps all rows' tokens to `muted` before theme.fg. `lastActivityTs` is updated by the existing session/event lifecycle — no new timer, no new source. Config: `display.idleDim: boolean` (default true).

### 6. Deferred to v0.6 (tracked, not in this spec)

- Foreground gradients per segment (truecolor interpolation — needs a `color.mode` check and per-char escape emission; significant render-string growth)
- Powerline separator mode (needs per-segment bg colors + a separator bridge; biggest renderer change)
- Right-aligned ambient split (needs width-aware padding calc per render)
- Braille spinner (needs a sub-tick interval; only animates during in-flight fetches)

## Architecture

New/modified modules:
- `src/theme.ts` — extended: preset registry + truecolor resolution + ANSI-256 fallback
- `src/glyphs.ts` (new) — glyph tables per style per segment; `getGlyph(segment, style)` lookup
- `src/format.ts` — `renderBar` gains a style param; new `statusGlyph` helper
- `src/config.ts` — `display.glyphs`, `display.barStyle`, `display.idleDim` (lenient parses)
- `src/index.ts` — passes resolved glyph table + preset into the snapshot (or reads config directly per row)
- Row modules — read glyph table + status glyphs at render; no new state

Data flow unchanged: config → render(snapshot, detail) → fragments → theme.fg → ANSI. All additions are pure render-time lookups.

## Error handling / degradation

- Unknown theme preset → default + one-time warn (existing pattern)
- Unknown glyph style → unicode (safe default)
- No Nerd Font in terminal → unicode fallback renders in any modern terminal (geometric shapes, not PUA codepoints)
- Truecolor unavailable → nearest ANSI-256 precomputed per hex (one-time at preset load); 16-color → nearest named ANSI

## Testing

- Theme preset resolution: each preset resolves every ColorToken to a valid hex
- Glyph tables: every segment/style combo returns a non-empty string
- renderBar styles: each style produces the right filled/empty chars at 0%, 50%, 100%
- statusGlyph: each threshold band returns the right glyph
- Idle dimming: threshold boundary at exactly idleDimMinutes
- Config parse: lenient for all three new display fields
- Integration: existing tests unchanged (defaults preserve current rendering)
