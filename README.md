# pi-statusline

> Adaptive, provider-aware footer (statusline) extension for the [Pi Coding Agent](https://github.com/earendil-works/pi-mono).

**Status:** Design phase — not yet implemented.

`pi-statusline` replaces pi's native footer with a multi-segment bar that shows **the metric that matters for the active provider's billing model**:

- **z.ai GLM Coding Plan** (flat-rate) → **credits consumed / remaining** against your plan, with 5-hour + weekly windows and reset countdowns.
- **OpenRouter / pay-per-token** → **`$ cost`** (real money).
- **Ollama / local** → tokens only.

## Why

On a flat-rate subscription, a `$0.0423` cost figure is meaningless — what you actually care about is **credit consumption against your plan's ceiling and when it resets**. On pay-per-token, `$ cost` is exactly right. The footer should reflect the provider's reality, not a one-size-fits-all number.

## Status & docs

This package is in **design**. No code yet.

- 📐 **Design:** [`docs/design/2026-08-12-pi-statusline-design.md`](docs/design/2026-08-12-pi-statusline-design.md)
- 🔬 **z.ai quota research:** [`docs/research/2026-08-12-zai-quota-research.md`](docs/research/2026-08-12-zai-quota-research.md)

## License

MIT.
